# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

### Install
```bash
npm install
```

### Dev server (API + UI)
Runs Express + Vite middleware on a single port.
```bash
npm run dev
```

### Typecheck
```bash
npm run check
```

### Build + run production bundle
Builds the Vite client and bundles the server entry with esbuild.
```bash
npm run build
npm start
```

### Database schema push (Drizzle)
Uses `drizzle-kit push` and requires `SUPABASE_DB_URL` or `DATABASE_URL`.
```bash
npm run db:push
```

### Run a one-off TypeScript script
There is no `npm test` / test runner configured; this repo commonly uses ad-hoc scripts.
```bash
npx tsx path/to/script.ts
```
Examples:
- DB connectivity check: `npx tsx server/test-db.ts`

## Environment variables (practical minimum)

- **Database**
  - `SUPABASE_DB_URL` or `DATABASE_URL` (required by `drizzle.config.ts`)
  - `.env.example` also references `NEON_DATABASE_URL` and Supabase client vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

- **App integrations used by server routes** (see `server/*.ts` and `CLAUDE.md`)
  - PortOne (payments): `PORTONE_V2_API_SECRET`, `PORTONE_STORE_ID`, optionally `PORTONE_WEBHOOK_SECRET`
  - AI (Gemini): `GOOGLE_GEMINI_API_KEY`
  - Maps: `GOOGLE_MAPS_API_KEY`

## High-level architecture

This is a single-repo, full-stack TypeScript app where Express serves both the API and the Vite-built React SPA.

### Key directories

- `client/`: React + Vite app (Vite `root` is `client/`, see `vite.config.ts`).
- `server/`: Express API + production server entry.
- `shared/`: Drizzle schema + shared types (`shared/schema.ts`).
- `migrations/`: Drizzle output directory (configured in `drizzle.config.ts`).
- `supabase/`: notes + SQL files/scripts for migrating from Neon to Supabase (see `supabase/README.md`).

### Server boot sequence and port model

- Entry point: `server/index.ts`.
- In `NODE_ENV=development`, Express registers API routes first, then mounts Vite in middleware mode (see `server/vite.ts`).
- In production, Express serves `dist/public` (Vite output) and the API from the same server.
- Default port is **5000** (see `server/index.ts`).

### API routing layout (important)

There are multiple routing “lanes”, mainly to avoid Vite’s SPA catch-all and to force JSON responses:

- **Main API:** `server/routes.ts` registers most endpoints under `/api/*` and wires up feature modules.
- **Webhook lane:** `server/webhook-handler.ts` is mounted early in `server/routes.ts` under `/api/*` (webhooks should not require auth).
- **Direct lane (bypass Vite):** `server/direct-router.ts` is mounted in `server/index.ts` under:
  - `/direct/*` and `/direct/plants/*`
  - legacy compatibility: `/__direct/*`
- **Direct API lane:** `server/api_direct_router.ts` is mounted under `/api_direct/*`.

When debugging “API returns HTML” or “Vite is intercepting my request”, check which lane the endpoint is on and whether it should be moved to `/direct` or `/api_direct`.

### Data access pattern

- Drizzle schema lives in `shared/schema.ts`.
- Server-side DB access is intentionally funneled through `server/storage.ts` (`IStorage` + `DatabaseStorage`).
- `server/routes.ts` typically calls into `storage` rather than using `db` directly (though some routes do import `db` for custom queries).

### Auth model

- Session auth: Passport Local + `express-session`.
- Setup: `server/auth.ts`.
- Sessions are stored in Postgres via `connect-pg-simple`. The session table is also declared in `shared/schema.ts` as `session`.
- Roles used throughout UI/server: `user`, `vendor`, `admin`.
- Client routing gates:
  - `client/src/lib/protected-route.tsx` (authenticated)
  - `client/src/lib/admin-route.tsx` (admin)

### Payments (PortOne + KG Inicis)

- Core modules:
  - `server/payments.ts`
  - `server/portone-v2-client.ts`, `server/portone-v2-routes.ts`
  - `server/mid-test-routes.ts`
- The browser SDK is loaded in `client/index.html` (`https://cdn.portone.io/v2/browser-sdk.js`).
- Webhook configuration notes live in `webhook-setup-guide.md`.
- Order IDs commonly use the `pay_...` format (see notes in `CLAUDE.md` and direct-cancel logic in `server/api_direct_router.ts`).

### Maps / location

- Server-side helpers live in `server/map.ts`.
- Client map state/provider lives under `client/src/components/map/` and is mounted in `client/src/App.tsx` via `MapProvider`.

## Notes pulled from repo-specific agent docs

- `CLAUDE.md` contains a concise directory map and key route conventions (especially `/direct/*`, `/__direct/*`, and webhook paths). If something here and `CLAUDE.md` conflict, prefer the code as the source of truth, then update both docs.
- `supabase/README.md` documents a Neon → Supabase migration workflow using `bash scripts/migrate_neon_to_supabase.sh all` and applying generated SQL files under `supabase/migrations/`.
