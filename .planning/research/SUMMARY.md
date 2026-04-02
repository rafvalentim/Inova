# Project Research Summary

**Project:** Inova — Project Management App (brownfield hardening)
**Domain:** Node/Express + React monorepo — security, validation, testing, refactoring
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

Inova is a functioning project management app with a sound architectural foundation (JWT + httpOnly cookies, Prisma, React Query, DnD) that has accumulated predictable production-readiness gaps: no input validation despite Zod being already installed, no security headers, zero Socket.IO authentication, and no test coverage. The recommended approach is a strictly ordered incremental hardening effort — security gaps first, then validation infrastructure, then service extraction to enable testing, then TypeScript cleanup. This order is non-negotiable because Zod schemas define the typed interfaces that service-layer extraction consumes; reversing it means moving `any` around rather than eliminating it.

The biggest risks are not technical complexity but sequencing mistakes and scope creep. Socket.IO has two distinct vulnerabilities (no JWT on connection, no room membership check) that must both be fixed — fixing only the first leaves a real breach. Zod validation written without auditing actual frontend payloads will break existing calls. Testing with SQLite will silently fail due to PostgreSQL-specific features in the codebase. None of these are hard problems; all of them are easy to get wrong without advance awareness.

The good news: most of the stack is already in place. Zod is installed. Vitest integrates with the existing Vite setup. Helmet is one `app.use()` call. The bulk of the work is writing schemas, tests, and extracting the three routes files that have real business logic complexity (tasks at 692 lines, auth at ~360, sprints at ~250). The remaining 7 modules should be left mostly as-is.

## Key Findings

### Recommended Stack

No new major libraries are required. Zod 3.23.8 is already in `package.json` — zero installation cost, work is writing schemas and the validate middleware. Vitest handles the hybrid ESM/CJS monorepo natively and shares config infrastructure with the existing Vite setup, avoiding the painful Jest transform configuration that would otherwise be needed. Helmet is the only missing package and is a single `app.use()` call. Pino replaces `console.error` calls and is ~5x faster than Winston for Docker/stdout output. File-type v18 (CJS-compatible) adds magic byte validation on top of multer's extension filter.

**Core technologies:**
| Tool | Purpose | Rationale |
|------|---------|-----------|
| Zod 3.23.8 | Input validation | Already installed, TypeScript-native, zero migration cost |
| Vitest ^3.x + Supertest ^7.x | API testing | Native ESM/CJS hybrid support, Jest-compatible API |
| Vitest + @testing-library/react | Frontend testing | Shared runner, existing Vite config reuse |
| Helmet | Security headers | 14+ missing headers; one call fixes OWASP recommendations |
| Pino + pino-http | Structured logging | NDJSON for Docker, ~5x faster than Winston |
| file-type v18 | Upload security | Magic byte validation, CJS-compatible pin |

**Critical version note:** file-type v19+ is ESM-only. Pin to v18 for the CJS API.

### Expected Features

**Must have (table stakes) — security/reliability:**
1. Helmet security headers — completely absent from server.ts
2. Socket.IO JWT auth on connection handshake — zero auth check today
3. Socket.IO room membership check before `socket.join()` — separate from #2, both required
4. Remove client-to-server-to-client Socket.IO relay events — move all emits to HTTP route handlers
5. MIME fileFilter on multer — any file type currently accepted
6. Zod validation on all mutating endpoints (body + query params + route params)
7. `generateTaskCode` with unique constraint + retry — race condition confirmed in codebase
8. Pino structured logging — all 10 modules use console.error only
9. Vitest + auth middleware tests (authenticate, authorize, rejectIfCancelled)
10. Remove Bearer fallback in production auth (after verifying Clockify integration dependency)

**Should have (quality differentiators):**
- Extract TaskService from 692-line tasks/routes.ts (enables unit testing)
- Extract AuthService from 361-line auth/routes.ts
- Extract SprintService from ~250-line sprints/routes.ts
- Custom hooks useKanbanTasks, useKanbanDnd from 521-line KanbanPage.tsx
- KanbanColumn, TaskDetailModal, TaskCreateForm subcomponents
- Fix TS2322 in api.ts:63 so `tsc --noEmit` exits clean
- `any` elimination using Prisma.TaskWhereInput in query builders

**Defer (not in scope):**
- Repository layer over Prisma (Prisma IS the data access layer)
- Full strict: true in one pass
- E2E testing (Playwright/Cypress)
- Log management SaaS
- Service extraction for roles, audit, users, reports, clockify (leave as-is)

### Architecture Approach

The refactoring follows a layered dependency chain that cannot be reordered: security fixes first (no schemas needed), then Zod validation (creates typed interfaces), then service extraction (consumes those types to become testable), then TypeScript strictness cleanup (natural side-effect of the previous phases). Frontend decomposition is independent of backend changes and can run in parallel with Phase 3+. The architecture target is thin Express routes (HTTP concerns only) + service files (business logic, HTTP-agnostic) + schema files (Zod contracts), with Prisma remaining as the data access layer — no repository abstraction.

**Major components:**
1. `middleware/validate.ts` (NEW) — Zod factory middleware for body, query, and params
2. `modules/*/schemas.ts` (NEW) — Zod schemas + inferred types per module
3. `modules/tasks/task.service.ts`, `modules/auth/auth.service.ts`, `modules/sprints/sprint.service.ts` (NEW) — extracted business logic, consumes schema types
4. `modules/*/routes.ts` (REFACTORED) — becomes thin: auth + validate + service call + response
5. `config/logger.ts` (NEW) — Pino instance, replaces console calls incrementally
6. `hooks/useKanbanTasks.ts`, `hooks/useKanbanDnd.ts`, subcomponents (NEW) — frontend decomposition

### Critical Pitfalls

1. **Socket.IO: JWT on connection is not enough** — must also check ProjectMember table in `join-project` handler before `socket.join()`. Missing the second check leaves a full data leak for users with valid credentials but no project membership.

2. **Socket.IO relay events** — after adding auth, the client-to-server-to-client relay pattern remains. Any authenticated user can emit `task-updated` with fabricated data that poisons React Query caches with no HTTP request. Fix: delete relay handlers, move all `io.emit()` calls to HTTP route handlers post-DB-write.

3. **Zod schemas written without auditing frontend payloads** — schemas too strict on optional fields (e.g., storyPoints) will break existing frontend calls with 400s. Audit actual request payloads before writing each schema. All optional fields need `.optional()` or `.default()`.

4. **generateTaskCode race condition fix** — wrapping in `prisma.$transaction` is insufficient under READ COMMITTED isolation. Correct fix: add unique constraint on `Task.code` + catch P2002 + retry. Or use a DB sequence.

5. **SQLite for Prisma tests** — this codebase uses PostgreSQL-specific features (`hasSome`, `mode: 'insensitive'`, JSON field operations). SQLite tests will fail silently or give false passes. Use real PostgreSQL via Docker.

## Implications for Roadmap

### Phase 1: Security Hardening
**Rationale:** Security gaps are independent of validation infrastructure and have the highest risk-to-effort ratio. Socket.IO vulnerabilities allow data exfiltration without touching any auth endpoint. Must come before any structural refactoring.
**Delivers:** Helmet headers, Socket.IO JWT auth + room membership, Socket.IO relay removal, multer MIME validation, generateTaskCode race fix, Pino logger setup
**Addresses:** Features #1-4, #7, #8 from table stakes
**Avoids:** Pitfalls 1, 2, 7 (socket auth gaps), Pitfall 9 (task code race), Pitfall 12 (file upload)
**Research flag:** Standard patterns — skip research-phase. Helmet and Pino are one-liners; Socket.IO auth pattern is documented in ARCHITECTURE.md.

### Phase 2: Input Validation + Test Foundation
**Rationale:** Zod schemas provide typed interfaces that Phase 3 service extraction depends on. Tests must be written before refactoring to catch regressions. These two workstreams are coupled: write a schema, add validate middleware to the route, write tests for that route's middleware behavior.
**Delivers:** Zod middleware factory, schemas for all mutating endpoints + query params, Vitest setup for API and frontend, auth middleware test suite (authenticate, authorize, rejectIfCancelled, generateTaskCode uniqueness)
**Addresses:** Features #5, #6, #9, #10 from table stakes
**Avoids:** Pitfalls 3 (schema scope), 5 (SQLite), 6 (testing wrong behaviors)
**Research flag:** Standard patterns for Vitest setup. Zod schema writing needs per-endpoint audit of frontend payloads — not external research, internal audit work.

### Phase 3: Service Layer Extraction
**Rationale:** Extracting business logic is only safe after schemas exist (typed inputs) and tests exist (regression protection). Only the three modules with real complexity warrant extraction. The other 7 modules should be left as-is.
**Delivers:** TaskService (692-line routes.ts decomposed), AuthService (360-line), SprintService (~250-line); routes.ts files become thin HTTP handlers; `rejectIfCancelled` guard redesigned to be HTTP-agnostic
**Addresses:** Differentiator features: service extraction, any reduction in query builders
**Avoids:** Pitfall 8 (HTTP concerns leaking into services)
**Research flag:** Standard patterns — service/controller separation is well-documented. Main risk is the rejectIfCancelled guard redesign (see Pitfall 8); handle that explicitly before starting the tasks module extraction.

### Phase 4: Frontend Decomposition + TypeScript Cleanup
**Rationale:** Frontend changes are independent of backend phases and can start in parallel with Phase 3. TypeScript cleanup is the natural last step — most `any` usage will have been eliminated as a side-effect of Phases 2-3; this phase finishes the job.
**Delivers:** useKanbanTasks, useKanbanDnd hooks; KanbanColumn, TaskDetailModal, TaskCreateForm components; centralized queryKeys.ts; TS2322 fix in api.ts:63; any elimination in remaining query builders; incremental TypeScript flag tightening (strictNullChecks first)
**Addresses:** Differentiator features: component decomposition, any elimination, TS compliance
**Avoids:** Pitfalls 11 (query key drift), 13 (strict mode globally)
**Research flag:** Standard patterns — skip research-phase.

### Phase Ordering Rationale

- Security before validation: security gaps require no schema infrastructure and carry the highest breach risk. Sequencing validation first would delay critical fixes.
- Validation before service extraction: Zod schemas define the typed contracts that make service functions useful rather than just moving `any` to a new file. This dependency is hard — not a style preference.
- Tests alongside validation (Phase 2): the auth middleware is the ideal first test surface (isolated, no DB for unit tests). Writing tests before Phase 3 refactoring provides the regression net.
- Frontend decomposition is genuinely parallel to Phase 3-4 backend work. It has no dependency on service extraction.

### Research Flags

Needs deeper research during planning:
- **Phase 1 (Socket.IO relay removal):** Verify which socket events the frontend currently consumes. The removal plan requires mapping all `socket.on(...)` calls in the frontend before deleting server-side handlers.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Helmet, Pino, MIME filter):** Implementation patterns are fully documented in STACK.md and ARCHITECTURE.md.
- **Phase 2 (Vitest setup):** One config file per app workspace. Patterns in STACK.md.
- **Phase 3 (service extraction):** Controller/service pattern is standard; specific implementation target is in ARCHITECTURE.md.
- **Phase 4 (component decomposition):** Hooks-first strategy documented in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations based on direct codebase analysis (package.json, server.ts, routes files) + current 2025 community consensus |
| Features | HIGH | Table stakes derived from live code inspection — specific file and line references throughout |
| Architecture | HIGH | Build order based on hard type-system dependencies, not opinion. Service pattern is established. |
| Pitfalls | HIGH (codebase) / MEDIUM (general) | Critical pitfalls are codebase-specific findings. Moderate/minor pitfalls are patterns from community experience. |

**Overall confidence:** HIGH

### Gaps to Address

- **Bearer fallback removal:** Clockify integration may use Bearer tokens. Audit `clockify/routes.ts` and any Clockify webhook inbound paths before removing the `cookieToken || bearerToken` fallback to avoid breaking integrations.
- **Socket.IO frontend event map:** No inventory of which `socket.on(...)` calls exist in the React frontend. Required before deleting server-side relay handlers. Quick grep task, not a research gap.
- **zod-prisma-types codegen:** Evaluate whether auto-generating Zod schemas from Prisma schema is worthwhile after manual schemas for tasks/auth/sprints are written. Decision point at end of Phase 2.
- **Test database strategy:** Docker PostgreSQL is recommended. Confirm Docker is available in the dev environment and CI pipeline before committing to this approach.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `apps/api/src/server.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/package.json`
- CONCERNS.md in project planning (generateTaskCode race condition explicitly flagged)
- TESTING.md in project planning (auth middleware as recommended test entry point)

### Secondary (MEDIUM confidence)
- Zod 3.x documentation — validation patterns
- Vitest documentation — ESM/CJS hybrid configuration
- Prisma documentation — WhereInput types, $transaction isolation levels
- Socket.IO documentation — io.use() middleware pattern

### Tertiary (LOW confidence)
- file-type v18 vs v19 CJS compatibility — needs validation against actual API import() support

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
