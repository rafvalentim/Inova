---
focus: arch
generated: 2026-04-01
---

# Architecture

## Summary

Inova is a project management platform built as a monorepo with a clear client-server split. The backend is a Node.js/Express REST API using Prisma ORM over PostgreSQL. The frontend is a React SPA communicating with the API exclusively via a centralized Axios client. Authentication relies on httpOnly cookies for refresh tokens and in-memory storage for access tokens, with no secrets in localStorage.

## Pattern Overview

**Overall:** Layered REST API + React SPA (no SSR, no GraphQL)

**Key Characteristics:**
- All business logic lives in route handlers inside `apps/api/src/modules/`; no separate service layer
- Frontend fetches all data through React Query; components do not call `api` directly except inside query/mutation functions
- Permissions are role-based and stored as a JSON blob on the `Role` model; checked both on the server (`authorize` middleware) and on the client (`hasPermission` in `useAuthStore`)
- Audit logging is a cross-cutting concern called explicitly from each mutating route handler via `createAuditLog`

## Layers — API (`apps/api/`)

**Config:**
- Purpose: Environment wiring and singleton clients
- Location: `apps/api/src/config/`
- Contains: `index.ts` (typed config object from env), `database.ts` (Prisma singleton)
- Depends on: `dotenv`, environment variables
- Used by: all modules and middleware

**Middleware:**
- Purpose: Request-level cross-cutting concerns
- Location: `apps/api/src/middleware/`
- Contains: `auth.ts` (`authenticate`, `authorize`), `auditLog.ts` (`createAuditLog`), `errorHandler.ts`
- Depends on: config, database
- Used by: all route modules

**Modules:**
- Purpose: Feature-specific route handlers (controller + inline business logic)
- Location: `apps/api/src/modules/`
- Contains: one `routes.ts` per domain — `auth`, `users`, `roles`, `projects`, `sprints`, `tasks`, `dashboard`, `reports`, `clockify`, `audit`
- Depends on: config, middleware, Prisma client
- Used by: Express app entry point (not present in repo root; routes registered in app bootstrap)

**Utils:**
- Purpose: Shared helpers used across multiple modules
- Location: `apps/api/src/utils/`
- Contains: `projectGuard.ts` — `rejectIfCancelled(projectId, res)` guard used in sprints, tasks, projects routes

## Layers — Web (`apps/web/`)

**Entry / Bootstrap:**
- Purpose: React root, providers, router setup
- Location: `apps/web/src/main.tsx`
- Contains: `QueryClientProvider`, `ThemeProvider`, `BrowserRouter`

**Routing:**
- Purpose: Declarative route tree with auth and permission guards
- Location: `apps/web/src/App.tsx`
- Contains: `PrivateRoute` (checks `isAuthenticated` + store hydration), `AuthorizedRoute` (checks `hasPermission`), `HomeRedirect` (role-based default landing)

**Pages:**
- Purpose: Full-page views mapped to routes
- Location: `apps/web/src/pages/`
- Contains: `DashboardPage`, `ProjectsPage`, `ProjectDetailPage`, `KanbanPage`, `MyTasksPage`, `UsersPage`, `RolesPage`, `AuditLogPage`, `SettingsPage`, `LoginPage`, `ForgotPasswordPage`, `ChangePasswordPage`
- Pattern: each page owns its own React Query calls; no shared data layer between pages

**Components:**
- Purpose: Shared UI pieces (layout shell)
- Location: `apps/web/src/components/`
- Contains: `AppLayout.tsx` — Ant Design `Sider + Header + Content` shell with collapsible nav, breadcrumb, user menu, theme toggle

**Services:**
- Purpose: Configured Axios instance with token lifecycle management
- Location: `apps/web/src/services/api.ts`
- Contains: `api` (Axios instance), `tokenManager` (in-memory access token), request interceptor (injects Bearer token), response interceptor (silent refresh on 401)

**Store:**
- Purpose: Global client state
- Location: `apps/web/src/store/`
- Contains: `authStore.ts` (Zustand + persist — user profile, `hasPermission`), `themeStore.ts` (Zustand + persist — light/dark)

**Providers:**
- Purpose: Ant Design ConfigProvider wrapper for theming
- Location: `apps/web/src/providers/ThemeProvider.tsx`

## Data Flow

**Authenticated Request:**

1. Page calls `useQuery` / `useMutation` with an `api.*` call
2. `api.ts` request interceptor injects `Authorization: Bearer <token>` from `tokenManager`
3. Express `authenticate` middleware reads cookie `accessToken` (preferred) or `Authorization` header, verifies JWT, attaches `userId`, `userRole`, `userPermissions` to `AuthRequest`
4. Route handler runs business logic via Prisma, returns `{ success: true, data: ... }`
5. React Query caches response; component re-renders

**Token Refresh Flow:**

1. API returns 401 on expired access token
2. `api.ts` response interceptor catches 401, calls `POST /api/auth/refresh` with credentials (httpOnly cookie auto-sent)
3. Server validates refresh token, rotates it, returns new `accessToken` in response body
4. `tokenManager.set(accessToken)` updates in-memory token
5. Original request is retried; queued concurrent requests are replayed

**State Management:**
- Server state: React Query (staleTime 60s globally; 5 min for project queries)
- Auth/session: Zustand `useAuthStore` persisted to localStorage (only `user` + `isAuthenticated`, never tokens)
- Theme: Zustand `useThemeStore` persisted to localStorage

## Authentication Architecture

**Token Strategy (RNF-008):**
- Access token: 15-minute JWT, returned in response body, stored in module-level `_accessToken` variable (`tokenManager`), injected via `Authorization` header
- Refresh token: 7-day opaque UUID, stored in database (`refresh_tokens` table), sent/received only via httpOnly cookie (`path: /api/auth`)
- Logout: server deletes all user refresh tokens; client clears in-memory token and Zustand state

**Account Security:**
- 5 failed login attempts trigger account lock for 15 minutes (`lockedUntil`, `status: BLOCKED`)
- `firstLogin: true` forces password change before accessing any protected route

## Authorization Architecture

**Server:** `authorize(resource, action)` middleware in `apps/api/src/middleware/auth.ts`
- `Administrador` with `isSystem=true` bypasses all permission checks
- Other roles: checks `req.userPermissions[resource].includes(action)` (permissions are a JSON blob on the Role)

**Client:** `hasPermission(resource, action)` in `useAuthStore`
- Same logic mirrored: system admin returns `true`; otherwise checks `user.role.permissions`
- Used to hide nav items and guard routes via `AuthorizedRoute`

**Resources:** `users`, `roles`, `projects`, `project_members`, `project_info`, `sprints`, `tasks`, `comments`, `attachments`, `dashboard`, `reports`, `audit_logs`, `settings`, `clockify`

**Actions:** `create`, `read`, `update`, `delete`, `read_sensitive`

## Key Abstractions

**`AuthRequest`:**
- Purpose: Extends Express `Request` with authenticated user context
- Location: `apps/api/src/middleware/auth.ts`
- Fields: `userId`, `userRole`, `userIsSystem`, `userPermissions`

**`rejectIfCancelled`:**
- Purpose: Guard that blocks mutations on cancelled projects
- Location: `apps/api/src/utils/projectGuard.ts`
- Pattern: `if (await rejectIfCancelled(projectId, res)) return;` — used in tasks, sprints, projects routes

**`createAuditLog`:**
- Purpose: Writes audit trail for all state-changing operations
- Location: `apps/api/src/middleware/auditLog.ts`
- Called explicitly at the end of each POST/PUT/PATCH/DELETE handler with old/new values

**`tokenManager`:**
- Purpose: In-memory singleton for the access token
- Location: `apps/web/src/services/api.ts`
- Methods: `get()`, `set(token)`, `clear()`

**`@inova/shared` package:**
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

**Strategy:** All errors caught with try/catch in each route handler; no centralized error middleware for business logic

**Patterns:**
- `console.error('X error:', error)` followed by `res.status(500).json({ success: false, message: 'Erro interno do servidor' })`
- Validation errors return 400 with specific Portuguese messages
- Permission errors return 403
- Guard failures (`rejectIfCancelled`) return 422

## Cross-Cutting Concerns

**Logging:** `console.error` only — no structured logging library
**Validation:** Manual field checks in route handlers — no schema validation library (e.g., zod, joi)
**Authentication:** Cookie-first (`accessToken` httpOnly cookie), Bearer header fallback for dev tooling
**Audit:** Explicit `createAuditLog` calls in mutating handlers — covers login, logout, password changes, CRUD on tasks/projects/comments

---

*Architecture analysis: 2026-04-01*
