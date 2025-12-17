import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Neon Connection (Source)
const neonConnectionString = "postgresql://neondb_owner:npg_va1f2kTblAnw@ep-broad-meadow-a5q87dji.us-east-2.aws.neon.tech/neondb?sslmode=require";
const neonPool = new Pool({ connectionString: neonConnectionString });
const neonDb = drizzle(neonPool, { schema });

// Supabase Connection (Target)
const supabaseConnectionString = "postgresql://postgres.vyqbinpxrlmijfchaqdw:qkrrmstn01!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";
const supabasePool = new Pool({ 
  connectionString: supabaseConnectionString,
  ssl: { rejectUnauthorized: false }
});
const supabaseDb = drizzle(supabasePool, { schema });

async function migrateTable(tableName: string, tableObj: any, dependencyOrder: string[] = []) {
  console.log(`Migrating ${tableName}...`);
  try {
    // Read from Neon
    // Using raw SQL for flexibility or drizzle query
    // Drizzle query is safer for types
    
    // We need to query *all* columns. Drizzle select() selects all by default.
    const data = await neonDb.select().from(tableObj);
    console.log(`Read ${data.length} rows from ${tableName} (Neon)`);

    if (data.length === 0) return;

    // Insert into Supabase
    // We need to insert in chunks to avoid query size limits
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      // We must explicitly set IDs. Drizzle insert includes ID if present in the object.
      await supabaseDb.insert(tableObj).values(chunk).onConflictDoNothing();
    }
    console.log(`Inserted ${data.length} rows into ${tableName} (Supabase)`);
    
    // Reset sequence
    // This is important so new inserts don't collide with migrated IDs
    // We can assume ID column is 'id' for most tables
    if (data.length > 0) {
        try {
            await supabaseDb.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), (SELECT MAX(id) FROM ${tableName}));`));
            console.log(`Updated sequence for ${tableName}`);
        } catch (e) {
            console.log(`Skipping sequence update for ${tableName} (might not have serial id)`);
        }
    }

  } catch (error) {
    console.error(`Error migrating ${tableName}:`, error);
    throw error;
  }
}

async function main() {
  console.log("Starting migration...");
  
  try {
    // 1. Users
    await migrateTable('users', schema.users);
    
    // 2. Site Settings
    await migrateTable('site_settings', schema.siteSettings);
    
    // 3. Plants
    await migrateTable('plants', schema.plants);
    
    // 4. AI Settings
    await migrateTable('ai_settings', schema.aiSettings);
    
    // 5. Vendors
    await migrateTable('vendors', schema.vendors);
    
    // 6. Store Locations
    await migrateTable('store_locations', schema.storeLocations);
    
    // 7. Products
    await migrateTable('products', schema.products);
    
    // 8. Conversations
    await migrateTable('conversations', schema.conversations);
    
    // 9. Bids
    await migrateTable('bids', schema.bids);
    
    // 10. Payments
    await migrateTable('payments', schema.payments);
    
    // 11. Orders
    await migrateTable('orders', schema.orders);
    
    // 12. Reviews
    await migrateTable('reviews', schema.reviews);
    
    // 13. Notifications
    await migrateTable('notifications', schema.notifications);
    
    // 14. Cart Items
    await migrateTable('cart_items', schema.cartItems);
    
    // 15. Password Reset Tokens
    await migrateTable('password_reset_tokens', schema.passwordResetTokens);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await neonPool.end();
    await supabasePool.end();
  }
}

main();
