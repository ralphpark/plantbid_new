import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pg = require("pg");
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL or DATABASE_URL must be set. DB will not work.");
} else {
  console.log("Found DB connection string.");

  // Fix: Clean connection string of sslmode parameters to prevent conflict with explicit SSL config
  // This resolves 'SELF_SIGNED_CERT_IN_CHAIN' errors when using Supabase Poolers
  // Fix: Clean connection string of sslmode parameters to prevent conflict with explicit SSL config
  // This resolves 'SELF_SIGNED_CERT_IN_CHAIN' errors when using Supabase Poolers
  try {
    const url = new URL(connectionString);
    if (url.searchParams.has('sslmode')) {
      console.log("🔧 Removing sslmode param from connection string to force rejectUnauthorized:false");
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    }
  } catch (err) {
    console.error("Error parsing connection string:", err);
    // Fallback to minimal replacement if URL parsing fails
    if (connectionString.includes('sslmode=')) {
      connectionString = connectionString.replace(/([?&])sslmode=[^&]*/g, '');
    }
  }
}

const poolConfig = {
  connectionString: connectionString || "postgres://dummy:dummy@localhost:5432/dummy",
  max: 1, // Vercel 서버리스 환경에서는 인스턴스당 1개의 연결만 유지 (총 연결 수 제한 방지)
  idleTimeoutMillis: 1000, // 유휴 연결을 빠르게 해제 (30초 -> 1초)
  connectionTimeoutMillis: 5000, // 연결 타임아웃 5초로 증가 (불안정한 네트워크 대비)
  ssl: {
    rejectUnauthorized: false
  }
};

// Supabase의 경우 서버리스 환경에서는 Transaction Mode(6543 포트) 사용 권장
if (poolConfig.connectionString && poolConfig.connectionString.includes('supabase.com') && poolConfig.connectionString.includes(':5432')) {
  console.log('🔧 [DB 설정 자동 최적화] Serverless 환경 감지: Session Mode(5432) -> Transaction Mode(6543)으로 포트 변경');
  poolConfig.connectionString = poolConfig.connectionString.replace(':5432', ':6543');
}

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });
