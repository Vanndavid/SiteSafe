import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getRequestUserId } from '../utils/authUtils';
import { validateUploadIntent, MAX_UPLOAD_SIZE_BYTES } from '../utils/fileUtils';
import { parsePositiveInt } from '../utils/numberUtils';
import { getObjectHead, generatePresignedDownloadUrl } from '../services/storageService';
import {
  createPendingDocumentRecord,
  createUploadIntent,
  getAllDocuments as fetchAllDocumentsService,
  getDocumentOverview as buildDocumentOverviewService,
  getDocumentStatusById,
  markDocumentPendingAndQueue,
  searchProcessedDocuments,
} from '../services/documentService';
import { getUnreadNotifications, markNotificationRead } from '../services/notificationService';
import type { ExtractedDocumentData } from '../models/Document';
import { DocumentStatus } from '@prisma/client';

type UploadedFileData = {
  originalname: string;
  key: string;
  mimetype: string;
};

const UPLOADING_DOCUMENT_STATUS = 'uploading';

// GET /api/health
export const checkHealth = (_req: Request, res: Response) => {
  res.json({ status: 'active', message: 'API is running' });
};

// POST /api/upload (Async Version - Day 5)
export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const fileData = req.file as any;
  console.log('File uploaded to S3 with key:', fileData);
  const userId = 'test_user_123';
  console.log('Fetching documents for user:', userId);
  console.log(`Received file key: ${fileData.key}`);

  try {
    const newDoc = await createPendingDocumentRecord(fileData as UploadedFileData, userId);
    res.status(202).json({
      success: true,
      message: 'Upload accepted. Processing in background.',
      file: {
        id: newDoc.id,
        originalName: newDoc.originalName,
        status: 'pending',
        key: newDoc.storagePath,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Upload Failed',
      details: (error as Error).message,
    });
  }
};

// POST /api/documents/upload-url
export const createDocumentUploadUrl = async (req: Request, res: Response) => {
  const { fileName, mimeType, sizeBytes } = req.body || {};
  const validationError = validateUploadIntent(fileName, mimeType, sizeBytes);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const userId = getRequestUserId(req);
    const uploadIntent = await createUploadIntent(userId, fileName, mimeType);

    res.status(201).json(uploadIntent);
  } catch (error) {
    console.error('Failed to create upload URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create upload URL',
      details: (error as Error).message,
    });
  }
};

// POST /api/documents/:id/complete-upload
export const completeDocumentUpload = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Document id is required' });
    }

    const userId = getRequestUserId(req);
    const doc = await prisma.document.findUnique({ where: { id } });

    if (!doc || doc.userId !== userId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (String(doc.status) !== UPLOADING_DOCUMENT_STATUS) {
      return res.status(409).json({ error: `Document upload is already ${doc.status}` });
    }

    const headResult = await getObjectHead(doc.storagePath);

    if (headResult.ContentType && headResult.ContentType !== doc.mimeType) {
      return res.status(400).json({ error: 'Uploaded file type does not match reserved file type' });
    }

    if (headResult.ContentLength && headResult.ContentLength > MAX_UPLOAD_SIZE_BYTES) {
      return res.status(400).json({ error: 'Uploaded file is too large' });
    }

    const updatedDoc = await markDocumentPendingAndQueue(doc);

    res.status(202).json({
      success: true,
      message: 'Upload confirmed. Processing in background.',
      file: {
        id: updatedDoc.id,
        originalName: updatedDoc.originalName,
        status: updatedDoc.status,
        key: updatedDoc.storagePath,
      },
    });
  } catch (error) {
    console.error('Failed to complete upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete upload',
      details: (error as Error).message,
    });
  }
};

// GET /api/document/:id
export const getDocumentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Document id is required' });
    }

    const doc = await getDocumentStatusById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ status: doc.status, extraction: doc.extractedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

export const updateDocumentProcessingResult = async (req: Request, res: Response) => {
  try {
    const expectedToken = process.env.WORKER_CALLBACK_TOKEN;
    const providedToken = req.header('x-worker-token');

    if (!expectedToken) {
      console.error('WORKER_CALLBACK_TOKEN is not configured');
      return res.status(500).json({ error: 'Worker callback is not configured' });
    }

    if (!providedToken || providedToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized worker callback' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Document id is required' });
    }

    const { status, extractedData } = req.body as { status: DocumentStatus; extractedData: ExtractedDocumentData };
    if (status !== 'processed' && status !== 'failed') {
      return res.status(400).json({ error: 'Invalid processing status' });
    }

    var data = { status: status, extractedData: extractedData };
    const updatedDoc = await prisma.document.update({
        where: { id },
        data: data,
    });
   
    res.json({
      success: true,
      document: {
        id: updatedDoc.id,
        status: updatedDoc.status,
      },
    });
  } catch (error) {
    console.error('Failed to update document processing result:', error);
    res.status(500).json({ error: 'Failed to update document processing result' });
  }
};

// --- NEW: Get All Documents (History) ---
export const getAllDocuments = async (_req: Request, res: Response) => {
  try {
    const formattedDocs = await fetchAllDocumentsService();
    res.json(formattedDocs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const getDocumentOverview = async (req: Request, res: Response) => {
  try {
    const expiringWithinDays = parsePositiveInt(req.query.expiringWithinDays, 30);
    const limit = parsePositiveInt(req.query.limit, 5);
    const overview = await buildDocumentOverviewService(expiringWithinDays, limit);

    res.json(overview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch document overview' });
  }
};

export const searchDocuments = async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await searchProcessedDocuments(query);
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
};

export const getNotifications = async (_req: Request, res: Response) => {
  try {
    const alerts = await getUnreadNotifications();
    res.json(alerts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Notification id is required' });
    }

    await markNotificationRead(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
};

export const downloadDocument = async (req: Request, res: Response) => {
  try {
    const fileKey = req.params.key;
    const fileName = req.query.name || 'download';

    if (!fileKey) {
      return res.status(400).json({ error: 'File key is required' });
    }

    const downloadUrl = await generatePresignedDownloadUrl(fileKey);
    res.json({ url: downloadUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
};
