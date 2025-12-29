const fs = require('fs');
const content = fs.readFileSync('/Users/ralphpark/plantbid_new/plants_inserts.sql', 'utf8');
const batchNum = parseInt(process.argv[2]);

// Split by batch markers
const batches = content.split(/-- Batch \d+\n/).filter(b => b.trim() && b.includes('INSERT'));

if (batchNum > 0 && batchNum <= batches.length) {
  console.log(batches[batchNum - 1].trim());
}
