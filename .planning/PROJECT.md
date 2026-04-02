# Inova — Revisão e Hardening

## What This Is

Inova é uma plataforma de gestão de projetos com Kanban, sprints, time tracking e controle de acesso por roles. Este ciclo foca em revisão geral de qualidade: segurança, limpeza de código, robustez dos fluxos e adição de testes básicos — tanto no backend quanto no frontend.

## Core Value

O sistema precisa ser **seguro e confiável** — auth sólido, validação de entrada consistente, RBAC sem brechas, e código limpo o suficiente para evoluir sem medo.

## Requirements

### Validated

- ✓ Autenticação JWT com httpOnly cookies e refresh silencioso — existing
- ✓ RBAC por resource/action (middleware authorize + hasPermission no frontend) — existing
- ✓ Kanban board com DnD (@dnd-kit) e criação/edição/exclusão de tasks — existing
- ✓ Gestão de sprints (criar, ativar, encerrar, mover tasks incompletas) — existing
- ✓ Time entries manuais e integração Clockify — existing
- ✓ Dashboard com métricas por projeto/sprint/membro — existing
- ✓ Audit log de todas as operações de escrita — existing
- ✓ Gestão de projetos (criar, editar, cancelar, membros) — existing
- ✓ Gestão de roles e permissões granulares — existing
- ✓ Gestão de usuários (criar, ativar/desativar, reset de senha) — existing
- ✓ Socket.IO configurado para eventos real-time (task-updated, task-moved, etc.) — existing
- ✓ Socket.IO autenticado com JWT + membership guard + server-side emit only — Phase 1
- ✓ Helmet security headers configurados na API — Phase 1
- ✓ Upload de attachments com validação MIME via magic bytes — Phase 1
- ✓ generateTaskCode protegido contra race condition (unique + retry P2002) — Phase 1
- ✓ Comentários em tasks — existing
- ✓ Subtasks — existing
- ✓ Roteamento contextual por role (HomeRedirect) — existing

### Active

- [ ] Adicionar validação de schema em todos os endpoints (Zod ou similar)
- [ ] Eliminar uso excessivo de `any` nos route handlers da API
- [ ] Separar lógica de negócio dos routes onde for crítico (tasks, auth, sprints)
- [ ] Corrigir erro TS2322 em api.ts (failedQueue typing)
- [ ] Melhorar robustez dos fluxos gerais (frontend e backend)
- [ ] Componentizar páginas monolíticas onde necessário (KanbanPage, ProjectDetailPage)
- [ ] Adicionar logging estruturado na API (substituir console.log/error)
- [ ] Criar .env.example para onboarding de devs

### Out of Scope

- Features novas de produto (notificações, relatórios avançados, mobile) — foco é hardening
- Migração de banco ou troca de ORM — Prisma está funcionando bem
- SSR ou mudança de framework frontend — React/Vite atendem
- Cobertura de testes completa — apenas pontos críticos neste ciclo
- Redesign de UI — apenas melhorias estruturais nos componentes

## Context

- Projeto brownfield com codebase funcional e em uso só pelo desenvolvedor
- Monorepo com `apps/api` (Node/Express/Prisma/PostgreSQL) e `apps/web` (React/Vite/Ant Design)
- Zero testes automatizados hoje
- Codebase map completo em `.planning/codebase/` com análise de stack, arquitetura, convenções, concerns
- API usa routes monolíticas (lógica de negócio inline) — refactor estrutural onde for crítico, incremental no resto
- Socket.IO existe mas sem autenticação de conexões
- `any` é usado extensivamente em query builders dinâmicos

## Constraints

- **Stack**: Manter Node/Express/Prisma no backend e React/Vite/Ant Design no frontend
- **Abordagem**: Refactor estrutural onde for crítico (auth, tasks, sprints); incremental no resto
- **Testes**: Básicos nos pontos críticos — não buscar cobertura total
- **Ambiente**: Só dev — liberdade para mudanças sem preocupação com migração em produção

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Segurança como prioridade #1 | Socket.IO sem auth + uploads sem filtro + validação inconsistente são os maiores riscos | — Pending |
| Refactor "depende" — estrutural onde crítico | Tasks/auth/sprints justificam separação de camadas; o resto melhora incrementalmente | — Pending |
| Testes básicos, não cobertura total | Zero → algo nos pontos críticos já é um grande avanço sem over-engineering | — Pending |
| Zod para validação de schema | Padrão moderno para TypeScript, integra bem com Prisma types | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 after Phase 1 completion*
