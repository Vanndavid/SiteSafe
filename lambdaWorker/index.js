const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenAI } = require("@google/genai");
const { Pool } = require("pg");

// --- 1. SETUP CLIENTS (From geminiService.ts) ---
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-4", // Default to Melbourne
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- 3. HELPER: Download from S3 (From geminiService.ts) ---
async function getFileFromS3(bucket, key) {
  console.log(`☁️ Fetching from S3: ${key}`);
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
  console.log(`🚀 Lambda Woke Up. Processing ${event.Records.length} records.`);

  // A. Connect to PostgreSQL (Reuse connection)
  // In a real Lambda environment, you might want to manage the connection pool differently
  // This is a simplified approach for demonstration purposes


  // B. Loop through SQS Messages (Replacing the BullMQ 'Worker' loop)
  for (const record of event.Records) {
    let docId = null;

    try {
      // 1. Parse Job Data
      const body = JSON.parse(record.body);
      docId = body.docId;
      const key = body.key;      // S3 Key
      const mimeType = body.mimeType;

      console.log(`⚙️ Processing Job: ${docId}`);

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

      console.log(`🧠 AI Analysis Complete for ${docId}`);

      // 6. Update Database (Logic from documentWorker.ts)
      await pool.query(
        `
        UPDATE "Document"
        SET status = $1, "extractedData" = $2
        WHERE id = $3
        `,
        [
          "processed",
          JSON.stringify({
            docType: aiResult.type,
            expiryDate: aiResult.expiryDate,
            licenseNumber: aiResult.licenseNumber,
            holderName: aiResult.name,
            confidence: aiResult.confidence,
            content: aiResult.content,
          }),
          docId,
        ]
      );

      console.log(`✅ Document updated: ${docId}`);

    } catch (error) {
      console.error(`❌ Job Failed ${docId}:`, error);

      // Mark DB as failed (Logic from documentWorker.ts)
      if (docId) {
        await pool.query(
          `
          UPDATE "Document"
          SET status = $1
          WHERE id = $2
          `,
          [
            "failed",
            docId
          ]
        );
      }
      
      // OPTIONAL: If you want SQS to retry the message later (e.g. API limit), 
      // uncomment the line below. If you want to delete it and move on, leave it commented.
      // throw error; 
    }
  }

  return { statusCode: 200, body: "Batch Complete" };
};