<!-- GSD:project-start source:PROJECT.md -->
## Project

**Inova — Revisão e Hardening**

Inova é uma plataforma de gestão de projetos com Kanban, sprints, time tracking e controle de acesso por roles. Este ciclo foca em revisão geral de qualidade: segurança, limpeza de código, robustez dos fluxos e adição de testes básicos — tanto no backend quanto no frontend.

**Core Value:** O sistema precisa ser **seguro e confiável** — auth sólido, validação de entrada consistente, RBAC sem brechas, e código limpo o suficiente para evoluir sem medo.

### Constraints

- **Stack**: Manter Node/Express/Prisma no backend e React/Vite/Ant Design no frontend
- **Abordagem**: Refactor estrutural onde for crítico (auth, tasks, sprints); incremental no resto
- **Testes**: Básicos nos pontos críticos — não buscar cobertura total
- **Ambiente**: Só dev — liberdade para mudanças sem preocupação com migração em produção
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Summary
## Languages
- TypeScript 5.4 — all source code in `apps/api/src/`, `apps/web/src/`, and `packages/shared/src/`
- API compiles to ES2022 CommonJS (`apps/api/tsconfig.json`, `outDir: dist`)
- Web compiles to ESM via Vite (`apps/web/package.json` has `"type": "module"`)
## Runtime
- Node.js 18 (specified in `infra/Dockerfile` — `node:18-alpine`)
- npm workspaces (root `package.json` declares `workspaces: ["packages/*", "apps/*"]`)
- Lockfile: `package-lock.json` present at repo root
## Monorepo Structure
## Backend Frameworks & Libraries
- `express` ^4.19.2 — HTTP server framework (`apps/api/src/server.ts`)
- `@prisma/client` ^5.14.0 — database ORM client (`apps/api/src/config/database.ts`)
- `prisma` ^5.14.0 (dev) — schema management and migrations
- `jsonwebtoken` ^9.0.2 — JWT signing/verification (`apps/api/src/middleware/auth.ts`)
- `bcryptjs` ^2.4.3 — password hashing (12 rounds, `apps/api/src/config/index.ts`)
- `cookie-parser` ^1.4.7 — httpOnly cookie handling
- `cors` ^2.8.5 — CORS middleware
- `express-rate-limit` ^7.2.0 — rate limiting (100 req/min per IP)
- `socket.io` ^4.7.5 — WebSocket server (`apps/api/src/server.ts`)
- `zod` ^3.23.8 — request schema validation
- `uuid` ^9.0.1 — UUID generation
- `multer` ^1.4.5-lts.1 — file upload handling
- `node-cron` ^4.2.1 — scheduled jobs (Clockify sync every 15 minutes)
- `dotenv` ^16.4.5 — environment variable loading
- `tsx` ^4.11.0 — TypeScript execution for dev server (`tsx watch src/server.ts`)
- `typescript` ^5.4.0
## Frontend Frameworks & Libraries
- `react` ^18.3.1 + `react-dom` ^18.3.1 — UI framework
- `react-router-dom` ^6.23.1 — client-side routing
- `vite` ^5.3.1 — build tool and dev server (port 5173)
- `@vitejs/plugin-react` ^4.3.1 — React fast-refresh plugin
- `antd` ^5.18.0 — Ant Design component library
- `@ant-design/icons` ^5.3.7 — icon set
- `zustand` ^4.5.2 — global state (`apps/web/src/store/authStore.ts`, `themeStore.ts`)
- `@tanstack/react-query` ^5.45.0 — server state and data fetching
- `@dnd-kit/core` ^6.1.0 — DnD primitives (`apps/web/src/pages/KanbanPage.tsx`)
- `@dnd-kit/sortable` ^8.0.0 — sortable list utilities
- `@dnd-kit/utilities` ^3.2.2 — DnD helper utilities
- `recharts` ^2.12.7 — charting library (dashboard)
- `dayjs` ^1.11.11 — date manipulation
- `axios` ^1.7.2 — HTTP client (`apps/web/src/services/api.ts`)
- `react-markdown` ^10.1.0 — Markdown rendering
- `remark-gfm` ^4.0.1 — GitHub Flavored Markdown plugin
- `socket.io-client` ^4.7.5 — WebSocket client
## Build & Dev
- `concurrently` ^8.2.2 — runs API and web dev servers in parallel (`npm run dev` at root)
- API dev: `tsx watch src/server.ts`
- Web dev: `vite` (proxies `/api`, `/uploads`, `/socket.io` to `http://localhost:3000`)
- API: `tsc` → outputs to `apps/api/dist/`
- Web: `tsc -b && vite build` → outputs to `apps/web/dist/`
- Docker multi-stage build in `infra/Dockerfile`
## Configuration
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — JWT signing keys
- `JWT_EXPIRES_IN` (default: `15m`) / `JWT_REFRESH_EXPIRES_IN` (default: `7d`)
- `PORT` (default: `3000`)
- `CORS_ORIGIN` (default: `http://localhost:5173`)
- `UPLOAD_DIR` (default: `./uploads`), `MAX_FILE_SIZE` (default: 10MB)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID`
## Platform Requirements
- Node.js 18+
- PostgreSQL 15 (or via Docker Compose)
- npm 8+
- Docker + Docker Compose (`infra/docker-compose.yml`)
- Services: `app` (Node 18 Alpine), `db` (Postgres 15 Alpine), `nginx` (Alpine)
- Nginx serves frontend static files; proxies API requests to Express on port 3000
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Summary
## API Patterns (Express)
### Estrutura de Rota
### Response Shape
### Auth Pattern
### Audit Logging
### Prisma Patterns
- `select` explícito em joins para limitar campos retornados
- `_count` para contagens sem carregar relações
- Transações implícitas via múltiplos awaits (sem `prisma.$transaction` exceto onde explicitamente necessário)
- `upsert` para relações many-to-many junction tables
## Frontend Patterns (React)
### Componentes de Página
### Data Fetching
### Client State
### UI Components
### Permissões no Frontend
- Nível de rota: `AuthorizedRoute` em `App.tsx`
- Nível de componente: verificação inline `hasPermission('tasks', 'delete')` para mostrar/ocultar botões
## TypeScript
- `strict` não verificado explicitamente — `any` é usado frequentemente em query builders e tipagens dinâmicas de Prisma
- `as const` em arrays de status para type narrowing
- `AuthRequest extends Request` para adicionar campos do usuário autenticado
- Imports de tipo inline quando necessário (`import type { ... }`)
- Erro conhecido: `apps/web/src/services/api.ts:63` tem TS2322 (type mismatch em failedQueue)
## Linguagem e Mensagens
- Toda UI em português (pt-BR)
- Mensagens de erro da API em pt-BR
- Comentários no código mistos (pt-BR e inglês)
- Nomes de variáveis/funções em inglês
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Summary
## Pattern Overview
- All business logic lives in route handlers inside `apps/api/src/modules/`; no separate service layer
- Frontend fetches all data through React Query; components do not call `api` directly except inside query/mutation functions
- Permissions are role-based and stored as a JSON blob on the `Role` model; checked both on the server (`authorize` middleware) and on the client (`hasPermission` in `useAuthStore`)
- Audit logging is a cross-cutting concern called explicitly from each mutating route handler via `createAuditLog`
## Layers — API (`apps/api/`)
- Purpose: Environment wiring and singleton clients
- Location: `apps/api/src/config/`
- Contains: `index.ts` (typed config object from env), `database.ts` (Prisma singleton)
- Depends on: `dotenv`, environment variables
- Used by: all modules and middleware
- Purpose: Request-level cross-cutting concerns
- Location: `apps/api/src/middleware/`
- Contains: `auth.ts` (`authenticate`, `authorize`), `auditLog.ts` (`createAuditLog`), `errorHandler.ts`
- Depends on: config, database
- Used by: all route modules
- Purpose: Feature-specific route handlers (controller + inline business logic)
- Location: `apps/api/src/modules/`
- Contains: one `routes.ts` per domain — `auth`, `users`, `roles`, `projects`, `sprints`, `tasks`, `dashboard`, `reports`, `clockify`, `audit`
- Depends on: config, middleware, Prisma client
- Used by: Express app entry point (not present in repo root; routes registered in app bootstrap)
- Purpose: Shared helpers used across multiple modules
- Location: `apps/api/src/utils/`
- Contains: `projectGuard.ts` — `rejectIfCancelled(projectId, res)` guard used in sprints, tasks, projects routes
## Layers — Web (`apps/web/`)
- Purpose: React root, providers, router setup
- Location: `apps/web/src/main.tsx`
- Contains: `QueryClientProvider`, `ThemeProvider`, `BrowserRouter`
- Purpose: Declarative route tree with auth and permission guards
- Location: `apps/web/src/App.tsx`
- Contains: `PrivateRoute` (checks `isAuthenticated` + store hydration), `AuthorizedRoute` (checks `hasPermission`), `HomeRedirect` (role-based default landing)
- Purpose: Full-page views mapped to routes
- Location: `apps/web/src/pages/`
- Contains: `DashboardPage`, `ProjectsPage`, `ProjectDetailPage`, `KanbanPage`, `MyTasksPage`, `UsersPage`, `RolesPage`, `AuditLogPage`, `SettingsPage`, `LoginPage`, `ForgotPasswordPage`, `ChangePasswordPage`
- Pattern: each page owns its own React Query calls; no shared data layer between pages
- Purpose: Shared UI pieces (layout shell)
- Location: `apps/web/src/components/`
- Contains: `AppLayout.tsx` — Ant Design `Sider + Header + Content` shell with collapsible nav, breadcrumb, user menu, theme toggle
- Purpose: Configured Axios instance with token lifecycle management
- Location: `apps/web/src/services/api.ts`
- Contains: `api` (Axios instance), `tokenManager` (in-memory access token), request interceptor (injects Bearer token), response interceptor (silent refresh on 401)
- Purpose: Global client state
- Location: `apps/web/src/store/`
- Contains: `authStore.ts` (Zustand + persist — user profile, `hasPermission`), `themeStore.ts` (Zustand + persist — light/dark)
- Purpose: Ant Design ConfigProvider wrapper for theming
- Location: `apps/web/src/providers/ThemeProvider.tsx`
## Data Flow
- Server state: React Query (staleTime 60s globally; 5 min for project queries)
- Auth/session: Zustand `useAuthStore` persisted to localStorage (only `user` + `isAuthenticated`, never tokens)
- Theme: Zustand `useThemeStore` persisted to localStorage
## Authentication Architecture
- Access token: 15-minute JWT, returned in response body, stored in module-level `_accessToken` variable (`tokenManager`), injected via `Authorization` header
- Refresh token: 7-day opaque UUID, stored in database (`refresh_tokens` table), sent/received only via httpOnly cookie (`path: /api/auth`)
- Logout: server deletes all user refresh tokens; client clears in-memory token and Zustand state
- 5 failed login attempts trigger account lock for 15 minutes (`lockedUntil`, `status: BLOCKED`)
- `firstLogin: true` forces password change before accessing any protected route
## Authorization Architecture
- `Administrador` with `isSystem=true` bypasses all permission checks
- Other roles: checks `req.userPermissions[resource].includes(action)` (permissions are a JSON blob on the Role)
- Same logic mirrored: system admin returns `true`; otherwise checks `user.role.permissions`
- Used to hide nav items and guard routes via `AuthorizedRoute`
## Key Abstractions
- Purpose: Extends Express `Request` with authenticated user context
- Location: `apps/api/src/middleware/auth.ts`
- Fields: `userId`, `userRole`, `userIsSystem`, `userPermissions`
- Purpose: Guard that blocks mutations on cancelled projects
- Location: `apps/api/src/utils/projectGuard.ts`
- Pattern: `if (await rejectIfCancelled(projectId, res)) return;` — used in tasks, sprints, projects routes
- Purpose: Writes audit trail for all state-changing operations
- Location: `apps/api/src/middleware/auditLog.ts`
- Called explicitly at the end of each POST/PUT/PATCH/DELETE handler with old/new values
- Purpose: In-memory singleton for the access token
- Location: `apps/web/src/services/api.ts`
- Methods: `get()`, `set(token)`, `clear()`
- Purpose: Shared TypeScript types and enums consumed by both `apps/api` and `apps/web`
- Location: `packages/shared/src/index.ts`
- Contains: all request/response interfaces (`UserProfile`, `TaskListItem`, `Permissions`, etc.), enums mirroring Prisma schema
## API Design Conventions
- All responses: `{ success: boolean, data?: T, message?: string }`
- Paginated responses: `{ items: T[], total, page, pageSize, totalPages }`
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable (cancelled project), 423 Locked (account lockout), 500 Internal Server Error
- Codes assigned to resources: projects `PROJ-NNN`, tasks `TASK-NNN` — sequential, zero-padded, generated at creation
## Sprint Lifecycle
- Sprints transition: `PLANNING` → `ACTIVE` → `COMPLETED` (or `CANCELLED`)
- `autoCompleteOverdueSprints` in `apps/api/src/modules/sprints/routes.ts`: when a sprint's `endDate` passes and status is still `ACTIVE`, incomplete tasks are migrated to the next sprint or backlog, and the sprint is marked `COMPLETED`
- `syncProjectStatus` in both tasks and sprints routes: auto-promotes a project from `PLANNING` to `IN_PROGRESS` when any task moves to `IN_PROGRESS` inside an active sprint
## Error Handling
- `console.error('X error:', error)` followed by `res.status(500).json({ success: false, message: 'Erro interno do servidor' })`
- Validation errors return 400 with specific Portuguese messages
- Permission errors return 403
- Guard failures (`rejectIfCancelled`) return 422
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
