import { Request, Response } from 'express';
import DocumentModel from '../models/Document';
import { addDocumentJob } from '../queues/documentQueue';

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