import cron from 'node-cron';
import DocumentModel from '../models/Document';
import NotificationModel from '../models/Notification';

export const startScheduler = () => {
  console.log('⏰ Compliance Scheduler Initialized');

  // Run every 10 seconds for DEMO purposes (In prod: '0 9 * * *')
  cron.schedule('*/10 * * * * *', async () => {
    console.log('🔍 Running Compliance Scan...');
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
    const docs = await DocumentModel.find({ status: 'processed' });

    for (const doc of docs) {
      if (doc.extractedData?.expiryDate) {
        // Parse "YYYY-MM-DD" string to Date
        const expiry = new Date(doc.extractedData.expiryDate);
        
        // Check if expiring soon AND in future
        if (expiry > today && expiry < warningWindow) {
          
          // Check if we already alerted recently (simple dedup)
          const exists = await NotificationModel.findOne({ 
            docId: doc._id, 
            type: 'EXPIRY_WARNING',
          });

          if (!exists) {
            await NotificationModel.create({
              type: 'EXPIRY_WARNING',
              message: `⚠️ Action Required: ${doc.extractedData.docType || 'Document'} expires on ${doc.extractedData.expiryDate}`,
              docId: doc._id
            });
            console.log(`🔔 Generated Alert for ${doc._id}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Scheduler Error:', error);
  }
};