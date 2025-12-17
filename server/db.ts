import pg from 'pg';
const { Pool } = pg as any;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DB_URL or DATABASE_URL must be set.");
}

export const pool = new Pool({ 
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
export const db = drizzle({ client: pool, schema });
