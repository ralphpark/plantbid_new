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

const poolConfig = {
  connectionString: connectionString || "postgres://dummy:dummy@localhost:5432/dummy",
  max: 1, // Vercel 서버리스 환경에서 연결 수 제한
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false
  }
};

// Supabase의 경우 서버리스 환경에서는 Transaction Mode(6543 포트) 사용 권장
// 사용자가 5432(Session Mode)를 설정했더라도 코드로 6543으로 변환 시도
if (poolConfig.connectionString.includes('supabase.com') && poolConfig.connectionString.includes(':5432')) {
  console.log('🔧 [DB 설정 자동 최적화] Serverless 환경 감지: Session Mode(5432) -> Transaction Mode(6543)으로 포트 변경');
  poolConfig.connectionString = poolConfig.connectionString.replace(':5432', ':6543');
}

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });
