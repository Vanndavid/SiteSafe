// this is the SQS Worker that polls the SQS queue for new document processing jobs. This will be repolaced by AWS Lambda in soon future.

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { analyzeDocument } from "../services/geminiService";
import DocumentModel from "../models/Document";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// 1. Setup SQS Client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL!;

// 2. The Worker Logic
export const startWorker = async () => {
  console.log("👷 SQS Worker started! Listening for jobs...");

  // Ensure DB is connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Worker connected to MongoDB");
  }

  // 3. The Infinite Polling Loop
  while (true) {
    try {
      // A. Ask SQS for messages
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,     // Process one at a time
        WaitTimeSeconds: 20,        // "Long Polling" (waits 20s if queue is empty)
        VisibilityTimeout: 60       // Give us 60s to process before showing it to others
      });

      const response = await sqsClient.send(command);

      // B. Check if we got anything
      if (response.Messages && response.Messages.length > 0) {
        const message : any = response.Messages[0];
        console.log(`📦 Received Message: ${message.MessageId}`);

        // C. Parse the Data
        const body = JSON.parse(message.Body!);
        const { docId, key, mimeType } = body; // Matches your Producer

        console.log(`🚀 Processing Document: ${docId}`);

        // D. Call Your Existing AI Service (Phase 1 Code)
        const aiResult = await analyzeDocument(key, mimeType);

        // E. Update Database
        await DocumentModel.findByIdAndUpdate(docId, {
          status: "processed",
          extractedData: aiResult,
          aiSummary: aiResult.summary || "Analyzed by Gemini"
        });

        console.log(`✅ Document ${docId} Saved!`);

        // F. DELETE the message (Critical!)
        // If you don't delete it, SQS thinks you failed and sends it again.
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle
        }));
        console.log("🗑️ Message deleted from Queue");

      } else {
        // Queue is empty, loop restarts immediately (WaitTimeSeconds handles the pause)
      }

    } catch (error) {
      console.error("❌ Worker Error:", error);
      // Wait a bit before retrying to avoid spamming logs if SQS is down
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};