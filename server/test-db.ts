import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL;
console.log("Connecting to:", connectionString);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect().then(client => {
  console.log("Connected successfully!");
  return client.query('SELECT NOW()');
}).then(res => {
  console.log("Query result:", res.rows[0]);
  pool.end();
}).catch(err => {
  console.error("Connection error:", err);
  process.exit(1);
});
