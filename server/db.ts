import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pg = require("pg");
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL or DATABASE_URL must be set. DB will not work.");
} else {
  console.log("Found DB connection string.");
}

export const pool = new Pool({
  connectionString: connectionString || "postgres://dummy:dummy@localhost:5432/dummy",
  max: 1, // Vercel 서버리스 환경에서 연결 수 제한 (MaxClientsInSessionMode 에러 방지)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false
  }
});
export const db = drizzle({ client: pool, schema });
