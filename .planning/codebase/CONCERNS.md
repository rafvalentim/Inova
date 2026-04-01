---
focus: concerns
generated: 2026-04-01
---

# Concerns & Tech Debt

## Summary
O projeto está funcional e com arquitetura razoável, mas acumula dívida técnica significativa nas camadas de qualidade: sem testes, uso frequente de `any`, e algumas lacunas de segurança na camada de API. A falta de validação de entrada em vários endpoints é o risco mais imediato.

## Critical Issues

### Sem Testes Automatizados
Nenhum arquivo de teste existe em todo o codebase. Mudanças em lógica crítica (auth, RBAC, task positions) não têm rede de segurança. Ver `TESTING.md` para análise completa.

### TypeScript Error em Produção
`apps/web/src/services/api.ts:63` — erro TS2322 pré-existente e conhecido (type mismatch em `failedQueue`). Não afeta runtime mas indica que o compilador não está bloqueando erros.

### Validação de Entrada Inconsistente
A maioria dos endpoints valida apenas campos obrigatórios (ex: `if (!title)`). Não há biblioteca de validação de schema (Zod, Joi, Yup). Exemplos de ausência:
- `PUT /api/tasks/:id` — aceita `status` fora do enum sem validação do `authorize` middleware
- `PATCH /api/tasks/:id/position` — `position` pode ser qualquer valor
- Campos numéricos (`storyPoints`, `estimatedHours`) recebem `parseInt`/`parseFloat` sem validar se são números válidos

## Tech Debt

### `any` Extensivo na API
Usado em praticamente todos os route handlers para query builders dinâmicos:
```typescript
const where: any = {};
const data: any = {};
const filter: any = {};
```
Arquivos afetados: `tasks/routes.ts`, `projects/routes.ts`, `dashboard/routes.ts`, `audit/routes.ts`, `roles/routes.ts`, `sprints/routes.ts`, `reports/routes.ts`, `auth/routes.ts`.

### Routes Monolíticas
Cada módulo tem um único `routes.ts` misturando roteamento, lógica de negócio e acesso a dados. O arquivo `tasks/routes.ts` tem 692 linhas. Sem separação controller/service/repository dificulta reuso e testabilidade.

### Páginas Frontend Monolíticas
`KanbanPage.tsx` e `ProjectDetailPage.tsx` são grandes (>400 linhas cada) sem extração de hooks ou subcomponentes. Toda lógica de UI, queries e estado local fica inline.

### `generateTaskCode()` Sem Transação
A geração de código `TASK-XXX` usa `findMany` + cálculo manual fora de uma transação. Em ambiente de alta concorrência, dois requests simultâneos podem gerar o mesmo código.

### Seed Modificado (git status)
`apps/api/prisma/seed.ts` aparece como modificado no git status. Mudanças não commitadas podem causar divergência entre ambientes.

### Socket.IO Sem Autenticação
O namespace Socket.IO em `server.ts` aceita conexões sem verificar o JWT do usuário. Qualquer cliente pode se juntar a uma sala `project:${projectId}` e receber eventos de tasks em tempo real.

## Security Concerns

### Socket.IO Rooms Sem Autorização
Qualquer usuário autenticado (ou não autenticado — veja acima) pode emitir `join-project` com qualquer `projectId` e receber eventos de projetos que não tem acesso.

### Bearer Token Como Fallback
`middleware/auth.ts` aceita `Authorization: Bearer <token>` como fallback ao cookie httpOnly. Isso enfraquece o modelo de segurança se tokens forem expostos (ex: logs, ferramentas de dev).

### Uploads Sem Validação de MIME Real
`multer` está configurado com `limits.fileSize` mas sem `fileFilter` por tipo MIME. Qualquer tipo de arquivo pode ser enviado para `POST /api/tasks/:id/attachments`.

### Clockify API Key em Request
`apps/api/src/modules/clockify/routes.ts` recebe/usa API key — verificar se está em env vars ou sendo passada pelo cliente.

## Performance Risks

### N+1 em Dashboard
`dashboard/routes.ts` executa múltiplas queries dentro de loops para agregar dados por projeto/membro. Pode ser lento com muitos projetos.

### `findMany` Sem Paginação em Alguns Endpoints
`GET /api/tasks/my-tasks` retorna todas as tasks do usuário sem paginação. Com volume alto, pode ser lento.

### React Query Sem Stale Time
Sem configuração de `staleTime`, todas as queries refazem fetch a cada re-mount de componente.

## Missing Coverage

### Funcionalidades Referenciadas Mas Incompletas
- `packages/shared/src/index.ts` existe mas não se sabe o que exporta atualmente
- Socket.IO está configurado no backend mas o frontend (`KanbanPage.tsx`) pode ou não consumir — verificar

### Logging Estruturado
Toda a API usa `console.error()` e `console.log()`. Sem logging estruturado (Winston, Pino), difícil de agregar e monitorar em produção.

### Variáveis de Ambiente
Sem `.env.example` visível no repo — novos desenvolvedores não sabem quais vars são necessárias sem ler `apps/api/src/config/index.ts`.

## TODOs & FIXMEs

Nenhum comentário `TODO`, `FIXME` ou `HACK` encontrado explicitamente no código fonte (além de um `console.warn` em `generateTaskCode()` para fallback de coluna ausente).
