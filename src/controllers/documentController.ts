import { Request, Response } from 'express';
import DocumentModel from '../models/Document';
import { addDocumentJob } from '../queues/documentQueue';
import NotificationModel from '../models/Notification';

// GET /api/health
export const checkHealth = (req: Request, res: Response) => {
  res.json({ status: 'active', message: 'TradeComply API is running 🟢' });
};

// POST /api/upload (Async Version - Day 5)
export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    console.log(`Received file: ${req.file.path}`);

    // 1. Create DB Record (Status: Pending)
    // We save it FIRST so we have an ID to track
    const newDoc = await DocumentModel.create({
      originalName: req.file.originalname,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      status: 'pending', // Starts as pending
    });

    // 2. Dispatch Job to Queue (The "Senior" Move)
    // This offloads the heavy AI processing to the background worker
    await addDocumentJob(newDoc._id as unknown as string, newDoc.storagePath, newDoc.mimeType);

    // 3. Return "Accepted" immediately (Don't wait for AI)
    res.status(202).json({
      success: true,
      message: 'Upload accepted. Processing in background.',
      file: {
        id: newDoc._id,
        originalName: newDoc.originalName,
        status: 'pending' // Frontend sees "Pending"
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
    const doc = await DocumentModel.findById(req.params.id);
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

// --- NEW: Get All Documents (History) ---
export const getAllDocuments = async (req: Request, res: Response) => {
  try {
    // Get last 20 docs, newest first
    const docs = await DocumentModel.find()
      .sort({ uploadDate: -1 })
      .limit(20);

    // Map to frontend format
    const formattedDocs = docs.map(doc => ({
      id: doc._id,
      name: doc.originalName,
      status: doc.status,
      extraction: doc.extractedData
    }));

    res.json(formattedDocs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    // Get last 5 unread notifications
    const alerts = await NotificationModel.find({ read: false })
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await NotificationModel.findByIdAndUpdate(id, {
      read: true
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
};
