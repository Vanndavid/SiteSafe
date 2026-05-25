import cron from 'node-cron';
import prisma from '../config/prisma';
import type { ExtractedDocumentData } from '../models/Document';

export const startScheduler = () => {
  console.log('Compliance scheduler initialized');

  // Run every 10 seconds for DEMO purposes (In prod: '0 9 * * *')
  cron.schedule('*/10 * * * * *', async () => {
    console.log('Running compliance scan...');
    await checkExpiringDocuments();
  });
};

const checkExpiringDocuments = async () => {
  try {
    const today = new Date();
    const warningWindow = new Date();
    warningWindow.setDate(today.getDate() + 90); // Warn if expires in next 90 days

    // Find processed documents that are not yet flagged
    // (In a real app, you'd track 'lastNotified' to avoid spamming)
    const docs = await prisma.document.findMany({
      where: {
        status: 'processed'
      }
    });

    for (const doc of docs) {
      // Prisma stores Json as a broad type; narrow it to our interface
      const extractedData = doc.extractedData as ExtractedDocumentData | null;

      if (extractedData?.expiryDate) {
        // Parse "YYYY-MM-DD" string to Date
        const expiry = new Date(extractedData.expiryDate);
        
        // Check if expiring soon AND in future
        if (expiry > today && expiry < warningWindow) {
          
          // Check if we already alerted recently (simple dedup)
          const exists = await prisma.notification.findFirst({
            where: {
              docId: doc.id,
              type: 'EXPIRY_WARNING'
            }
          });

          if (!exists) {
            await prisma.notification.create({
              data: {
                type: 'EXPIRY_WARNING',
                message: `Action Required: ${extractedData?.docType || 'Document'} expires on ${extractedData?.expiryDate}`,
                docId: doc.id,
                userId: doc.userId,
              },
            });
            console.log(`🔔 Generated Alert for ${doc._id}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
};