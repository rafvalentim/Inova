---
phase: 01-security-hardening
plan: 01
subsystem: api
tags: [socket.io, jwt, helmet, security, authentication, authorization, prisma]

# Dependency graph
requires: []
provides:
  - Socket.IO com autenticação JWT obrigatória (io.use middleware)
  - Guard de membership antes de join-project via Prisma
  - Relay handlers removidos (task-updated, task-moved, task-created, task-deleted, comment-added)
  - Headers de segurança HTTP via Helmet
affects: [02-input-validation, 03-code-quality, 04-testing]

# Tech tracking
tech-stack:
  added: [helmet ^8.1.0]
  patterns:
    - io.use() middleware para autenticação Socket.IO antes de qualquer handler
    - socket.data.userId como forma de propagar identidade autenticada para handlers
    - Membership check via prisma.projectMember.findFirst antes de socket.join()

key-files:
  created: []
  modified:
    - apps/api/src/server.ts
    - apps/api/package.json

key-decisions:
  - "Helmet configurado com contentSecurityPolicy:false e crossOriginEmbedderPolicy:false para compatibilidade com API-only + Socket.IO"
  - "Token Socket.IO lido de cookie (preferido) com fallback para socket.handshake.auth.token para suportar clientes que não enviam cookies"
  - "Relay handlers removidos completamente (não comentados) — o servidor agora emite eventos diretamente via req.app.get('io'), sem intermediação cliente-a-cliente"

patterns-established:
  - "Socket.IO auth: cookie accessToken primeiro, token em handshake.auth.token como fallback"
  - "Room guard: sempre verificar membership via Prisma antes de socket.join()"

requirements-completed: [SEC-01, SEC-02, SEC-03, SEC-04]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 01 Plan 01: Security Hardening — Socket.IO e Helmet Summary

**Socket.IO protegido com JWT obrigatório via io.use(), membership guard no join-project, 5 relay handlers removidos e headers HTTP de segurança via Helmet**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T13:08:44Z
- **Completed:** 2026-04-02T13:11:53Z
- **Tasks:** 2
- **Files modified:** 3 (server.ts, package.json, package-lock.json)

## Accomplishments
- SEC-04: Helmet instalado e configurado como primeiro middleware de segurança HTTP (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.)
- SEC-01: io.use() middleware JWT — qualquer conexão Socket.IO sem token válido é recusada com erro antes de chegar a qualquer handler
- SEC-02: join-project verifica prisma.projectMember.findFirst antes de socket.join() — usuário sem membership recebe erro e não entra na room
- SEC-03: Handlers task-updated, task-moved, task-created, task-deleted, comment-added completamente removidos do servidor

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Instalar Helmet e configurar no server.ts** - `4a911dd` (feat)
2. **Task 2: Socket.IO — JWT auth middleware + membership guard + remoção dos relay handlers** - `4b984ce` (feat)

**Plan metadata:** (a ser criado neste commit de docs)

## Files Created/Modified
- `apps/api/src/server.ts` - Adicionado import helmet, jwt, prisma; app.use(helmet(...)) antes de cors(); io.use() auth middleware; join-project com membership check; relay handlers removidos
- `apps/api/package.json` - Dependência helmet ^8.1.0 adicionada
- `package-lock.json` - Lockfile atualizado com helmet e dependências transitivas

## Decisions Made
- Helmet com `contentSecurityPolicy: false` e `crossOriginEmbedderPolicy: false` para manter compatibilidade com API REST + Socket.IO sem servir HTML
- Token Socket.IO lido de cookie `accessToken` (httpOnly, enviado automaticamente pelo browser) com fallback para `socket.handshake.auth.token` para clientes que não suportam cookies com Socket.IO
- Relay handlers deletados (não comentados) — a emissão de eventos para rooms agora é 100% server-side via `req.app.get('io').to('project:X').emit(...)` nos route handlers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `apps/api/package-lock.json` não estava no workspace `apps/api/` mas na raiz do monorepo — ajustado o `git add` para incluir o lockfile correto (`package-lock.json` na raiz)
- Erros de TypeScript pré-existentes em `apps/api/src/modules/reports/routes.ts` detectados no `tsc --noEmit` — confirmado que nenhum erro novo foi introduzido em `server.ts`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEC-01, SEC-02, SEC-03, SEC-04 concluídos — socket sem auth e relay handlers são vetores fechados
- Phase 02 (Input Validation) pode prosseguir; blocker registrado sobre auditar payloads do frontend antes de escrever schemas Zod permanece válido
- Frontend (`apps/web`) usa `socket.handshake.auth.token` ou envia cookie — auditar `useSocket` ou equivalente no frontend para garantir que o token é passado corretamente

---
*Phase: 01-security-hardening*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: `apps/api/src/server.ts`
- FOUND: `apps/api/package.json`
- FOUND: `.planning/phases/01-security-hardening/01-01-SUMMARY.md`
- FOUND commit `4a911dd`: feat(01-01): instalar Helmet e configurar como primeiro middleware de segurança
- FOUND commit `4b984ce`: feat(01-01): Socket.IO auth middleware, membership guard e remoção dos relay handlers
- Structural: `io.use(` count = 1, `helmet` count = 2, `projectMember.findFirst` count = 1, relay handlers count = 0
