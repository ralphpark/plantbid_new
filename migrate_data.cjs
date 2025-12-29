// Script to help migrate data between Supabase projects
const fs = require('fs');

// Read plants data and convert to INSERT statements
const plantsData = JSON.parse(process.argv[2] || '[]');

const escapeValue = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return val;
  // Escape single quotes
  return "'" + String(val).replace(/'/g, "''") + "'";
};

const columns = Object.keys(plantsData[0] || {}).join(', ');

plantsData.forEach((row, i) => {
  const values = Object.values(row).map(escapeValue).join(', ');
  console.log(`INSERT INTO plants (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url, scientific_name = EXCLUDED.scientific_name, description = EXCLUDED.description;`);
});
