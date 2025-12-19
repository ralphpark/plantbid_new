
import 'dotenv/config';
import { db } from '../server/db';
import { plants } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");
// Use flash model for better performance
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });

async function getPlantDetails(plantName: string) {
    const prompt = `
  Provide detailed botanical data for the plant "${plantName}" in Korean. 
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
    "scientificName": "Strelitzia reginae",
    "description": "...",
    "waterNeeds": "...",
    "light": "...",
    "humidity": "...",
    "temperature": "...",
    "winterTemperature": "...",
    "colorFeature": "...",
    "plantType": "...",
    "petSafety": "...",
    "leafShape1": "...",
    "leafShape2": "...",
    "leafShape3": "...",
    "leafShape4": "...",
    "experienceLevel": "...",
    "difficulty": "...",
    "size": "...",
    "careInstructions": "..."
  }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed)) {
            return parsed[0];
        }
        return parsed;
    } catch (error) {
        console.error(`AI Error for ${plantName}:`, error);
        return null;
    }
}

// Helper to check if a field needs updating
function needsUpdate(currentValue: string | null | undefined, checkEnglish: boolean = false): boolean {
    if (currentValue === null || currentValue === undefined) return true;
    const v = String(currentValue).trim();
    if (v === '' || v === 'EMPTY') return true;

    // Only verify Korean requirements for specific fields
    // Allow Latin/English characters in general unless strictly specified
    if (checkEnglish && /[a-zA-Z]/.test(v)) return true;

    return false;
}

async function run() {
    console.log('🌱 Starting Plant Details Enrichment (Strict Merge Mode)...');

    const allPlants = await db.select().from(plants);

    // Filter logic remains the same: find plants that have ANY bad field
    const targetPlants = allPlants.filter(p => {
        // 1. Check for NULL or Empty strings or 'EMPTY' literal
        const missingScientificName = !p.scientificName || p.scientificName.trim() === '' || p.scientificName === 'EMPTY';
        const missingLeafShape = !p.leafShape1 || p.leafShape1.trim() === '' || p.leafShape1 === 'EMPTY';
        const missingExperience = !p.experienceLevel || p.experienceLevel.trim() === '' || p.experienceLevel === 'EMPTY';
        const missingPetSafety = !p.petSafety || p.petSafety.trim() === '' || p.petSafety === 'EMPTY';

        // 2. Check for English text in fields that should be Korean
        const englishPetSafety = p.petSafety && /[a-zA-Z]/.test(p.petSafety);
        const englishExperience = p.experienceLevel && /[a-zA-Z]/.test(p.experienceLevel);

        return missingScientificName || missingLeafShape || missingExperience || missingPetSafety || englishPetSafety || englishExperience;
    });

    console.log(`🎯 Found ${targetPlants.length} plants with missing/invalid data.`);

    for (const plant of targetPlants) {
        console.log(`\n🔍 Processing: ${plant.name} (ID: ${plant.id})`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const details = await getPlantDetails(plant.name);

        if (details) {
            const updates: any = {};

            // Extract AI values with fallback key handling
            const newSciName = details.scientificName || details.scientific_name;
            const newDesc = details.description;
            const newWater = details.waterNeeds || details.water_needs;
            const newLight = details.light;
            const newHum = details.humidity;
            const newTemp = details.temperature;
            const newWinter = details.winterTemperature || details.winter_temperature;
            const newColor = details.colorFeature || details.color_feature;
            const newType = details.plantType || details.plant_type;
            const newPet = details.petSafety || details.pet_safety;
            const newL1 = details.leafShape1 || details.leaf_shape1;
            const newL2 = details.leafShape2 || details.leaf_shape2;
            const newL3 = details.leafShape3 || details.leaf_shape3;
            const newL4 = details.leafShape4 || details.leaf_shape4;
            const newExp = details.experienceLevel || details.experience_level;
            const newDiff = details.difficulty;
            const newSize = details.size;
            const newCare = details.careInstructions || details.care_instructions;

            // STRICT MERGE LOGIC:
            // Only add to 'updates' if the CURRENT DB value is bad (needsUpdate returns true)
            // AND the NEW value is valid.

            if (needsUpdate(plant.scientificName) && newSciName) updates.scientificName = newSciName;
            if (needsUpdate(plant.description) && newDesc) updates.description = newDesc;
            if (needsUpdate(plant.waterNeeds) && newWater) updates.waterNeeds = newWater;
            if (needsUpdate(plant.light) && newLight) updates.light = newLight;
            if (needsUpdate(plant.humidity) && newHum) updates.humidity = newHum;
            if (needsUpdate(plant.temperature) && newTemp) updates.temperature = newTemp;
            if (needsUpdate(plant.winterTemperature) && newWinter) updates.winterTemperature = newWinter;
            if (needsUpdate(plant.colorFeature) && newColor) updates.colorFeature = newColor;
            if (needsUpdate(plant.plantType) && newType) updates.plantType = newType;

            // Check English for these specific fields
            if (needsUpdate(plant.petSafety, true) && newPet) updates.petSafety = newPet;
            if (needsUpdate(plant.experienceLevel, true) && newExp) updates.experienceLevel = newExp;

            if (needsUpdate(plant.leafShape1) && newL1) updates.leafShape1 = newL1;
            if (needsUpdate(plant.leafShape2) && newL2) updates.leafShape2 = newL2;
            if (needsUpdate(plant.leafShape3) && newL3) updates.leafShape3 = newL3;
            if (needsUpdate(plant.leafShape4) && newL4) updates.leafShape4 = newL4;

            if (needsUpdate(plant.difficulty) && newDiff) updates.difficulty = newDiff;
            if (needsUpdate(plant.size) && newSize) updates.size = newSize;
            if (needsUpdate(plant.careInstructions) && newCare) updates.careInstructions = newCare;

            const fieldsUpdating = Object.keys(updates);
            if (fieldsUpdating.length > 0) {
                console.log(`   ✅ Updating specific fields: [${fieldsUpdating.join(', ')}]`);
                try {
                    await db.update(plants)
                        .set(updates)
                        .where(eq(plants.id, plant.id));
                    console.log(`   💾 Saved.`);
                } catch (dbError) {
                    console.error(`   ❌ DB Update Failed:`, dbError);
                }
            } else {
                console.log(`   ℹ️ No invalid fields found to replace for this plant (or AI return was empty for targets). Logic preserved existing data.`);
            }

        } else {
            console.log(`   ⚠️ Failed to generate details.`);
        }
    }

    console.log('\n✨ Details enrichment complete!');
    process.exit(0);
}

run().catch(console.error);
