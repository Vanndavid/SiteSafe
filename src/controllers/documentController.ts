import { Request, Response } from 'express';
import { analyzeText } from '../services/geminiService';

// GET /api/health
export const checkHealth = (req: Request, res: Response) => {
  res.json({ status: 'active', message: 'SiteSafe.ai API is running 🟢' });
};

// POST /api/test-ai
export const testAI = async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const aiResponse = await analyzeText(prompt);
    res.json({ success: true, data: aiResponse });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

// POST /api/upload
export const uploadDocument = (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  res.json({
    success: true,
    message: 'File uploaded successfully',
    file: {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path
    }
  });
};