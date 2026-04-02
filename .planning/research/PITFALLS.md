# Domain Pitfalls — Node/Express Hardening

**Domain:** Hardening an existing brownfield Node/Express + React project management app
**Researched:** 2026-04-02
**Confidence:** HIGH (codebase analysis) / MEDIUM (general patterns)

---

## Critical Pitfalls

### Pitfall 1: Socket.IO — Trusting Client-Emitted Room Joins

**What goes wrong:**
Adding JWT on connection handshake is necessary but not sufficient. The second layer — checking that the authenticated user has membership in `projectId` before `socket.join(...)` — is nearly always forgotten.

**Location:** `apps/api/src/server.ts`, lines 38–41.

**Consequences:**
A user with valid credentials but no membership in Project X can connect, call `join-project` with any UUID, and receive live task events for projects they have no access to.

**Prevention:**
1. Add JWT verification on Socket.IO `connection` via `io.use(...)` middleware
2. Inside `join-project` handler, check `prisma.projectMember.findFirst({ where: { projectId, userId: socket.data.userId } })` before `socket.join(...)`
3. Never trust userId from the client — only from the server-side JWT

**Phase:** Security hardening (Phase 1)

---

### Pitfall 2: Socket.IO — Relaying Client-Emitted Events to Other Clients

**What goes wrong:**
The current server acts as a dumb relay: client emits `task-updated` with arbitrary data, server broadcasts unchanged. After adding auth, teams keep this relay — any authenticated client can forge events with fabricated data.

**Consequences:**
Authenticated attacker can spam `task-updated` with fake data. Clients update React Query cache from socket events, so UIs are poisoned without any HTTP request.

**Prevention:**
Remove all client-to-server-to-client relay events. Real-time updates should only be emitted by the server after successful HTTP mutation: HTTP POST/PUT → DB write → `req.app.get('io').to(room).emit(...)`. Delete `task-updated`, `task-moved`, etc. socket handlers; move emissions to HTTP route handlers.

**Phase:** Security hardening (Phase 1) — easy to miss when focusing only on auth

---

### Pitfall 3: Zod Validation — Validating the Wrong Layer and Scope

**What goes wrong:**
Schemas that are too strict on optional fields break existing frontend calls. Alternatively, validating only `req.body` and forgetting `req.params` and `req.query`.

**Consequences (too strict):**
`z.number().positive()` on `storyPoints` when frontend omits it → every task creation without storyPoints returns 400.

**Consequences (incomplete):**
Skipping `req.query` validation means `?status=INVALID_ENUM&page=-1` reaches Prisma.

**Prevention:**
1. Audit what the frontend actually sends before writing schemas
2. All optional fields must be `.optional()` or `.default(value)`
3. Validate all three layers: `req.params`, `req.body`, `req.query`
4. Start with enum fields: `status`, `priority` — highest-risk unvalidated today

**Phase:** Input validation (Phase 2)

---

### Pitfall 4: Removing `any` Too Aggressively in Dynamic Query Builders

**What goes wrong:**
Custom union types that are unreadable and no safer at runtime, or complex generics that scare the next developer.

**Prevention:**
Use Prisma's generated types: `import type { Prisma } from '@prisma/client'` → `const where: Prisma.TaskWhereInput = {}`. Apply to all 8 affected files. Don't build custom union types.

**Phase:** TypeScript cleanup (Phase 3)

---

### Pitfall 5: Testing — SQLite + Prisma Is Wrong for This Codebase

**What goes wrong:**
SQLite tests fail silently because the codebase uses PostgreSQL-specific features: `hasSome` (array contains), `mode: 'insensitive'` on `contains`, and JSON field operations on `permissions`.

**Prevention:**
Use real PostgreSQL for integration tests (Docker). Clean between tests with `TRUNCATE` or `prisma.$transaction` rollback. Never use SQLite for this project.

**Phase:** Testing setup (Phase 2)

---

### Pitfall 6: Testing — Testing Routes Instead of Behaviors That Can Regress

**What goes wrong:**
HTTP status code tests but missing business invariants: RBAC bypass for Administrador, firstLogin redirect, refresh token rotation, rejectIfCancelled guard, syncProjectStatus.

**Prevention — first 10 tests should cover:**
1. `authenticate` — no cookie, expired token, inactive user, BLOCKED user
2. `authorize` — admin bypass (isSystem=true), non-admin without permission (403), with permission (200)
3. `rejectIfCancelled` — cancelled project returns 422 on task creation
4. `generateTaskCode()` — two concurrent calls return unique codes
5. Login — 5 failed attempts trigger BLOCKED status

**Phase:** Testing (Phase 2) — middleware tests before route tests

---

## Moderate Pitfalls

### Pitfall 7: Security Fix Order — Low-Risk Items First

**What goes wrong:**
Removing Bearer fallback first (cosmetic) before fixing Socket.IO (real breach).

**Prevention — fix in risk order:**
1. Socket.IO auth + room authorization
2. File upload MIME validation
3. Enum/type validation on mutation endpoints
4. Bearer fallback removal (check Clockify integration first — may depend on it)

**Phase:** Security hardening (Phase 1)

---

### Pitfall 8: Refactoring Routes — Leaking HTTP Concerns Into Service Layer

**What goes wrong:**
`rejectIfCancelled(projectId, res)` takes `res` as parameter. Naive extraction copies this into a service where `res` is undefined.

**Prevention:**
Redesign `projectGuard.ts` first: throw custom error or return `{ cancelled: boolean }` instead of writing to `res`. Route handler handles HTTP response. Service becomes HTTP-agnostic.

**Phase:** Structural refactor (Phase 3)

---

### Pitfall 9: generateTaskCode Race Condition — Wrong Fix

**What goes wrong:**
Wrapping in `prisma.$transaction(...)` is not sufficient. Prisma's default `READ COMMITTED` isolation doesn't prevent two concurrent transactions from reading the same max code.

**Correct fix options:**
1. **Unique constraint + retry:** Ensure `Task.code` has unique constraint, catch `P2002`, retry. Lowest-effort correct solution.
2. **Database sequence:** `CREATE SEQUENCE task_code_seq` + `prisma.$queryRaw`

**Phase:** Robustness (Phase 1)

---

### Pitfall 10: Structured Logging — Replacing console.error Everywhere at Once

**Prevention:**
1. Create `src/utils/logger.ts` with minimal Pino instance
2. Add uncaughtException/unhandledRejection handlers
3. Replace in `errorHandler.ts` first (centralized, highest value)
4. Replace in route modules incrementally — one per phase

**Phase:** Observability (Phase 2-3)

---

## Minor Pitfalls

### Pitfall 11: Frontend — Breaking React Query Cache Keys

**Prevention:** Centralize query keys in `queryKeys.ts` before component extraction.

### Pitfall 12: File Upload — fileFilter Trusting mimetype Header

**Prevention:** Use `file-type` package to read magic bytes. multer `fileFilter` with extension whitelist is the first layer; magic byte check is the complete solution.

### Pitfall 13: TypeScript — Enabling strict Mode Globally

**Prevention:** Enable individual flags incrementally: `strictNullChecks` first, then `noImplicitAny` after `any` removal. Fix `api.ts:63` TS2322 in isolation.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Socket.IO auth | JWT on connection but not on room join | Verify membership in `join-project` handler |
| Socket.IO relay | Keeping client-relay events after auth hardening | Move all emit calls to HTTP route handlers |
| File uploads | `multer fileFilter` trusting `mimetype` header | Add magic byte check with `file-type` |
| Security fix order | Removing Bearer fallback before fixing Socket.IO | Fix Socket.IO first |
| Zod validation | Schema too strict on optional fields | Audit frontend payloads before writing schemas |
| Zod validation | Only validating `req.body` | Validate `req.params`, `req.body`, `req.query` |
| `any` removal | Custom union types instead of Prisma WhereInput | Use `Prisma.TaskWhereInput` from `@prisma/client` |
| Test setup | SQLite for Prisma tests | Use real Postgres test DB |
| Test priorities | CRUD route tests before middleware tests | Test authenticate, authorize, rejectIfCancelled first |
| Service extraction | rejectIfCancelled leaking HTTP concerns | Redesign guard contract before extraction |
| generateTaskCode | Wrapping in $transaction and calling it fixed | Unique constraint + retry or DB sequence |
| Logging | Replacing all console.* at once | Start with errorHandler.ts, expand incrementally |
| Component extraction | Query key drift | Centralize query keys before extraction |
| TypeScript strict | Enabling strict globally | Individual flags incrementally |
