
import 'dotenv/config';
import { db } from '../server/db';
import { plants } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");
// Using a stronger model for debugging
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });

async function run() {
    const plantId = 528; // 블루베리
    const plant = await db.query.plants.findFirst({
        where: eq(plants.id, plantId)
    });

    if (!plant) {
        console.log("Plant not found");
        return;
    }

    console.log(`Processing ${plant.name}...`);
    console.log("Current DB State:", JSON.stringify(plant, null, 2));

    const prompt = `
  Provide detailed botanical data for the plant "${plant.name}" in Korean. 
  You must output a VALID JSON object fitting the following schema.
  
  CRITICAL INSTRUCTION: 
  1. ALL CONTENT MUST BE IN KOREAN (한국어). Translate any technical terms or English text.
  2. Do not leave fields as empty strings "". If unknown, use null.
  3. Ensure 'careInstructions' is detailed and practical for beginners.

  Do not hallucinate. Data must be factual.

  Schema & Formatting Rules:
  - scientificName: Latin scientific name
  - description: 1-2 sentences general description.
  - waterNeeds: Detailed watering advice.
  - light: Light requirements (e.g., 양지, 반양지, 반음지, 음지).
  - humidity: Humidity requirements.
  - temperature: Optimal temperature range (e.g., 21~25℃).
  - winterTemperature: Minimum winter temperature (e.g., 10℃ 이상).
  - colorFeature: Characteristic colors of leaves/flowers.
  - plantType: "관엽식물" (leaf) or "관화식물" (flower) or others.
  - petSafety: "안전" or "주의" (toxicity info).
  - leafShape1: Shape (e.g., 둥근형, 타원형, 갈라짐, 길쭉함).
  - leafShape2: Texture/Thickness (e.g., 두꺼움, 얇음, 윤기남, 거침).
  - leafShape3: Pattern/Surface (e.g., 무늬 없음, 줄무늬, 반점).
  - leafShape4: Edge/Margin (e.g., 밋밋함, 톱니 모양, 웨이브).
  - experienceLevel: "초급자", "중급자", "상급자".
  - difficulty: "쉬움", "보통", "어려움".
  - size: Distribution size (e.g., 소형, 중형, 대형).
  - careInstructions: Comprehensive care guide summary.

  JSON Example:
  {
    "scientific_name": "Strelitzia reginae",
    "description": "...",
    "water_needs": "...",
    "light": "...",
    "humidity": "...",
    "temperature": "...",
    "winter_temperature": "...",
    "color_feature": "...",
    "plant_type": "...",
    "pet_safety": "...",
    "leaf_shape1": "...",
    "leaf_shape2": "...",
    "leaf_shape3": "...",
    "leaf_shape4": "...",
    "experience_level": "...",
    "difficulty": "...",
    "size": "...",
    "care_instructions": "..."
  }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("Raw AI Response:", text);
        const json = JSON.parse(text);

        console.log("Parsed JSON:", JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
