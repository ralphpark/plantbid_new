import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("🔒 Starting RLS Security Application...");

    const allTables = [
        "users",
        "password_reset_tokens",
        "plants",
        "vendors",
        "bids",
        "conversations",
        "products",
        "store_locations",
        "payments",
        "orders",
        "cart_items",
        "notifications",
        "site_settings",
        "reviews",
        "ai_settings",
        "session" // Include session table if it exists
    ];

    // Tables that should be publicly readable
    const publicReadTables = [
        "plants",
        "vendors",
        "products",
        "store_locations",
        "reviews",
        "site_settings",
        "ai_settings" // Often settings might be needed publicly or semi-publicly
    ];

    for (const table of allTables) {
        try {
            console.log(`🛡️  Enabling RLS on '${table}'...`);
            await db.execute(sql.raw(`ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`));

            // Default: Deny all for anon/authenticated (implicit in RLS) unless policy exists
            // Backend connects as postgres/admin, so it BYPASSES RLS.
        } catch (e) {
            console.error(`❌ Failed to enable RLS on ${table}:`, e);
        }
    }

    for (const table of publicReadTables) {
        try {
            console.log(`🔓 Creating Public Read Policy for '${table}'...`);
            // Drop existing policy to ensure idempotency
            await db.execute(sql.raw(`DROP POLICY IF EXISTS "Public Read Access" ON "${table}";`));
            // Create 'SELECT' policy for 'anon' role
            await db.execute(sql.raw(`CREATE POLICY "Public Read Access" ON "${table}" FOR SELECT TO anon, authenticated USING (true);`));
        } catch (e) {
            console.error(`❌ Failed to set policy on ${table}:`, e);
        }
    }

    console.log("✅ RLS Application Complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
