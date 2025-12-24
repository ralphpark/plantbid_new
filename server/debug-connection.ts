import pg from 'pg';
const { Pool } = pg;

const targetUrl = 'postgresql://postgres:qkrrmstn01%21@db.pedvuushezoazgvkgntg.supabase.co:5432/postgres';

async function testConnection() {
    console.log("Testing connection configuration:");
    // Mask password for logging
    console.log(targetUrl.replace(/:([^:@]+)@/, ':****@'));

    const pool = new Pool({
        connectionString: targetUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // 5s timeout
    });

    try {
        const client = await pool.connect();
        console.log("Successfully connected to database!");
        const res = await client.query('SELECT NOW()');
        console.log("Current DB Time:", res.rows[0]);
        client.release();
    } catch (err: any) {
        console.error("Connection failed:", err.message);
        console.error("Error Code:", err.code);
        if (err.message.includes("Tenant or user not found")) {
            console.error("Suggestion: Check if project Ref is correct or if database password contains special characters needing encoding.");
        }
    } finally {
        await pool.end();
    }
}

testConnection();
