# Features Research — Hardening & Code Quality

## Summary

Research into table stakes for production-ready Node/Express in 2025, applied to Inova's current state. Zod 3.23.8 is installed but unused. Helmet is absent. Socket.IO has zero auth. All 10 modules use `console.error` only.

## Table Stakes (Must-Have — Security/Reliability)

| Priority | Feature | Complexity | Evidence |
|----------|---------|------------|----------|
| 1 | Helmet security headers | Low | Missing from server.ts and package.json entirely |
| 2 | Remove Bearer fallback in production | Low | `auth.ts:23` — `cookieToken \|\| bearerToken` unconditional |
| 3 | MIME fileFilter on multer | Low | `tasks/routes.ts:26-29` — no `fileFilter`, any file type accepted |
| 4 | Socket.IO JWT auth on connection | Medium | `server.ts:35` — zero auth check on connection event |
| 5 | Socket.IO room membership check | Medium | `server.ts:38` — `join-project` accepts any `projectId` |
| 6 | Zod on all mutating endpoints (body) | High | Zod 3.23.8 installed, zero usage in any module |
| 7 | Zod on query parameters | Medium | `tasks/routes.ts:72-98` — raw strings into Prisma `where` |
| 8 | `generateTaskCode` with `prisma.$transaction` | Medium | CONCERNS.md flags race condition; `console.warn` fallback confirms awareness |
| 9 | Pino structured logging | Low | All 10 modules use `console.error` only |
| 10 | Vitest + auth middleware tests | Medium | Zero tests; TESTING.md recommends this entry point |

## Differentiators (Nice-to-Have Quality)

- Extract `TaskService` from 692-line `tasks/routes.ts` (enables unit testing)
- Extract `AuthService` from 361-line `auth/routes.ts`
- Custom hooks `useKanbanTasks`, `useKanbanDnd` from KanbanPage (521 lines)
- Custom hooks for ProjectDetailPage (631 lines)
- Pragmatic `any` elimination in query builders using `Prisma.TaskWhereInput`
- Fix TS2322 in `api.ts:63` so `tsc --noEmit` exits clean

## Anti-Features (Deliberately Avoid)

- **Full service/repository layer rewrite** across all 10 modules — only extract where critical (tasks, auth, sprints)
- **Full `strict: true` in one pass** — do file-by-file starting at auth boundary
- **New auth mechanism** — existing JWT + httpOnly is sound; fix the gaps within it
- **E2E testing (Playwright/Cypress)** — out of scope per PROJECT.md
- **Log management SaaS** — Pino local JSON output is sufficient for dev environment

## Feature Dependencies

```
Socket.IO connection auth → room auth
Zod schemas → any elimination in query builders
Fix TS2322 → TypeScript strict pass
Vitest setup → auth tests → task/RBAC tests
Helmet → one app.use() call (no dependencies)
Pino → independent (can happen anytime)
```

## Complexity Assessment

| Effort | Features |
|--------|----------|
| Quick wins (< 1 hour) | Helmet, MIME filter, Bearer env guard, .env.example |
| Medium (1-4 hours) | Socket.IO auth, Pino logging, generateTaskCode transaction, TS2322 fix |
| Large (4+ hours) | Zod on all endpoints, service layer extraction, Vitest setup + tests |
| Ongoing | `any` elimination, component decomposition |
