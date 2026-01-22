import { Request, Response } from 'express';
import DocumentModel from '../models/Document';
import { addDocumentJob } from '../queues/documentQueue';
import NotificationModel from '../models/Notification';

import { getAuth } from '@clerk/express'; 

// GET /api/health
export const checkHealth = (req: Request, res: Response) => {
  res.json({ status: 'active', message: ' API is running 🟢' });
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
    const newDoc = await DocumentModel.create({
      originalName: fileData.originalname,
      // IMPORTANT: Save the S3 Key (e.g., "uploads/123.pdf"), NOT the full URL
      storagePath: fileData.key, 
      mimeType: fileData.mimetype,
      status: 'pending',
      userId: userId,
    });

    // 4. Dispatch Job to Queue
    // We pass the S3 Key so the Worker (or Lambda) can find it later
    // Ensure addDocumentJob accepts the key!
    if (typeof addDocumentJob === 'function') {
        await addDocumentJob(newDoc._id as unknown as string, newDoc.storagePath, newDoc.mimeType);
    }

    // 5. Success Response
    res.status(202).json({
      success: true,
      message: 'Upload accepted. Processing in background.',
      file: {
        id: newDoc._id,
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
      extraction: doc.extractedData,
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
export const markAsRead = async (req: Request, res: Response) => {
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
