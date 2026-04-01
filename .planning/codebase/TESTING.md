---
focus: quality
generated: 2026-04-01
---

# Testing

## Summary
O projeto **não possui testes automatizados**. Nenhum framework de teste está configurado, nenhum arquivo de teste existe no codebase, e não há scripts de teste nos `package.json`. Todo o processo de qualidade é manual.

## Current State

### Test Files
**Nenhum arquivo de teste encontrado.** Não há `*.test.ts`, `*.spec.ts`, `__tests__/` ou similar em nenhum dos pacotes.

### Test Frameworks
**Nenhum configurado.** Os seguintes frameworks não estão presentes:
- Jest
- Vitest
- Mocha
- Supertest (para testes de integração de API)
- React Testing Library
- Playwright / Cypress (E2E)

### package.json Scripts
Nenhum dos `apps/api/package.json` ou `apps/web/package.json` define script `test`.

## What Should Be Tested (Gap Analysis)

### API — Crítico (alta complexidade, alta criticidade)
- `authenticate` middleware — verificação de JWT, cookie vs Bearer, usuário inativo
- `authorize` middleware — RBAC por resource/action, bypass de Administrador
- `tasks/routes.ts` — lógica de criação, atualização de status, posição e permissões de assignee
- `projectGuard.ts` — `rejectIfCancelled` bloqueia escrita em projetos cancelados
- `generateTaskCode()` — geração sequencial única de códigos TASK-XXX
- `syncProjectStatus()` — atualização automática de status do projeto

### API — Importante
- `auth/routes.ts` — login, refresh token, logout, bloqueio por tentativas falhas
- `sprints/routes.ts` — encerramento de sprint, movimentação de tasks incompletas
- `projects/routes.ts` — criação, atualização, cancelamento de projeto

### Frontend — Importantes
- `authStore.ts` — `hasPermission()`, `refreshUserProfile()`, hidratação do persist
- `api.ts` — interceptor de refresh silencioso, fila de requests durante refresh
- `KanbanPage.tsx` — lógica de DnD, criação/edição/exclusão de tasks

## Recommended Next Steps

1. **Adicionar Vitest** para a API (mais leve que Jest, compatível com ESM/TS)
2. **Adicionar Supertest** para testes de integração dos routes
3. **Começar pelo middleware de auth** — menor superfície, maior cobertura de risco
4. **Usar banco em memória** (SQLite + Prisma) para testes de integração isolados

## Risk Without Tests

| Área | Risco |
|---|---|
| Auth/JWT | Regressão silenciosa em refresh token ou RBAC |
| Task positions | Inconsistência no DnD após mudanças no backend |
| Permissões | Escalação de privilégio se RBAC mudar |
| Geração de código | Colisão de TASK-XXX em concorrência |
| syncProjectStatus | Loop infinito ou status incorreto |
