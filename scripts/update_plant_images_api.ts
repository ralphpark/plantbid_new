
import 'dotenv/config';
import { db } from '../server/db';
import { plants } from '../shared/schema';
import { eq, isNull, and } from 'drizzle-orm';
import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('❌ Google API Key or CSE ID is missing in .env');
    process.exit(1);
}

async function searchImage(query: string): Promise<string | null> {
    try {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: GOOGLE_API_KEY,
                cx: GOOGLE_CSE_ID,
                q: query,
                searchType: 'image',
                num: 1,
                safe: 'active',
                imgType: 'photo', // Search for photos
                imgSize: 'large', // Prefer large images
            },
        });

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items[0].link;
        }
    } catch (error: any) {
        console.error(`❌ Error searching for "${query}":`, error.response?.data?.error?.message || error.message);
    }
    return null;
}

async function run() {
    console.log('🌱 Starting Plant Image Automation...');

    // 1. Fetch plants with missing images
    // For testing, let's target specific plants or limit the detailed query
    // To update ALL, remove the limit or specific ID filter
    const targetPlants = await db.select().from(plants).where(isNull(plants.imageUrl));

    console.log(`🎯 Found ${targetPlants.length} plants without images.`);

    for (const plant of targetPlants) {
        console.log(`\n🔍 Processing: ${plant.name}`);

        // Construct search query
        // "Indoor potted {name} plant white background"
        const query = `${plant.name} potted plant indoor white background`;
        console.log(`   Query: "${query}"`);

        const imageUrl = await searchImage(query);

        if (imageUrl) {
            console.log(`   ✅ Found Image: ${imageUrl}`);

            // Update DB
            await db.update(plants)
                .set({ imageUrl: imageUrl })
                .where(eq(plants.id, plant.id));

            console.log(`   💾 Database updated.`);
        } else {
            console.log(`   ⚠️ No image found.`);
        }

        // Be nice to the API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ Automation complete!');
    process.exit(0);
}

run().catch(console.error);
