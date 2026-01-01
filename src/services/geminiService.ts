import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const analyzeText = async (promptText: string) => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing in .env");

  try {
    // Use the fast 'gemini-pro' model for text
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(promptText);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to analyze text");
  }
};