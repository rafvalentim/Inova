---
focus: tech
generated: 2026-04-01
---

# External Integrations

## Summary

Inova integrates with one external time-tracking service (Clockify) and uses a self-hosted PostgreSQL database. Authentication is handled internally with JWT tokens in httpOnly cookies, without any third-party identity provider. File storage is local filesystem. SMTP email support is configured but not confirmed active.

## APIs & External Services

**Time Tracking:**
- Clockify API (https://api.clockify.me/api/v1/)
  - Purpose: sync time entries from Clockify workspaces into Inova tasks
  - SDK/Client: native `fetch` (no SDK — direct HTTP in `apps/api/src/modules/clockify/routes.ts`)
  - Auth: `X-Api-Key` header using stored `apiKey` from `clockify_config` table
  - Endpoint used: `GET /workspaces/{workspaceId}/time-entries?start={iso}&page-size=200`
  - Sync trigger: automatic cron every 15 minutes (`node-cron`) + manual via `POST /api/clockify/sync`
  - Lookback: 1 day (auto), 7 days (manual)
  - Config stored in DB: `clockify_config` table (apiKey, workspaceId, lastSyncAt, syncStatus)
  - Env vars: `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID` (also stored in DB — env vars are fallback)

## Data Storage

**Primary Database:**
- PostgreSQL 15 (Alpine)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma ORM v5.14 (`@prisma/client`)
  - Schema: `apps/api/prisma/schema.prisma`
  - Migrations: `apps/api/prisma/migrations/`
  - Production: runs as Docker service `db` (`infra/docker-compose.yml`)
  - Development: defaults to `postgresql://inova:inova123@localhost:5432/inova`

**Key models:**
- `users`, `roles`, `refresh_tokens`, `password_reset_tokens`
- `projects`, `project_members`, `project_info`
- `sprints`, `sprint_tasks`, `tasks`, `task_assignees`
- `comments`, `attachments`, `time_entries`
- `audit_logs`, `clockify_config`

**File Storage:**
- Local filesystem only
  - Upload dir: `UPLOAD_DIR` env var (default: `./uploads`)
  - Max file size: `MAX_FILE_SIZE` env var (default: 10MB)
  - Handler: `multer` in `apps/api/` task/attachment routes
  - Served as static via Express: `app.use('/uploads', express.static(...))`
  - Production volume: Docker named volume `uploads` mounted at `/app/uploads`

**Caching:**
- None (no Redis or in-memory cache layer)

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no third-party identity provider)
  - Implementation: `apps/api/src/modules/auth/routes.ts` + `apps/api/src/middleware/auth.ts`

**Token strategy:**
- Access token: short-lived JWT (default `15m`), signed with `JWT_SECRET`
  - Stored in memory on the client (`apps/web/src/services/api.ts` — `tokenManager`)
  - Sent as `Authorization: Bearer` header OR httpOnly cookie `accessToken`
- Refresh token: long-lived JWT (default `7d`), signed with `JWT_REFRESH_SECRET`
  - Stored as httpOnly cookie (never accessible to JavaScript per RNF-008)
  - Stored in `refresh_tokens` DB table for rotation/invalidation
  - Silent refresh: axios 401 interceptor calls `POST /api/auth/refresh` automatically

**Password security:**
- bcryptjs, 12 rounds
- Account lockout after 5 failed attempts (15-minute lockout)
- Status transitions: `ACTIVE` → `BLOCKED` on lockout

**Permission model:**
- Role-based (`roles` table), permissions stored as JSON column
- System admin role (`isSystem: true`, name `Administrador`) bypasses all permission checks
- Per-resource CRUD actions: `create | read | update | delete | read_sensitive`
- Resources: `users, roles, projects, project_members, project_info, sprints, tasks, comments, attachments, dashboard, reports, audit_logs, settings, clockify`
- Frontend check: `useAuthStore.hasPermission(resource, action)` (`apps/web/src/store/authStore.ts`)
- Backend middleware: `authorize(resource, action)` (`apps/api/src/middleware/auth.ts`)

## Realtime Communication

**WebSockets:**
- Socket.IO v4.7.5 — bidirectional events between server and web clients
  - Server: `apps/api/src/server.ts` (HTTP server wrapped with `socket.io`)
  - Client: `socket.io-client` v4.7.5 (web)
  - Rooms: project-scoped (`project:{projectId}`)
  - Events: `join-project`, `leave-project`, `task-updated`, `task-moved`, `task-created`, `task-deleted`, `comment-added`
  - Dev proxy: `/socket.io` proxied with `ws: true` in `apps/web/vite.config.ts`

## Email / SMTP

**Email Service:**
- SMTP (not confirmed active — config present, no send implementation found in explored files)
  - Config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` env vars
  - Intended use: password reset flow (`password_reset_tokens` table exists in schema)
  - No email SDK (`nodemailer` or similar) found in `apps/api/package.json`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or equivalent)

**Logging:**
- `console.log` / `console.error` only (no structured logging library)
- Audit log stored in DB: `audit_logs` table (user, action, resource, resourceId, oldValue, newValue, ipAddress)
  - Created via `createAuditLog` middleware (`apps/api/src/middleware/auditLog.ts`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker Compose (`infra/docker-compose.yml`)
- Services: `app` (Express + static build), `db` (PostgreSQL 15), `nginx` (reverse proxy)

**Nginx:**
- Config: `infra/nginx.conf`
- Serves frontend static files from `/usr/share/nginx/html`
- Proxies API requests to Express app on port 3000

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or equivalent config files found)

## Environment Configuration

**Required env vars for production:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — access token signing key
- `JWT_REFRESH_SECRET` — refresh token signing key
- `CORS_ORIGIN` — allowed frontend origin
- `DB_PASS` — PostgreSQL password (used by docker-compose)

**Optional env vars:**
- `PORT` (default: 3000)
- `NODE_ENV` (default: development)
- `JWT_EXPIRES_IN` (default: 15m)
- `JWT_REFRESH_EXPIRES_IN` (default: 7d)
- `UPLOAD_DIR` (default: ./uploads)
- `MAX_FILE_SIZE` (default: 10485760)
- `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Secrets location:**
- Root `.env` file (gitignored) — see `.env.example` for required vars
- `apps/api/.env` also present for direct API dev usage

## Webhooks & Callbacks

**Incoming:** None detected.

**Outgoing:** None detected (Clockify sync is pull-based polling, not webhook-driven).

---

*Integration audit: 2026-04-01*
