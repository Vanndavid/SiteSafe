import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// The new SDK automatically picks up GEMINI_API_KEY from process.env
const ai = new GoogleGenAI({});

export const analyzeDocument = async (filePath: string, mimeType: string) => {
  try {
    // Use the latest stable model
    const modelId = "gemini-2.5-flash"; 

    console.log(`Using Gemini Model: ${modelId}`);

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    const prompt = `
      You are a strict Compliance Officer. Analyze this image.
      
      Task:
      1. Identify the Document Type (e.g., White Card, Driver License).
      2. Extract the Expiry Date (YYYY-MM-DD).
      3. Extract the License Number.
      4. Extract the Name.
      4. Extract the content.
      
      Output ONLY raw JSON. No markdown.
      Structure: { "type": "string", "expiryDate": "string", "licenseNumber": "string", "name": "string", "confidence": number, "content": "string" }
    `;

    // New SDK syntax for generating content
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
        responseMimeType: "application/json", // Force JSON output
      },
    });

    // The new SDK returns the text directly via .text() or raw structure
    const text = response.text;
    
    // Clean up if necessary (though responseMimeType usually handles it)
    const cleanJson = text?.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!cleanJson) throw new Error("Empty response from AI");

    return JSON.parse(cleanJson);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI Analysis Failed: ${error.message}`);
  }
};