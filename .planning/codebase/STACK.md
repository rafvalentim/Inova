---
focus: tech
generated: 2026-04-01
---

# Technology Stack

## Summary

Inova is a Node.js + React monorepo (npm workspaces) for project and team management. The backend is an Express API with Prisma ORM targeting PostgreSQL, and the frontend is a React 18 SPA built with Vite, using Ant Design as the component library. TypeScript 5.4 is used across all packages.

## Languages

**Primary:**
- TypeScript 5.4 — all source code in `apps/api/src/`, `apps/web/src/`, and `packages/shared/src/`

**Compiled target:**
- API compiles to ES2022 CommonJS (`apps/api/tsconfig.json`, `outDir: dist`)
- Web compiles to ESM via Vite (`apps/web/package.json` has `"type": "module"`)

## Runtime

**Environment:**
- Node.js 18 (specified in `infra/Dockerfile` — `node:18-alpine`)

**Package Manager:**
- npm workspaces (root `package.json` declares `workspaces: ["packages/*", "apps/*"]`)
- Lockfile: `package-lock.json` present at repo root

## Monorepo Structure

```
inova/
├── apps/api/        # @inova/api — Express REST API
├── apps/web/        # @inova/web — React SPA
└── packages/shared/ # @inova/shared — shared types and enums
```

Shared package is referenced by both apps via `"@inova/shared": "*"` and path aliases in tsconfig/vite.

## Backend Frameworks & Libraries

**Core:**
- `express` ^4.19.2 — HTTP server framework (`apps/api/src/server.ts`)
- `@prisma/client` ^5.14.0 — database ORM client (`apps/api/src/config/database.ts`)
- `prisma` ^5.14.0 (dev) — schema management and migrations

**Auth & Security:**
- `jsonwebtoken` ^9.0.2 — JWT signing/verification (`apps/api/src/middleware/auth.ts`)
- `bcryptjs` ^2.4.3 — password hashing (12 rounds, `apps/api/src/config/index.ts`)
- `cookie-parser` ^1.4.7 — httpOnly cookie handling
- `cors` ^2.8.5 — CORS middleware
- `express-rate-limit` ^7.2.0 — rate limiting (100 req/min per IP)

**Realtime:**
- `socket.io` ^4.7.5 — WebSocket server (`apps/api/src/server.ts`)

**Validation:**
- `zod` ^3.23.8 — request schema validation

**Utilities:**
- `uuid` ^9.0.1 — UUID generation
- `multer` ^1.4.5-lts.1 — file upload handling
- `node-cron` ^4.2.1 — scheduled jobs (Clockify sync every 15 minutes)
- `dotenv` ^16.4.5 — environment variable loading

**Dev tooling (API):**
- `tsx` ^4.11.0 — TypeScript execution for dev server (`tsx watch src/server.ts`)
- `typescript` ^5.4.0

## Frontend Frameworks & Libraries

**Core:**
- `react` ^18.3.1 + `react-dom` ^18.3.1 — UI framework
- `react-router-dom` ^6.23.1 — client-side routing
- `vite` ^5.3.1 — build tool and dev server (port 5173)
- `@vitejs/plugin-react` ^4.3.1 — React fast-refresh plugin

**UI Components:**
- `antd` ^5.18.0 — Ant Design component library
- `@ant-design/icons` ^5.3.7 — icon set

**State Management:**
- `zustand` ^4.5.2 — global state (`apps/web/src/store/authStore.ts`, `themeStore.ts`)
- `@tanstack/react-query` ^5.45.0 — server state and data fetching

**Drag and Drop:**
- `@dnd-kit/core` ^6.1.0 — DnD primitives (`apps/web/src/pages/KanbanPage.tsx`)
- `@dnd-kit/sortable` ^8.0.0 — sortable list utilities
- `@dnd-kit/utilities` ^3.2.2 — DnD helper utilities

**Data & Charts:**
- `recharts` ^2.12.7 — charting library (dashboard)
- `dayjs` ^1.11.11 — date manipulation
- `axios` ^1.7.2 — HTTP client (`apps/web/src/services/api.ts`)

**Markdown:**
- `react-markdown` ^10.1.0 — Markdown rendering
- `remark-gfm` ^4.0.1 — GitHub Flavored Markdown plugin

**Realtime:**
- `socket.io-client` ^4.7.5 — WebSocket client

## Build & Dev

**Development:**
- `concurrently` ^8.2.2 — runs API and web dev servers in parallel (`npm run dev` at root)
- API dev: `tsx watch src/server.ts`
- Web dev: `vite` (proxies `/api`, `/uploads`, `/socket.io` to `http://localhost:3000`)

**Production build:**
- API: `tsc` → outputs to `apps/api/dist/`
- Web: `tsc -b && vite build` → outputs to `apps/web/dist/`
- Docker multi-stage build in `infra/Dockerfile`

**Database commands (run from root):**
```bash
npm run db:migrate   # prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts
npm run db:generate  # prisma generate
```

## Configuration

**Environment variables** (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — JWT signing keys
- `JWT_EXPIRES_IN` (default: `15m`) / `JWT_REFRESH_EXPIRES_IN` (default: `7d`)
- `PORT` (default: `3000`)
- `CORS_ORIGIN` (default: `http://localhost:5173`)
- `UPLOAD_DIR` (default: `./uploads`), `MAX_FILE_SIZE` (default: 10MB)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID`

**Config module:** `apps/api/src/config/index.ts`

## Platform Requirements

**Development:**
- Node.js 18+
- PostgreSQL 15 (or via Docker Compose)
- npm 8+

**Production:**
- Docker + Docker Compose (`infra/docker-compose.yml`)
- Services: `app` (Node 18 Alpine), `db` (Postgres 15 Alpine), `nginx` (Alpine)
- Nginx serves frontend static files; proxies API requests to Express on port 3000

---

*Stack analysis: 2026-04-01*
