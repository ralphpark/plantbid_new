Supabase로 기존 Neon(Postgres) 데이터를 이전하는 절차

1. .env 파일에 `NEON_DATABASE_URL`을 설정합니다. 예: `postgres://user:password@host:5432/db?sslmode=require`
2. `bash scripts/migrate_neon_to_supabase.sh all` 를 실행해 스키마/데이터 덤프 파일을 생성합니다.
3. 스키마 적용: IDE에서 Supabase 통합의 마이그레이션 기능으로 `supabase/migrations/neon_schema.sql`을 적용합니다.
4. 데이터 적용: 동일하게 `supabase/migrations/neon_data.sql`을 적용합니다.
5. 적용 후 Supabase의 `public` 스키마에서 테이블과 데이터가 생성되었는지 확인합니다.

참고
- 덤프 파일은 소유권/권한 관련 구문을 제거해 Supabase에 바로 적용 가능한 형태입니다.
- 대용량 데이터의 경우 데이터 파일을 여러 조각으로 나눠서 적용하는 것을 권장합니다.
