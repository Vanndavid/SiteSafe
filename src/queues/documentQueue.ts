import { Queue } from 'bullmq';
import connection from '../config/redis';

// Define the Queue Name
export const DOCUMENT_QUEUE_NAME = 'document-analysis';

// Initialize the Queue
export const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, { 
  connection:  connection as any 
});

// Helper to add jobs easily
export const addDocumentJob = async (docId: string, filePath: string, mimeType: string) => {
  await documentQueue.add('analyze', {
    docId,
    filePath,
    mimeType
  });
  console.log(`📥 Job added to queue: ${docId}`);
};