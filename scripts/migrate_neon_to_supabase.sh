#!/usr/bin/env bash
set -eo pipefail
MODE=${1:-all}
if [ -z "${NEON_DATABASE_URL:-}" ]; then
  echo "NEON_DATABASE_URL 환경변수를 설정하세요" >&2
  exit 1
fi
PG_DUMP_BIN=${PG_DUMP_BIN:-pg_dump}
mkdir -p supabase/migrations
if [ "$MODE" = "schema" ] || [ "$MODE" = "all" ]; then
  "$PG_DUMP_BIN" "$NEON_DATABASE_URL" --no-owner --no-privileges --schema-only > supabase/migrations/neon_schema.sql
fi
if [ "$MODE" = "data" ] || [ "$MODE" = "all" ]; then
  "$PG_DUMP_BIN" "$NEON_DATABASE_URL" --no-owner --no-privileges --data-only --inserts > supabase/migrations/neon_data.sql
fi
echo "생성된 파일:"
ls -1 supabase/migrations/neon_*.sql
