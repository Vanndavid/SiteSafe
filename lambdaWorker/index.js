const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenAI } = require("@google/genai");

// --- 1. SETUP CLIENTS (From geminiService.ts) ---
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-4", // Default to Melbourne
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const API_BASE_URL = process.env.WORKER_CALLBACK_API_BASE_URL;
const WORKER_CALLBACK_TOKEN = process.env.WORKER_CALLBACK_TOKEN;

function assertCallbackConfig() {
  if (!API_BASE_URL) {
    throw new Error("WORKER_CALLBACK_API_BASE_URL is required");
  }

  if (!WORKER_CALLBACK_TOKEN) {
    throw new Error("WORKER_CALLBACK_TOKEN is required");
  }
}

function markCallbackError(error) {
  error.callbackFailed = true;
  return error;
}

async function reportProcessingResult(docId, payload) {
  assertCallbackConfig();

  const callbackUrl = new URL(
    `/api/internal/documents/${docId}/processing-result`,
    API_BASE_URL
  ).toString();
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-token": WORKER_CALLBACK_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw markCallbackError(new Error(`Worker callback failed with ${response.status}: ${responseText}`));
  }
}

// --- 3. HELPER: Download from S3 (From geminiService.ts) ---
async function getFileFromS3(bucket, key) {
  console.log(`Fetching from S3: ${key}`);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  
  // Convert stream to Buffer (Node.js Stream logic)
  return new Promise((resolve, reject) => {
    const chunks = [];
    response.Body.on("data", (chunk) => chunks.push(chunk));
    response.Body.on("error", reject);
    response.Body.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// --- 4. THE LAMBDA HANDLER (From documentWorker.ts) ---
exports.handler = async (event) => {
  console.log(`Lambda started. Processing ${event.Records.length} records.`);

  // B. Loop through SQS Messages (Replacing the BullMQ 'Worker' loop)
  for (const record of event.Records) {
    let docId = null;

    try {
      // 1. Parse Job Data
      const body = JSON.parse(record.body);
      docId = body.docId;
      const key = body.key;      // S3 Key
      const mimeType = body.mimeType;

      console.log(`Processing job: ${docId}`);

      // 2. Download File (Logic from geminiService)
      // Note: We use the bucket name from ENV, or assume the key is relative
      const bucketName = process.env.AWS_BUCKET_NAME; 
      const fileBuffer = await getFileFromS3(bucketName, key);
      const base64Data = fileBuffer.toString("base64");

      // 3. Configure Model (Logic from geminiService)
      // Uses your Env Var for model, defaults to 1.5-flash if missing
      const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-flash";
      console.log(`Using Gemini Model: ${modelId}`);

      const prompt = `
        You are a strict Compliance Officer. Analyze this image.
        Task:
        1. Identify the Document Type (e.g., White Card, Driver License).
        2. Extract the Expiry Date (YYYY-MM-DD).
        3. Extract the License Number.
        4. Extract the Name.
        5. Extract a brief summary of content.
        
        Output ONLY raw JSON. No markdown.
        Structure: { "type": "string", "expiryDate": "string", "licenseNumber": "string", "name": "string", "confidence": number, "content": "string" }
      `;

      // 4. Call AI (Logic from geminiService)
      const aiResponse = await ai.models.generateContent({
        model: modelId,
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } }
          ]
        }],
        config: { responseMimeType: "application/json" }
      });

      // 5. Parse Response (Logic from geminiService)
      const text = aiResponse.text;
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const aiResult = JSON.parse(cleanJson);

      console.log(`AI analysis complete for ${docId}`);

      // 6. Report result to API. The API is the only service that writes to Postgres.
      await reportProcessingResult(docId, {
        status: "processed",
        extractedData: {
          docType: aiResult.type,
          expiryDate: aiResult.expiryDate,
          licenseNumber: aiResult.licenseNumber,
          holderName: aiResult.name,
          confidence: aiResult.confidence,
          content: aiResult.content,
        },
      });

      console.log(`Document updated: ${docId}`);

    } catch (error) {
      console.error(`Job failed ${docId}:`, error);

      if (error.callbackFailed) {
        throw error;
      }

      // Report processing failure to API. If this callback fails, throw so SQS retries.
      if (docId) {
        await reportProcessingResult(docId, {
          status: "failed",
        });
      }
    }
  }

  return { statusCode: 200, body: "Batch Complete" };
};
