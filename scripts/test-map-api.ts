
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is missing in .env');
    process.exit(1);
}

const query = "강서구";

async function testTextSearch() {
    console.log('\n--- Text Search API Test ---');
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
            params: {
                query: query,
                key: GOOGLE_MAPS_API_KEY,
                language: 'ko',
                region: 'kr',
            }
        });

        console.log(`Status: ${response.data.status}`);
        console.log(`Results count: ${response.data.results.length}`);
        response.data.results.forEach((r: any, i: number) => {
            console.log(`[${i}] ${r.formatted_address} (${r.name}) - ${r.place_id}`);
        });
    } catch (error) {
        console.error('Text Search failed:', error);
    }
}

async function testAutocomplete() {
    console.log('\n--- Autocomplete API Test ---');
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input: query,
                key: GOOGLE_MAPS_API_KEY,
                language: 'ko',
                components: 'country:kr',
                types: 'geocode' // 지명 검색
            }
        });

        console.log(`Status: ${response.data.status}`);
        console.log(`Predictions count: ${response.data.predictions.length}`);
        response.data.predictions.forEach((p: any, i: number) => {
            console.log(`[${i}] ${p.description} - ${p.place_id}`);
        });
    } catch (error) {
        console.error('Autocomplete failed:', error);
    }
}

async function run() {
    console.log(`Testing query: "${query}"`);
    await testTextSearch();
    await testAutocomplete();
}

run();
