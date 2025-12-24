import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Helper to get connection strings securely
const getSourceDbUrl = () => {
    // Current .env DATABASE_URL is assumed to be the SOURCE (India)
    const url = process.env.SOURCE_DB_URL || process.env.DATABASE_URL;
    if (!url) throw new Error("SOURCE_DB_URL or DATABASE_URL is required (Source DB)");
    return url;
};

const getTargetDbUrl = () => {
    // Target (Seoul) must be provided
    const url = process.env.TARGET_DB_URL;
    if (!url) throw new Error("TARGET_DB_URL is required (Target Seoul DB). Please add it to .env or export it.");
    return url;
};

async function createConnections() {
    const sourceUrl = getSourceDbUrl();
    const targetUrl = getTargetDbUrl();

    console.log("🔌 Connecting to SOURCE DB...");
    const sourcePool = new Pool({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
    const sourceDb = drizzle(sourcePool, { schema });

    console.log("🔌 Connecting to TARGET DB...");
    const targetPool = new Pool({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
    const targetDb = drizzle(targetPool, { schema });

    return { sourcePool, sourceDb, targetPool, targetDb };
}

async function migrateTable(
    sourceDb: ReturnType<typeof drizzle>,
    targetDb: ReturnType<typeof drizzle>,
    tableName: string,
    tableObj: any
) {
    console.log(`\n📦 Migrating table: ${tableName}...`);
    try {
        // 1. Read from Source
        // @ts-ignore
        const data = await sourceDb.select().from(tableObj);
        console.log(`   - Found ${data.length} rows in Source.`);

        if (data.length === 0) {
            console.log(`   - Skipping insertion (empty).`);
            return;
        }

        // 2. Insert into Target (Batched)
        const batchSize = 50; // Conservative batch size
        let insertedCount = 0;

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            // Use onConflictDoNothing to skip already migrated rows
            // @ts-ignore
            await targetDb.insert(tableObj).values(batch).onConflictDoNothing().execute();
            insertedCount += batch.length;
            process.stdout.write(`   - Progress: ${Math.min(insertedCount, data.length)}/${data.length}\r`);
        }
        console.log(`   - ✅ Inserted/Synced ${data.length} rows.`);

        // 3. Reset Sequence (Important for Postgres SERIAL/IDENTITY)
        try {
            // Attempt to reset sequence for 'id' column if it exists
            await targetDb.execute(sql.raw(`
                SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1));
            `));
            console.log(`   - 🔢 Sequence reset for '${tableName}'.`);
        } catch (e: any) {
            // Ignore if table doesn't have a serial id or seq
            // console.log(`   - (Note: Sequence update skipped/failed - might be UUID or non-serial: ${e.message})`);
        }

    } catch (error) {
        console.error(`❌ Error migrating ${tableName}:`, error);
        throw error;
    }
}

async function main() {
    console.log("🚀 Starting Inter-Region Migration (India -> Seoul)");
    console.log("-----------------------------------------------");

    let pools;
    try {
        pools = await createConnections();
        const { sourceDb, targetDb } = pools;

        // Migration Order (Respecting Foreign Keys)
        // 1. Core Users & Config
        await migrateTable(sourceDb, targetDb, 'users', schema.users);
        await migrateTable(sourceDb, targetDb, 'site_settings', schema.siteSettings);

        // 2. Plants & Content
        await migrateTable(sourceDb, targetDb, 'plants', schema.plants);
        await migrateTable(sourceDb, targetDb, 'ai_settings', schema.aiSettings);

        // 3. Commerce (Vendors -> Locations -> Products)
        await migrateTable(sourceDb, targetDb, 'vendors', schema.vendors);
        await migrateTable(sourceDb, targetDb, 'store_locations', schema.storeLocations);
        await migrateTable(sourceDb, targetDb, 'products', schema.products);

        // 4. Interactions
        await migrateTable(sourceDb, targetDb, 'conversations', schema.conversations);
        await migrateTable(sourceDb, targetDb, 'bids', schema.bids);

        // 5. Orders & Payments
        await migrateTable(sourceDb, targetDb, 'orders', schema.orders); // Orders usually come before payments or vice versa depending on FK. Accessing schema... usually orders first if payments link to orders.
        await migrateTable(sourceDb, targetDb, 'payments', schema.payments);

        // 6. User Feedback & Misc
        await migrateTable(sourceDb, targetDb, 'reviews', schema.reviews);
        await migrateTable(sourceDb, targetDb, 'notifications', schema.notifications);
        await migrateTable(sourceDb, targetDb, 'cart_items', schema.cartItems);
        await migrateTable(sourceDb, targetDb, 'password_reset_tokens', schema.passwordResetTokens);

        console.log("\n✨ Migration Completed Successfully!");
        console.log("👉 Next Step: Update your .env DATABASE_URL to the TARGET_DB_URL.");

    } catch (error) {
        console.error("\n💥 Migration Failed:", error);
        process.exit(1);
    } finally {
        if (pools) {
            await pools.sourcePool.end();
            await pools.targetPool.end();
        }
    }
}

main();
