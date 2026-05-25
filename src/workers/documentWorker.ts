// this is local worker using BullMQ and Redis, this will be replaced by SQS worker later. see src/workers/sqsWorker.ts

import { Worker } from 'bullmq';
import connection from '../config/redis';
import { DOCUMENT_QUEUE_NAME } from '../queues/documentQueue';
import { analyzeDocument } from '../services/geminiService';
import prisma from '../config/prisma';
import dotenv from 'dotenv';

dotenv.config();

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
    const updatedDoc = await prisma.document.update({
      where: { id: docId },
      data: {
        status: 'processed',
        extractedData: {
          docType: aiResult.type,
          expiryDate: aiResult.expiryDate,
          licenseNumber: aiResult.licenseNumber,
          holderName: aiResult.name,
          confidence: aiResult.confidence,
          content: aiResult.content,
        },
      },
    });

    console.log(`✅ Document updated: ${updatedDoc?.id}`);
    return aiResult;

  } catch (error) {
    console.error(`❌ Job Failed ${job.id}:`, error);
    
    // Mark DB as failed
    if (job.data.docId) {
      await prisma.document.update({
        where: { id: job.data.docId },
        data: { status: 'failed' },
      });
    }
    throw error;
  }
}, { 
  connection: connection as any, // FIX: Cast to any to resolve ioredis version mismatch
  concurrency: 5 
});