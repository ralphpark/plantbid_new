# Repository Guidelines

## Project Structure & Module Organization
- `client/` holds the Vite React frontend; main code lives in `client/src` with pages, components, hooks, and utilities.
- `server/` contains the Express API, payment integrations, and service logic; entry point is `server/index.ts`.
- `shared/` contains cross‑app TypeScript (notably `shared/schema.ts` for Drizzle ORM models).
- `public/` and `uploads/` contain static assets and uploaded files, respectively.
- `supabase/` and `scripts/` hold database tooling and one‑off utilities.

## Build, Test, and Development Commands
- `npm run dev`: start the Express dev server with Vite middleware and TSX hot reloading.
- `npm run build`: build the frontend bundle via Vite.
- `npm run build:server`: bundle the server entry with esbuild into `dist/`.
- `npm start`: run the production server from `dist/index.js`.
- `npm run check`: TypeScript type checking (no emit).
- `npm run db:push`: push Drizzle schema changes to the database.

## Coding Style & Naming Conventions
- TypeScript (ESM) is used across client and server; follow existing 2‑space indentation.
- React components use `PascalCase` names and live under `client/src`.
- Utilities and scripts typically use `kebab-case` file names (match the surrounding folder).
- Prefer the path aliases defined in `tsconfig.json`: `@/` for `client/src`, `@shared/` for `shared`.

## Testing Guidelines
- There is no dedicated test runner script; rely on `npm run check` for type safety.
- Ad‑hoc test scripts live in the repo root (e.g., `test-*.mjs`) and under `server/`.
- If adding automated tests, use `*.test.ts` naming and keep them close to the code they verify.

## Commit & Pull Request Guidelines
- Commit history uses Conventional Commit prefixes (`feat:`, `fix:`) alongside occasional Korean summaries; prefer the prefix format when possible.
- PRs should include a concise description, testing notes (commands run), and screenshots for UI changes.
- Link related issues or tasks when applicable.

## Configuration & Secrets
- Required runtime variables include `SUPABASE_DB_URL` or `DATABASE_URL`, `PORTONE_V2_API_SECRET`, `PORTONE_STORE_ID`, `GOOGLE_GEMINI_API_KEY`, and `GOOGLE_MAPS_API_KEY`.
- Do not commit secrets; store them in `.env` files or deployment‑specific settings.

## Agent‑Specific Notes
- User‑facing text and error messages are expected to be in Korean unless a feature explicitly targets another locale.
