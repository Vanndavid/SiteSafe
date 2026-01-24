import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

// 1. Initialize AWS SQS Client
// (Notice we don't need a 'connection' file anymore, AWS SDK handles it)
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-southeast-2", // e.g., ap-southeast-2
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// 2. The New "Add Job" Function
// It takes the same arguments so it's easy to swap in your Controller
export const addDocumentJob = async (docId: string, fileKey: string, mimeType: string) => {
  try {
    const command = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        docId: docId,      // The ID of the document in MongoDB
        key: fileKey,      // The S3 Key (was 'filePath' in local version)
        mimeType: mimeType // Needed for Gemini later
      }),
    });

    const response = await sqsClient.send(command);
    console.log(`✅ Job sent to AWS SQS! MessageId: ${response.MessageId}`);
    return response;

  } catch (error) {
    console.error("❌ Failed to send job to SQS:", error);
    throw error;
  }
};