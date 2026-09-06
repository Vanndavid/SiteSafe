// src/services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

// 1. Initialize Clients
const ai = new GoogleGenAI({});

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper: Convert S3 Stream to Buffer
const streamToBuffer = (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

export const analyzeDocument = async (filePathOrKey: string, mimeType: string) => {
  try {
    let fileBuffer: Buffer;
    console.log(`Starting analysis for file: ${filePathOrKey} with MIME type: ${mimeType}`);
    // 2. LOGIC: Check if file is in S3 or Local
    // If it starts with 'uploads/' and does NOT exist locally, fetch from S3
    if (filePathOrKey.startsWith("uploads/") && !fs.existsSync(filePathOrKey)) {
        console.log(`Fetching from S3: ${filePathOrKey}`);
        
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filePathOrKey
        });
        
        try {
            const s3Response = await s3.send(command);
            fileBuffer = await streamToBuffer(s3Response.Body);
        } catch (s3Error) {
            console.error("S3 download error:", s3Error);
            throw new Error(`Could not find file in S3: ${filePathOrKey}`);
        }

    } else {
        // Fallback: Read from Local Disk (Legacy/Dev mode)
        console.log(`Reading from local disk: ${filePathOrKey}`);
        if (!fs.existsSync(filePathOrKey)) throw new Error(`File not found locally: ${filePathOrKey}`);
        fileBuffer = fs.readFileSync(filePathOrKey);
    }

    // 3. Prepare Base64
    const base64Data = fileBuffer.toString("base64");

    // 4. Configure Model (Using stable 1.5-flash or 2.0-flash)
    // Note: 'gemini-2.5-flash' might not exist yet. Using 'gemini-1.5-flash' for safety.
    const modelId = "gemini-2.5-flash"; 
    console.log(`Using Gemini Model: ${modelId}`);

    const prompt = `
      You are a strict Compliance Officer. Analyze this document.

      Task:
      1. Identify the Document Type (e.g., White Card, Driver License).
      2. Extract the Expiry Date (YYYY-MM-DD).
      3. Extract the License Number.
      4. Extract the Name.
      5. Extract a brief summary of content.
      6. Transcribe the full text of every page, verbatim, in "pages".
         Preserve each label and its value on the same line (e.g. "Expiry Date: 2027-03-14").
         Number pages from 1. This transcription is what question answering reads,
         so do not summarise, reorder, or omit anything from it.

      Output ONLY raw JSON. No markdown.
      Structure: { "type": "string", "expiryDate": "string", "licenseNumber": "string", "name": "string", "confidence": number, "content": "string", "pages": [{ "page": number, "text": "string" }] }
    `;

    // 5. Call AI
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    // 6. Parse Response
    // The new SDK handles the text extraction cleaner
    const text = response.text; 
    const cleanJson = text?.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!cleanJson) throw new Error("Empty response from AI");

    return JSON.parse(cleanJson);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI Analysis Failed: ${error.message}`);
  }
};