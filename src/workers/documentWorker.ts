import { Worker } from 'bullmq';
import connection from '../config/redis';
import { DOCUMENT_QUEUE_NAME } from '../queues/documentQueue';
import { analyzeDocument } from '../services/geminiService';
import DocumentModel from '../models/Document';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// We need a separate DB connection for the worker process
const connectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tradecomply');
    console.log('✅ Worker Connected to MongoDB');
  }
};

connectDB();

console.log('👷 Document Worker Started. Waiting for jobs...');

// Define the shape of the Job Data for TypeScript
interface DocumentJobData {
  docId: string;
  filePath: string;
  mimeType: string;
}

export const worker = new Worker<DocumentJobData>(DOCUMENT_QUEUE_NAME, async (job) => {
  console.log(`⚙️ Processing Job ${job.id}: ${job.data.docId}`);

  try {
    // Explicitly destructure with types
    const { docId, filePath, mimeType } = job.data;

    // 1. Analyze with Gemini
    const aiResult = await analyzeDocument(filePath, mimeType);
    console.log(`🧠 AI Analysis Complete for ${docId}`);

    // 2. Update Database
    const updatedDoc = await DocumentModel.findByIdAndUpdate(
      docId, 
      {
        status: 'processed',
        extractedData: {
          docType: aiResult.type,
          expiryDate: aiResult.expiryDate,
          licenseNumber: aiResult.licenseNumber,
          holderName: aiResult.name,
          confidence: aiResult.confidence
        }
      },
      { new: true }
    );

    console.log(`✅ Document updated: ${updatedDoc?._id}`);
    return aiResult;

  } catch (error) {
    console.error(`❌ Job Failed ${job.id}:`, error);
    
    // Mark DB as failed
    if (job.data.docId) {
      await DocumentModel.findByIdAndUpdate(job.data.docId, { 
        status: 'failed' 
      });
    }
    throw error;
  }
}, { 
  connection: connection as any, // FIX: Cast to any to resolve ioredis version mismatch
  concurrency: 5 
});