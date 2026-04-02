# Roadmap: Inova — Revisão e Hardening

## Overview

Este milestone transforma o Inova de um app funcional em um sistema seguro e confiável. O trabalho parte das lacunas de maior risco (Socket.IO sem auth, uploads sem filtro) e avança em ordem de dependência: segurança primeiro, validação de schema segundo (que cria os tipos necessários para a camada de serviço), refactor de backend terceiro, e decomposição de frontend em paralelo com o final do backend. Cada fase entrega uma capacidade verificável independentemente.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Security Hardening** - Fecha as lacunas de segurança críticas: Socket.IO auth, Helmet, MIME filter e race condition do generateTaskCode
- [ ] **Phase 2: Input Validation + Observability** - Adiciona validação Zod em todos os endpoints e substitui console.log/error por Pino estruturado
- [ ] **Phase 3: Backend Service Layer** - Extrai lógica de negócio dos routes de tasks, auth e sprints para services testáveis; redesenha projectGuard
- [ ] **Phase 4: Frontend Decomposition + Quality** - Decompõe páginas monolíticas em hooks/subcomponentes, centraliza query keys e elimina erros de TypeScript

## Phase Details

### Phase 1: Security Hardening
**Goal**: O sistema rejeita conexões e uploads não autorizados — nenhum vetor de exfiltração de dados via Socket.IO ou upload permanece aberto
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. Conexão Socket.IO sem JWT válido é recusada antes de qualquer handler ser invocado
  2. Um usuário autenticado sem membership em um projeto não consegue fazer join na room daquele projeto
  3. Eventos Socket.IO só são emitidos pelo servidor após mutações HTTP confirmadas no banco — nenhum cliente pode injetar eventos fabricados
  4. Respostas HTTP da API incluem headers de segurança (X-Content-Type-Options, X-Frame-Options, etc.) definidos pelo Helmet
  5. Upload de arquivo com MIME type inválido (ex: .exe renomeado para .jpg) é rejeitado com 400 antes de ser salvo
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Socket.IO JWT auth + membership guard + relay removal + Helmet (SEC-01, SEC-02, SEC-03, SEC-04)
- [ ] 01-02-PLAN.md — MIME validation via file-type, generateTaskCode race fix, Socket.IO emit no HTTP (SEC-03, SEC-05, SEC-06)

### Phase 2: Input Validation + Observability
**Goal**: Todos os endpoints validam inputs com schemas Zod e a API emite logs estruturados em vez de console.log
**Depends on**: Phase 1
**Requirements**: VAL-01, VAL-02, VAL-03, VAL-04, REF-05, REF-06
**Success Criteria** (what must be TRUE):
  1. Qualquer requisição POST/PUT/PATCH com body inválido retorna 400 com mensagem de erro descritiva (campo + motivo)
  2. Requisições de listagem com query params inválidos (ex: pageSize negativo, status desconhecido) retornam 400 em vez de silenciosamente ignorar
  3. IDs de rota que não são UUID retornam 400 antes de chegar ao banco
  4. Logs da API aparecem em formato NDJSON no stdout com campos request_id, method, path, status e duration — sem nenhum console.log/error remanescente
**Plans**: TBD

### Phase 3: Backend Service Layer
**Goal**: Lógica de negócio de tasks, auth e sprints reside em services HTTP-agnósticos; routes ficam como thin handlers de HTTP
**Depends on**: Phase 2
**Requirements**: REF-01, REF-02, REF-03, REF-04
**Success Criteria** (what must be TRUE):
  1. tasks/routes.ts, auth/routes.ts e sprints/routes.ts contêm apenas: autenticação, validação, chamada ao service e resposta HTTP — sem lógica de negócio inline
  2. TaskService, AuthService e SprintService podem ser instanciados e chamados em testes sem inicializar o servidor Express
  3. projectGuard lança um erro tipado em vez de chamar res.status() diretamente — pode ser usado em contextos não-HTTP
**Plans**: TBD

### Phase 4: Frontend Decomposition + Quality
**Goal**: Páginas monolíticas são decompostas em hooks e subcomponentes reutilizáveis; erros de TypeScript no frontend são eliminados
**Depends on**: Phase 2 (pode iniciar em paralelo com Phase 3)
**Requirements**: FE-01, FE-02, FE-03, QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. KanbanPage.tsx tem menos de 200 linhas — lógica de dados em useKanbanTasks, lógica de DnD em useKanbanDnd, e colunas/modais em subcomponentes
  2. ProjectDetailPage.tsx tem menos de 150 linhas — lógica extraída em hooks e subcomponentes dedicados
  3. Query keys de React Query são definidas em um único arquivo queryKeys.ts — nenhuma string literal de query key duplicada nos componentes
  4. `tsc --noEmit` em apps/web completa sem erros (TS2322 corrigido, `any` nos query builders eliminado)
  5. .env.example existe na raiz do projeto com todas as variáveis documentadas
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 1/2 | In Progress|  |
| 2. Input Validation + Observability | 0/TBD | Not started | - |
| 3. Backend Service Layer | 0/TBD | Not started | - |
| 4. Frontend Decomposition + Quality | 0/TBD | Not started | - |
