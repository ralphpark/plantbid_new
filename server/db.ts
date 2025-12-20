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
  ssl: {
    rejectUnauthorized: false
  }
});
export const db = drizzle({ client: pool, schema });
