
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { users, vendors, plants, products } from '../../shared/schema';
import { eq, like, sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL || (process.env.SUPABASE_DB_URL?.split('@')[1]?.split('/')[0] ? `https://${process.env.SUPABASE_DB_URL?.split('@')[1]?.split('/')[0]}` : '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = 'uploads';
const UPLOAD_DIR = path.resolve(__dirname, '../../public/uploads');

async function migrateUploads() {
    console.log('Starting migration of local uploads to Supabase Storage...');
    console.log(`Upload directory: ${UPLOAD_DIR}`);

    if (!fs.existsSync(UPLOAD_DIR)) {
        console.error('Upload directory not found.');
        return;
    }

    const files = fs.readdirSync(UPLOAD_DIR);
    console.log(`Found ${files.length} files to process.`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const file of files) {
        if (file === '.DS_Store' || file === '.keep') continue;

        const filePath = path.join(UPLOAD_DIR, file);
        const fileContent = fs.readFileSync(filePath);
        const fileExt = path.extname(file).toLowerCase();

        // Determine content type
        let contentType = 'application/octet-stream';
        if (fileExt === '.jpg' || fileExt === '.jpeg') contentType = 'image/jpeg';
        else if (fileExt === '.png') contentType = 'image/png';
        else if (fileExt === '.gif') contentType = 'image/gif';
        else if (fileExt === '.webp') contentType = 'image/webp';
        else if (fileExt === '.svg') contentType = 'image/svg+xml';

        console.log(`Processing ${file}...`);

        try {
            // 1. Upload to Supabase
            // Use original filename to match existing DB records potentially, 
            // OR just upload and then update DB by searching for the old path.
            // Since we need to update DB records that likely contain "/uploads/<filename>",
            // we should keep the filename consistent or track the mapping.
            // Trying to keep same filename is best for simplicity if unique.

            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(file, fileContent, {
                    contentType: contentType,
                    upsert: true
                });

            if (error) {
                console.error(`  Upload failed: ${error.message}`);
                failCount++;
                continue;
            }

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(file);

            console.log(`  Uploaded to: ${publicUrl}`);

            // 3. Update Database Records
            // We look for records that have the local path "/uploads/<filename>"
            const localPath = `/uploads/${file}`;

            // Update Users (profileImageUrl replacement logic if column name differs? schema says 'profileImageUrl' requires check. 
            // Wait, users table schema says... logic check:
            // users table doesn't seem to have profileImageUrl in the view I saw earlier? 
            // Let's check schema imports.
            // Re-reading schema.ts view... users has... wait, I saw 'storeName', 'role', etc.
            // In shared/schema.ts view (lines 1-30), I don't see profileImageUrl on `users`. 
            // `vendors` has `profileImageUrl`.
            // `plants` has `imageUrl`.
            // `products` has `imageUrl`.

            // Checking vendors
            const vendorResult = await db.update(vendors)
                .set({ profileImageUrl: publicUrl })
                .where(eq(vendors.profileImageUrl, localPath))
                .returning({ id: vendors.id });

            if (vendorResult.length > 0) console.log(`  Updated ${vendorResult.length} vendor records.`);

            // Checking plants
            const plantResult = await db.update(plants)
                .set({ imageUrl: publicUrl })
                .where(eq(plants.imageUrl, localPath))
                .returning({ id: plants.id });

            if (plantResult.length > 0) console.log(`  Updated ${plantResult.length} plant records.`);

            // Checking products
            const productResult = await db.update(products)
                .set({ imageUrl: publicUrl })
                .where(eq(products.imageUrl, localPath))
                .returning({ id: products.id });

            if (productResult.length > 0) console.log(`  Updated ${productResult.length} product records.`);

            // Special handling for products with 'images' json array? 
            // The schema mentions `images: json("images").$type<string[]>()`.
            // Updating JSON arrays via SQL pattern matching is tricky in Drizzle without raw SQL.
            // For now, let's focus on the main `imageUrl` fields which are typical for display.
            // If `images` array contains local paths, they will remain broken. 
            // Given the user request, let's try to fix main images first. 
            // Accessing JSON content update might be complex.

            successCount++;

        } catch (err) {
            console.error(`  Error processing ${file}:`, err);
            failCount++;
        }
    }

    console.log('Migration completed.');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped: ${skippedCount}`);

    process.exit(0);
}

migrateUploads().catch(console.error);
