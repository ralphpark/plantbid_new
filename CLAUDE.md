# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start development server (Express + Vite HMR) on port 5000

# Build & Production
npm run build        # Build frontend (Vite) and backend (esbuild)
npm start           # Run production build

# Type checking
npm run check       # Run TypeScript type checking

# Database
npm run db:push     # Push schema changes to database using Drizzle Kit
```

## Architecture

PlantBid is a full-stack plant trading platform with Korean payment integration.

### Stack
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, Radix UI components, React Query, wouter for routing
- **Backend**: Express.js + TypeScript (ESM), runs on port 5000
- **Database**: PostgreSQL with Drizzle ORM (Supabase or Neon)
- **AI**: Google Gemini for plant recommendations
- **Payments**: PortOne V2 with KG Inicis PG

### Directory Structure
```
client/src/
  components/    # React components (ui/ has shadcn-style primitives)
  pages/         # Route pages
  hooks/         # Custom React hooks (use-auth, use-toast)
  lib/           # Utilities and query client

server/
  index.ts       # Express app entry point
  routes.ts      # Main API route registration
  storage.ts     # Database operations (CRUD for all entities)
  ai.ts          # Gemini AI chat handling
  payments.ts    # Payment processing logic
  portone-v2-client.ts    # PortOne V2 API client
  webhook-handler.ts      # Payment webhook processing
  auth.ts        # Passport.js authentication setup

shared/
  schema.ts      # Drizzle schema definitions (users, plants, vendors, bids, orders, payments, etc.)
```

### Key Patterns

**Path Aliases**
- `@/*` maps to `client/src/*`
- `@shared/*` maps to `shared/*`

**API Routes**
- Main routes: `/api/*` (registered in routes.ts)
- Direct routes: `/direct/*` and `/__direct/*` (bypass Vite middleware, see direct-router.ts)
- Webhooks: `/api/webhook/portone/*` (no auth required)

**Authentication**
- Passport.js with local strategy and session-based auth
- Roles: `user`, `vendor`, `admin`
- Protected routes use `ProtectedRoute` and `AdminRoute` wrappers
- Passwords hashed with scrypt

**Payment Flow**
- PortOne V2 integration via `@portone/browser-sdk`
- Order IDs use format: `pay_[nanoid]`
- Payment webhooks update order and bid status
- Supports payment cancellation via PortOne API

**Database**
- Schema in `shared/schema.ts` with Drizzle ORM
- Relations defined for all entities
- Uses `drizzle-zod` for validation schemas
- Connection: `SUPABASE_DB_URL` or `DATABASE_URL` env var

## Environment Variables

Required:
- `SUPABASE_DB_URL` or `DATABASE_URL` - PostgreSQL connection string
- `PORTONE_V2_API_SECRET` - PortOne V2 API secret
- `PORTONE_STORE_ID` - PortOne store ID
- `GOOGLE_GEMINI_API_KEY` - Gemini AI API key
- `GOOGLE_MAPS_API_KEY` - Google Maps API key

## Language Preferences

- **Primary Language:** Korean (한국어)
- All conversations, explanations, and comments must be in Korean.
- Error messages shown to users must also be in Korean.
