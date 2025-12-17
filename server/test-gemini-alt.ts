import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Try the GOOGLE_API_KEY from the image
const apiKey = "AIzaSyBw5j-9dSQp6046P9W-DnoajI0tqeChmcE";
console.log("Testing with GOOGLE_API_KEY:", apiKey);

const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello, are you working?");
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-flash:", error);
  }
}

test();
