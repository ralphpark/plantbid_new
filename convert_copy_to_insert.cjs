const fs = require('fs');

const dumpFile = '/Users/ralphpark/plantbid_new/complete_database_dump.sql';
const content = fs.readFileSync(dumpFile, 'utf8');

// Extract plants data
const lines = content.split('\n');
const plantsData = [];

let inPlantsSection = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('COPY public.plants')) {
    inPlantsSection = true;
    continue;
  }
  if (inPlantsSection) {
    if (line === '\\.') {
      break;
    }
    plantsData.push(line);
  }
}

// Convert to INSERT format
const columns = 'id, name, image_url, scientific_name, description, water_needs, light, humidity, temperature, winter_temperature, color_feature, plant_type, has_thorns, leaf_shape1, leaf_shape2, leaf_shape3, leaf_shape4, experience_level, pet_safety, size, difficulty, price_range, care_instructions, category, created_at';

const inserts = [];
for (const row of plantsData) {
  if (!row.trim()) continue;
  const values = row.split('\t').map((val, idx) => {
    if (val === '\\N' || val === '') return 'NULL';
    if (val === 't') return 'true';
    if (val === 'f') return 'false';
    const escaped = val.replace(/'/g, "''").replace(/\\n/g, '\n');
    if (idx === 0 && !isNaN(val)) return val;
    return `'${escaped}'`;
  });
  inserts.push(`(${values.join(', ')})`);
}

// Output batches
const batchSize = 20;
for (let i = 0; i < inserts.length; i += batchSize) {
  const batch = inserts.slice(i, i + batchSize);
  console.log(`-- Batch ${Math.floor(i/batchSize) + 1}`);
  console.log(`INSERT INTO plants (${columns}) VALUES`);
  console.log(batch.join(',\n') + ' ON CONFLICT (id) DO NOTHING;');
  console.log('');
}

console.log(`-- Total plants: ${inserts.length}`);
