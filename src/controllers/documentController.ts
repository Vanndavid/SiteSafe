import { Request, Response } from 'express';
// import { addDocumentJob } from '../queues/documentQueue';
import { addDocumentJob } from '../queues/sqsProducer'; //AWS SQS version
import prisma from '../config/prisma';
import type { ExtractedDocumentData } from '../models/Document';

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAuth } from '@clerk/express'; 

type WorkerProcessingStatus = 'processed' | 'failed';

type WorkerProcessingResult = {
  status?: WorkerProcessingStatus;
  extractedData?: ExtractedDocumentData;
};

const SEARCH_STOP_WORDS = new Set([
  'a', 'about', 'all', 'an', 'and', 'are', 'be', 'by', 'documents', 'document', 'expire', 'expired', 'expiring',
  'files', 'find', 'for', 'from', 'in', 'is', 'me', 'month', 'months', 'of', 'show', 'that', 'the', 'their',
  'to', 'uploaded', 'user', 'with', 'within'
]);

const normalizeSearchText = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSearchTerms = (query: string) => {
  const matches = normalizeSearchText(query).match(/[a-z0-9]+/g) || [];
  return Array.from(new Set(matches.filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token))));
};

const extractExpiryWindowDays = (query: string) => {
  const normalized = normalizeSearchText(query);
  const match = normalized.match(/(?:expire|expired|expiring)(?:d)?(?:\s+\w+){0,3}?\s+(?:in|within|before)\s+(\d+)\s+(day|days|week|weeks|month|months)/i);

  if (!match) {
    return null;
  }

  const [, amountRaw, unitRaw] = match;
  if (!amountRaw || !unitRaw) {
    return null;
  }

  const amount = Number(amountRaw);
  const unit = unitRaw.toLowerCase();

  if (Number.isNaN(amount) || amount < 0) {
    return null;
  }

  if (unit.startsWith('day')) return amount;
  if (unit.startsWith('week')) return amount * 7;
  if (unit.startsWith('month')) return amount * 30;
  return null;
};

const daysUntilExpiry = (expiryDate?: string) => {
  if (!expiryDate) return null;

  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((parsed.getTime() - now.getTime()) / msPerDay);
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const buildDocumentSearchSummary = (doc: any) => {
  const parts = [
    doc.originalName,
    doc.extractedData?.docType,
    doc.extractedData?.holderName,
    doc.extractedData?.licenseNumber,
    doc.extractedData?.content,
  ].filter(Boolean);

  return normalizeSearchText(parts.join(' '));
};

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// GET /api/health
export const checkHealth = (req: Request, res: Response) => {
  res.json({ status: 'active', message: 'API is running' });
};

// POST /api/upload (Async Version - Day 5)
export const uploadDocument = async (req: Request, res: Response) => {
  // 1. Safety Check
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // 2. TypeScript Hack (Crucial for Speed)
  // S3 adds '.key' and '.location', but TypeScript thinks it's a local file.
  // Casting to 'any' stops TS from complaining.
  const fileData = req.file as any; 
  console.log('File uploaded to S3 with key:', fileData);
  // const { userId } = getAuth(req); // Keeping your Auth logic
  const userId = "test_user_123"; // TEMP: Use a dummy string if Auth isn't set up yet

  console.log('Fetching documents for user:', userId);
  
  try {
    // Note: We use fileData.key (S3) instead of .path
    console.log(`Received file key: ${fileData.key}`); 

    // 3. Create DB Record
    const newDoc = await prisma.document.create({
      data: {
        originalName: fileData.originalname,
        storagePath: fileData.key,
        mimeType: fileData.mimetype,
        status: 'pending',
        userId,
      },
    });

    // 4. Dispatch Job to Queue
    // We pass the S3 Key so the Worker (or Lambda) can find it later
    // Ensure addDocumentJob accepts the key!
    if (typeof addDocumentJob === 'function') {
        await addDocumentJob(newDoc.id as unknown as string, newDoc.storagePath, newDoc.mimeType);
    }

    // 5. Success Response
    res.status(202).json({
      success: true,
      message: 'Upload accepted. Processing in background.',
      file: {
        id: newDoc.id,
        originalName: newDoc.originalName,
        status: 'pending',
        key: newDoc.storagePath // Useful for debugging
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: 'Upload Failed',
      details: (error as Error).message 
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

    const doc = await prisma.document.findUnique({
      where: { id },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Return the status and extraction (if ready)
    res.json({
      status: doc.status,
      extraction: doc.extractedData
    });
  } catch (error) {
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

    const { status, extractedData } = req.body as WorkerProcessingResult;
    if (status !== 'processed' && status !== 'failed') {
      return res.status(400).json({ error: 'Invalid processing status' });
    }

    const data = status === 'processed'
      ? {
          status,
          extractedData: extractedData || {},
        }
      : {
          status,
        };

    const updatedDoc = await prisma.document.update({
      where: { id },
      data,
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
export const getAllDocuments = async (req: Request, res: Response) => {
  try {
    // Get last 20 docs, newest first
    const docs = await prisma.document.findMany({
      orderBy: { uploadDate: 'desc' },
      take: 20,
    });

    // Map to frontend format
    const formattedDocs = docs.map(doc => ({
      id: doc.id,
      name: doc.originalName,
      status: doc.status,
      storagePath: doc.storagePath,
      extraction: doc.extractedData,
    }));

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

    const docs = await prisma.document.findMany({
      orderBy: { uploadDate: 'desc' },
      take: 500,
    });

    const totals = {
      total: docs.length,
      pending: 0,
      processed: 0,
      failed: 0,
      expired: 0,
      expiringSoon: 0,
      valid: 0,
      missingExpiry: 0,
    };

    const expiringDocuments: Array<{
      id: typeof docs[number]['id'];
      name: string;
      expiryDate?: string;
      daysUntilExpiry: number;
      status: typeof docs[number]['status'];
    }> = [];

    docs.forEach(doc => {
      if (doc.status === 'pending') totals.pending += 1;
      if (doc.status === 'processed') totals.processed += 1;
      if (doc.status === 'failed') totals.failed += 1;

      const expiryInDays = daysUntilExpiry((doc.extractedData as ExtractedDocumentData | null)?.expiryDate);

      if (expiryInDays == null) {
        totals.missingExpiry += 1;
        return;
      }

      if (expiryInDays < 0) {
        totals.expired += 1;
        return;
      }

      if (expiryInDays <= expiringWithinDays) {
        totals.expiringSoon += 1;
        const expiringEntry: {
          id: typeof docs[number]['id'];
          name: string;
          expiryDate?: string;
          daysUntilExpiry: number;
          status: typeof docs[number]['status'];
        } = {
          id: doc.id,
          name: doc.originalName,
          daysUntilExpiry: expiryInDays,
          status: doc.status,
        };

        const expiryDate = (doc.extractedData as ExtractedDocumentData | null)?.expiryDate;
        if (expiryDate) {
          expiringEntry.expiryDate = expiryDate;
        }

        expiringDocuments.push({
          ...expiringEntry,
        });
        return;
      }

      totals.valid += 1;
    });

    expiringDocuments.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    res.json({
      generatedAt: new Date().toISOString(),
      filters: {
        expiringWithinDays,
      },
      totals,
      expiringDocuments: expiringDocuments.slice(0, limit),
    });
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

    const keywordTerms = tokenizeSearchTerms(query);
    const expiryWindowDays = extractExpiryWindowDays(query);

    const docs = await prisma.document.findMany({
      where: { status: 'processed' },
      orderBy: { uploadDate: 'desc' },
      take: 100,
    });
    const matches = docs
      .map(doc => {
        const haystack = buildDocumentSearchSummary(doc);
        const matchedTerms = keywordTerms.filter(term => haystack.includes(term));
        const expiryInDays = daysUntilExpiry((doc.extractedData as ExtractedDocumentData | null)?.expiryDate);
        const matchesExpiryWindow = expiryWindowDays == null
          ? true
          : expiryInDays != null && expiryInDays >= 0 && expiryInDays <= expiryWindowDays;

        const keywordMatchRequired = keywordTerms.length === 0 || matchedTerms.length > 0;

        if (!keywordMatchRequired || !matchesExpiryWindow) {
          return null;
        }

        const reasons = [] as string[];
        if (matchedTerms.length > 0) {
          reasons.push(`Matched ${matchedTerms.join(', ')}`);
        }
        if (expiryWindowDays != null && expiryInDays != null) {
          reasons.push(`Expires in ${expiryInDays} day${expiryInDays === 1 ? '' : 's'}`);
        }

        return {
          id: doc.id,
          name: doc.originalName,
          status: doc.status,
          storagePath: doc.storagePath,
          extraction: doc.extractedData,
          matchReasons: reasons,
          score: matchedTerms.length + (matchesExpiryWindow && expiryWindowDays != null ? 2 : 0),
        };
      })
      .filter((doc): doc is {
        id: typeof docs[number]['id'];
        name: string;
        status: typeof docs[number]['status'];
        storagePath: string;
        extraction: typeof docs[number]['extractedData'];
        matchReasons: string[];
        score: number;
      } => doc !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...doc }) => doc);

    res.json({
      query,
      interpretedFilters: {
        keywords: keywordTerms,
        expiryWithinDays: expiryWindowDays,
      },
      results: matches,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    // Get last 5 unread notifications
    const alerts = await prisma.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Notification id is required' });
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
};

export const downloadDocument = async (req: Request, res: Response) => {
  try {
    
    console.log("Here");
    const fileKey = req.params.key;
    const fileName = req.query.name || 'download';
    console.log(`Generating download link for key: ${fileKey}`);
    if (!fileKey) {
        return res.status(400).json({ error: "File key is required" });
    }
    // Generate the temporary secure link
    const downloadUrl = await generatePresignedUrl(fileKey,fileName as string);
    res.json({ url: downloadUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
};

// Helper: Generate Presigned URL for S3 Download
export const generatePresignedUrl = async (fileKey: string, fileName: string) => {
  const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: String(fileKey),
      
      // Forces the browser to "Save As" instead of opening the file
      // ResponseContentDisposition: `attachment; filename="${fileName}"`
  });
  console.log("Generating presigned URL with command:", command);
  // Generate a URL that expires in 1 hour (3600 seconds)
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
};  
