import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { analyzeDocument } from "../services/geminiService";
import DocumentModel from "../models/Document";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// 1. Setup AWS SQS Client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL!;

export const startWorker = async () => {
  console.log("👷 SQS Worker Started. Listening for jobs...");

  // Ensure DB is connected (Reuse your existing logic)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Worker Connected to MongoDB");
  }

  // 2. The Infinite Loop (Replaces 'new Worker')
  while (true) {
    try {
      // A. Ask SQS for a job
      const receiveParams = {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, // Long Polling (Efficient)
      };

      const { Messages } = await sqsClient.send(new ReceiveMessageCommand(receiveParams));

      // B. If no messages, loop again
      if (!Messages || Messages.length === 0) {
        continue;
      }

      // C. Process the Message
      const message:any = Messages[0];
      const receiptHandle = message.ReceiptHandle;
      
      console.log(`⚙️ Processing Message ID: ${message.MessageId}`);

      // --- YOUR ORIGINAL LOGIC STARTS HERE ---
      try {
        // 1. Parse Data (Replaces 'job.data')
        // Note: The producer sends 'key', your old code used 'filePath'. 
        // We map 'key' to 'filePath' so your logic stays the same.
        const body = JSON.parse(message.Body!);
        const { docId, key, mimeType } = body; 
        const filePath = key; // Alias for compatibility

        console.log(`Processing Doc ID: ${docId}`);

        // 2. Analyze with Gemini (Exactly as before)
        const aiResult = await analyzeDocument(filePath, mimeType);
        console.log(`🧠 AI Analysis Complete for ${docId}`);

        // 3. Update Database (Exactly as before)
        const updatedDoc = await DocumentModel.findByIdAndUpdate(
          docId,
          {
            status: 'processed',
            extractedData: {
              docType: aiResult.type,
              expiryDate: aiResult.expiryDate,
              licenseNumber: aiResult.licenseNumber,
              holderName: aiResult.name,
              confidence: aiResult.confidence,
              content: aiResult.content
            }
          },
          { new: true }
        );

        console.log(`✅ Document updated: ${updatedDoc?._id}`);

        // 4. DELETE Message (Success!)
        // SQS doesn't auto-delete. We must tell it we are done.
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: receiptHandle
        }));
        console.log("🗑️ Job removed from Queue");

      } catch (processingError) {
        // --- ERROR HANDLING (From your old code) ---
        console.error(`❌ Job Failed:`, processingError);

        // Mark DB as failed
        const body = JSON.parse(message.Body!); // Re-parse safely to get ID
        if (body.docId) {
          await DocumentModel.findByIdAndUpdate(body.docId, { 
            status: 'failed' 
          });
        }
        
        // Note: We do NOT delete the message here. 
        // SQS will eventually make it visible again for a retry (VisibilityTimeout).
      }
      // --- END ORIGINAL LOGIC ---

    } catch (networkError) {
      console.error("❌ SQS Network Error:", networkError);
      // Wait 5s before retrying connection to avoid spamming logs
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};