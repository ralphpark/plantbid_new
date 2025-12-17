import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
console.log("API Key present:", !!apiKey);
console.log("Testing Key:", apiKey?.substring(0, 10) + "...");

const genAI = new GoogleGenerativeAI(apiKey || "");

async function testModel(modelName: string) {
  console.log(`\nTesting model: ${modelName}`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, are you working?");
    console.log(`SUCCESS with ${modelName}! Response:`, result.response.text());
    return true;
  } catch (error: any) {
    console.error(`FAILED with ${modelName}:`, error.message);
    return false;
  }
}

async function runTests() {
  // Test the model user requested
  await testModel("gemini-2.0-flash-lite-preview-02-05");
  
  // Test standard fallback
  await testModel("gemini-1.5-flash");
}

runTests();
