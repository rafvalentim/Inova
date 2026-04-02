# Plano de Implementação — Detecção de Risco & Workflows Customizáveis

**Projeto:** Inova
**Data:** 2026-04-02
**Autor:** Analista + Claude
**Status:** Draft

---

## Visão Geral

Este documento detalha o plano de implementação de duas features:

1. **Detecção de Risco e Alertas Inteligentes** — sistema de monitoramento proativo que identifica riscos em sprints, tasks, membros e projetos usando heurísticas determinísticas sobre dados existentes.

2. **Workflows Customizáveis** — permite que cada projeto defina seus próprios status (colunas do Kanban), regras de transição entre status, e automações disparadas por mudanças de estado.

A ordem de implementação recomendada é: Detecção de Risco primeiro (menor risco, usa dados existentes, não altera schema crítico), Workflows depois (requer mudanças estruturais no schema e em vários pontos do código).

---

# PARTE 1 — Detecção de Risco e Alertas Inteligentes

## 1.1 Conceito

O sistema analisa periodicamente (e sob demanda) os dados de sprints, tasks, membros e projetos para identificar situações de risco. Cada risco identificado gera um alerta com severidade, descrição, contexto e sugestão de ação. Os alertas aparecem no Dashboard e podem ser consultados via API.

Não depende de IA generativa — são regras determinísticas sobre dados que já existem no banco.

## 1.2 Heurísticas de Risco

### Sprints

| ID | Regra | Severidade | Condição |
|----|-------|-----------|----------|
| SPR-01 | Sprint em risco de atraso | HIGH | Sprint ACTIVE com >50% das tasks não-DONE faltando ≤3 dias para endDate |
| SPR-02 | Sprint sobrecarregada | MEDIUM | Soma de storyPoints das tasks > capacityPts da sprint |
| SPR-03 | Sprint sem tasks | LOW | Sprint ACTIVE/PLANNING com 0 tasks associadas |
| SPR-04 | Sprint sem assignees | MEDIUM | Sprint ACTIVE com tasks que não têm nenhum assignee |
| SPR-05 | Burndown fora do esperado | HIGH | Taxa de conclusão < 40% com >60% do tempo da sprint consumido |

### Tasks

| ID | Regra | Severidade | Condição |
|----|-------|-----------|----------|
| TSK-01 | Task crítica sem assignee | HIGH | Task com priority=CRITICAL e 0 assignees |
| TSK-02 | Task atrasada | MEDIUM | dueDate < hoje AND status != DONE |
| TSK-03 | Task parada | MEDIUM | Task em IN_PROGRESS há mais de X dias (config: default 5) sem atualização |
| TSK-04 | Task em review há muito tempo | LOW | Task em IN_REVIEW há mais de X dias (config: default 3) |
| TSK-05 | Task sem estimativa em sprint ativa | LOW | Task em sprint ACTIVE sem storyPoints e sem estimatedHours |

### Membros

| ID | Regra | Severidade | Condição |
|----|-------|-----------|----------|
| MBR-01 | Membro sobrecarregado | HIGH | Membro com >X tasks IN_PROGRESS simultâneas (config: default 5) |
| MBR-02 | Membro com muitas tasks atrasadas | HIGH | Membro com >3 tasks passadas do dueDate |
| MBR-03 | Membro ocioso em sprint ativa | LOW | Membro do projeto sem nenhuma task assignada na sprint ativa |
| MBR-04 | Horas realizadas muito abaixo do estimado | MEDIUM | Membro com <50% das horas estimadas registradas na sprint, faltando <30% do tempo |

### Projetos

| ID | Regra | Severidade | Condição |
|----|-------|-----------|----------|
| PRJ-01 | Projeto sem atividade recente | MEDIUM | Projeto IN_PROGRESS sem nenhuma task atualizada nos últimos 7 dias |
| PRJ-02 | Projeto próximo do prazo | HIGH | targetDate ≤ 14 dias AND % de tasks DONE < 70% |
| PRJ-03 | Horas estouradas | HIGH | Soma de timeEntries > totalEstimatedHours |
| PRJ-04 | Projeto sem sprint ativa | LOW | Projeto IN_PROGRESS sem nenhuma sprint com status ACTIVE |

## 1.3 Modelo de Dados

### Opção escolhida: Cálculo on-demand + cache leve

Não vamos persistir alertas no banco. Em vez disso, calculamos sob demanda quando o dashboard carrega e cacheamos em memória por 5 minutos. Motivo: evita complexidade de sincronização (invalidar alerta quando task muda), não precisa de migration, e o volume de dados por projeto é pequeno o suficiente para calcular em <200ms.

### Interface do Alerta

```typescript
// packages/shared/src/index.ts

type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type RiskCategory = 'SPRINT' | 'TASK' | 'MEMBER' | 'PROJECT';

interface RiskAlert {
  id: string;           // ex: "SPR-01:sprint-uuid"
  ruleId: string;       // ex: "SPR-01"
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;        // ex: "Sprint 3 em risco de atraso"
  description: string;  // ex: "8 de 15 tasks ainda não foram concluídas, faltando 2 dias"
  suggestion: string;   // ex: "Considere reduzir o escopo ou estender o prazo"
  resourceType: string; // "sprint" | "task" | "user" | "project"
  resourceId: string;   // ID do recurso afetado
  resourceName: string; // nome legível
  projectId: string;
  detectedAt: string;   // ISO timestamp
  metadata: Record<string, any>; // dados extras (ex: { daysRemaining: 2, pendingTasks: 8 })
}

interface RiskSummary {
  total: number;
  bySeverity: Record<RiskSeverity, number>;
  byCategory: Record<RiskCategory, number>;
  alerts: RiskAlert[];
}
```

## 1.4 Arquitetura — Backend

### Novo módulo: `apps/api/src/modules/risks/`

```
apps/api/src/modules/risks/
├── routes.ts          # Endpoints da API
├── riskEngine.ts      # Motor de detecção (heurísticas)
├── rules/
│   ├── sprintRules.ts # Regras SPR-01 a SPR-05
│   ├── taskRules.ts   # Regras TSK-01 a TSK-05
│   ├── memberRules.ts # Regras MBR-01 a MBR-04
│   └── projectRules.ts# Regras PRJ-01 a PRJ-04
└── cache.ts           # Cache in-memory simples (Map + TTL)
```

### Motor de Detecção (`riskEngine.ts`)

```typescript
// Pseudo-código do fluxo principal

async function detectRisks(projectId: string): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];

  // Carregar dados necessários em uma query otimizada
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sprints: {
        where: { status: { in: ['ACTIVE', 'PLANNING'] } },
        include: {
          tasks: {
            include: {
              task: {
                include: {
                  assignees: { include: { user: true } },
                  timeEntries: true
                }
              }
            }
          }
        }
      },
      members: { include: { user: true } },
      tasks: {
        where: { status: { not: 'DONE' } },
        include: { assignees: true, timeEntries: true }
      }
    }
  });

  // Executar cada grupo de regras
  alerts.push(...evaluateSprintRules(project));
  alerts.push(...evaluateTaskRules(project));
  alerts.push(...evaluateMemberRules(project));
  alerts.push(...evaluateProjectRules(project));

  // Ordenar por severidade (CRITICAL > HIGH > MEDIUM > LOW)
  return alerts.sort(bySeverity);
}
```

### Endpoints da API

```
GET /api/projects/:projectId/risks
  → RiskSummary (alertas do projeto, com filtro por categoria/severidade)
  → Permissão: dashboard:read

GET /api/risks/summary
  → RiskSummary agregado (todos os projetos do usuário)
  → Permissão: dashboard:read

GET /api/risks/config
  → Configurações de thresholds
  → Permissão: settings:read

PUT /api/risks/config
  → Atualizar thresholds
  → Permissão: settings:update
```

### Cache Strategy

```typescript
// cache.ts — Map simples com TTL de 5 minutos
const cache = new Map<string, { data: RiskSummary; expiresAt: number }>();
const TTL = 5 * 60 * 1000; // 5 min

function getCached(projectId: string): RiskSummary | null {
  const entry = cache.get(projectId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  cache.delete(projectId);
  return null;
}

function setCached(projectId: string, data: RiskSummary): void {
  cache.set(projectId, { data, expiresAt: Date.now() + TTL });
}
```

### Invalidação

Eventos que devem limpar o cache do projeto:
- Task criada, atualizada, movida ou deletada
- Sprint criada, atualizada (status/datas) ou deletada
- Membro adicionado/removido do projeto
- TimeEntry criada

Implementação: chamar `cache.delete(projectId)` nos handlers existentes desses eventos.

## 1.5 Arquitetura — Frontend

### Dashboard — Seção de Riscos

Adicionar ao `DashboardPage.tsx` um novo componente `<RiskAlertPanel />` entre os cards de resumo e os gráficos.

```
┌─────────────────────────────────────────────────┐
│  [Filtros: Projeto | Sprint | Membro | Datas]   │
├─────────────────────────────────────────────────┤
│  📊 Projetos Ativos | Tasks Progresso | Horas | Tasks Atrasadas  │
├─────────────────────────────────────────────────┤
│  ⚠️ ALERTAS DE RISCO (3 HIGH, 2 MEDIUM)        │  ← NOVO
│  ┌──────────────────────────────────────────┐   │
│  │ 🔴 Sprint 3 em risco de atraso          │   │
│  │    8/15 tasks pendentes, faltam 2 dias   │   │
│  ├──────────────────────────────────────────┤   │
│  │ 🟠 João está sobrecarregado             │   │
│  │    6 tasks IN_PROGRESS simultâneas       │   │
│  ├──────────────────────────────────────────┤   │
│  │ 🟡 3 tasks críticas sem responsável     │   │
│  │    TASK-042, TASK-055, TASK-061          │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  [Gráficos: Distribuição | Workload | Progress] │
└─────────────────────────────────────────────────┘
```

### Componentes Novos

```
apps/web/src/components/risks/
├── RiskAlertPanel.tsx    # Container com lista de alertas + contadores
├── RiskAlertCard.tsx     # Card individual de alerta
├── RiskBadge.tsx         # Badge de severidade (reutilizável)
└── RiskSummaryCards.tsx  # Mini-cards com contadores por severidade
```

### Indicadores Visuais no Kanban

No `KanbanPage.tsx`, adicionar ao `KanbanCard`:
- Ícone de warning (⚠️) em tasks que aparecem em algum alerta ativo
- Borda colorida por severidade (vermelho=HIGH, laranja=MEDIUM)
- Tooltip com descrição do risco ao hover

### Query React

```typescript
const { data: risks } = useQuery({
  queryKey: ['risks', projectId],
  queryFn: () => api.get(`/projects/${projectId}/risks`).then(r => r.data.data),
  staleTime: 5 * 60 * 1000, // match backend cache TTL
  enabled: !!projectId
});
```

## 1.6 Fases de Implementação

### Fase 1 — Core Engine (3-4 dias)
1. Criar módulo `risks/` no backend
2. Implementar as 4 regras mais impactantes: SPR-01, TSK-01, TSK-02, MBR-01
3. Criar endpoint `GET /api/projects/:projectId/risks`
4. Adicionar cache in-memory
5. Registrar rota no Express app

### Fase 2 — Dashboard Integration (2-3 dias)
1. Criar componente `RiskAlertPanel`
2. Integrar no `DashboardPage`
3. Adicionar `RiskBadge` e `RiskSummaryCards`
4. Query React com staleTime adequado

### Fase 3 — Cobertura Completa (3-4 dias)
1. Implementar todas as regras restantes (SPR-02→05, TSK-03→05, MBR-02→04, PRJ-01→04)
2. Endpoint agregado `GET /api/risks/summary`
3. Indicadores visuais no Kanban
4. Invalidação de cache nos handlers existentes

### Fase 4 — Configuração (1-2 dias)
1. Tela de configuração de thresholds
2. Endpoints de config (GET/PUT)
3. Persistir configs no banco (nova tabela simples ou usar JSON em settings)

**Total estimado: 9-13 dias**

## 1.7 Configurações Padrão

```typescript
const DEFAULT_RISK_CONFIG = {
  // Sprint
  sprintDeadlineWarningDays: 3,        // SPR-01: dias restantes para alerta
  sprintCompletionThreshold: 0.5,      // SPR-01: % mínimo de tasks pendentes
  sprintBurndownMinRate: 0.4,          // SPR-05: taxa mínima de conclusão

  // Tasks
  taskStuckDays: 5,                    // TSK-03: dias sem atualização
  taskReviewMaxDays: 3,                // TSK-04: max dias em review

  // Members
  memberMaxConcurrentTasks: 5,         // MBR-01: max tasks IN_PROGRESS
  memberMaxOverdueTasks: 3,            // MBR-02: max tasks atrasadas
  memberHoursMinPercentage: 0.5,       // MBR-04: % mínimo de horas

  // Projects
  projectInactivityDays: 7,            // PRJ-01: dias sem atividade
  projectDeadlineWarningDays: 14,      // PRJ-02: dias para o prazo
  projectCompletionMinPercentage: 0.7  // PRJ-02: % mínimo de tasks DONE
};
```

## 1.8 Riscos da Implementação

| Risco | Mitigação |
|-------|-----------|
| Performance da query com muitos projetos | Cache de 5min + query otimizada com select explícito |
| Alertas "ruidosos" (muitos falsos positivos) | Thresholds configuráveis + começar com regras conservadoras |
| Invalidação de cache inconsistente | Começar sem invalidação (TTL puro de 5min); adicionar invalidação pontual depois |

---

# PARTE 2 — Workflows Customizáveis

## 2.1 Conceito

Cada projeto pode definir seu próprio conjunto de status para tasks (colunas do Kanban), regras de transição entre status, e automações que disparam quando uma task muda de status.

Status padrão continua sendo BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE, mas projetos podem customizar livremente.

## 2.2 Modelo de Dados

### Novos modelos no Prisma Schema

```prisma
model Workflow {
  id          String   @id @default(uuid())
  name        String   // "Workflow Padrão", "Workflow Suporte", etc.
  description String?
  isDefault   Boolean  @default(false)  // workflow padrão do sistema
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  statuses    WorkflowStatus[]
  transitions WorkflowTransition[]
  automations WorkflowAutomation[]
  projects    Project[]  // projetos que usam este workflow
}

model WorkflowStatus {
  id         String   @id @default(uuid())
  workflowId String
  workflow   Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  name       String   // "Backlog", "Em Desenvolvimento", "QA", etc.
  slug       String   // "BACKLOG", "IN_DEV", "QA" — usado internamente
  color      String   // "#6b7280"
  position   Int      // ordem no Kanban (0, 1, 2...)
  isInitial  Boolean  @default(false)  // status de criação de task
  isFinal    Boolean  @default(false)  // status de conclusão (equivale a "DONE")

  @@unique([workflowId, slug])
  @@unique([workflowId, position])
}

model WorkflowTransition {
  id           String   @id @default(uuid())
  workflowId   String
  workflow     Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  fromStatusId String   // WorkflowStatus.id ("*" para "de qualquer status")
  toStatusId   String   // WorkflowStatus.id
  name         String?  // label opcional da transição ("Enviar para Review")

  @@unique([workflowId, fromStatusId, toStatusId])
}

model WorkflowAutomation {
  id           String   @id @default(uuid())
  workflowId   String
  workflow     Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  trigger      AutomationTrigger  // ON_ENTER, ON_EXIT, ON_TRANSITION
  triggerStatusId String?          // status que dispara (null = qualquer)
  action       AutomationAction   // NOTIFY_LEADER, ASSIGN_REVIEWER, SET_FIELD, etc.
  config       Json               // parâmetros da ação (quem notificar, qual campo, etc.)
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
}

enum AutomationTrigger {
  ON_ENTER       // task entra neste status
  ON_EXIT        // task sai deste status
  ON_ASSIGN      // task recebe assignee
  ON_OVERDUE     // task passa do dueDate
}

enum AutomationAction {
  NOTIFY_MEMBER      // notificar membro específico
  NOTIFY_LEADER      // notificar líder do projeto
  NOTIFY_ASSIGNEES   // notificar assignees da task
  SET_FIELD          // alterar campo da task (ex: priority)
  ADD_COMMENT        // adicionar comentário automático
  MOVE_TASK          // mover para outro status após X tempo
}
```

### Alteração no modelo Project

```prisma
model Project {
  // ... campos existentes ...
  workflowId  String?
  workflow    Workflow?  @relation(fields: [workflowId], references: [id])
}
```

### Alteração no modelo Task

```prisma
model Task {
  // Substituir o enum TaskStatus por string
  status      String    @default("BACKLOG")  // referencia WorkflowStatus.slug
  // ... demais campos mantidos ...
}
```

**Impacto:** Mudar `status` de enum para String é a mudança mais significativa. Requer migration cuidadosa e atualização de todos os pontos que referenciam `TaskStatus`.

### Migration Strategy

```sql
-- 1. Criar tabelas novas (Workflow, WorkflowStatus, etc.)

-- 2. Criar workflow padrão com os 5 status atuais
INSERT INTO "Workflow" (id, name, "isDefault") VALUES ('default-workflow', 'Workflow Padrão', true);
INSERT INTO "WorkflowStatus" VALUES
  ('ws-backlog',     'default-workflow', 'Backlog',      'BACKLOG',     '#6b7280', 0, true,  false),
  ('ws-todo',        'default-workflow', 'To Do',        'TODO',        '#3b82f6', 1, false, false),
  ('ws-in-progress', 'default-workflow', 'Em Progresso', 'IN_PROGRESS', '#f59e0b', 2, false, false),
  ('ws-in-review',   'default-workflow', 'Em Revisão',   'IN_REVIEW',   '#8b5cf6', 3, false, false),
  ('ws-done',        'default-workflow', 'Concluído',    'DONE',        '#22c55e', 4, false, true);

-- 3. Adicionar transições padrão (todos → todos para manter comportamento atual)

-- 4. Associar projetos existentes ao workflow padrão
UPDATE "Project" SET "workflowId" = 'default-workflow';

-- 5. Alterar coluna status de Task: enum → varchar
ALTER TABLE "Task" ALTER COLUMN "status" TYPE VARCHAR(50);
```

## 2.3 Arquitetura — Backend

### Novo módulo: `apps/api/src/modules/workflows/`

```
apps/api/src/modules/workflows/
├── routes.ts          # CRUD de workflows + endpoints de status/transição
├── validation.ts      # Validar transições permitidas
├── automation.ts      # Motor de automações
└── defaults.ts        # Workflow padrão (seed)
```

### Endpoints da API

```
# Workflows
GET    /api/workflows                    # Listar workflows disponíveis
POST   /api/workflows                    # Criar workflow
GET    /api/workflows/:id                # Detalhe com statuses + transitions
PUT    /api/workflows/:id                # Atualizar workflow
DELETE /api/workflows/:id                # Deletar (só se nenhum projeto usa)

# Statuses dentro de um workflow
POST   /api/workflows/:id/statuses       # Adicionar status
PUT    /api/workflows/:id/statuses/:sid  # Editar status
DELETE /api/workflows/:id/statuses/:sid  # Remover status (só se nenhuma task nele)
PATCH  /api/workflows/:id/statuses/reorder  # Reordenar posições

# Transições
PUT    /api/workflows/:id/transitions    # Definir todas as transições (batch replace)

# Automações
GET    /api/workflows/:id/automations    # Listar automações
POST   /api/workflows/:id/automations    # Criar automação
PUT    /api/workflows/:id/automations/:aid  # Editar
DELETE /api/workflows/:id/automations/:aid  # Deletar

# Projeto ↔ Workflow
PATCH  /api/projects/:id/workflow        # Associar workflow ao projeto
GET    /api/projects/:id/workflow        # Obter workflow do projeto (com statuses)
```

### Validação de Transição

```typescript
// validation.ts

async function validateTransition(
  projectId: string,
  fromStatus: string,
  toStatus: string
): Promise<{ valid: boolean; message?: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflow: {
        include: { transitions: true, statuses: true }
      }
    }
  });

  if (!project?.workflow) {
    // Projeto sem workflow customizado — permitir tudo (backward compatible)
    return { valid: true };
  }

  const fromStatusObj = project.workflow.statuses.find(s => s.slug === fromStatus);
  const toStatusObj = project.workflow.statuses.find(s => s.slug === toStatus);

  if (!fromStatusObj || !toStatusObj) {
    return { valid: false, message: `Status inválido` };
  }

  const allowed = project.workflow.transitions.some(
    t => (t.fromStatusId === fromStatusObj.id || t.fromStatusId === '*') &&
         t.toStatusId === toStatusObj.id
  );

  if (!allowed) {
    return {
      valid: false,
      message: `Transição de "${fromStatusObj.name}" para "${toStatusObj.name}" não permitida`
    };
  }

  return { valid: true };
}
```

### Motor de Automações

```typescript
// automation.ts

async function executeAutomations(
  projectId: string,
  taskId: string,
  trigger: AutomationTrigger,
  statusSlug: string
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflow: {
        include: {
          automations: { where: { isActive: true } },
          statuses: true
        }
      }
    }
  });

  const statusObj = project?.workflow?.statuses.find(s => s.slug === statusSlug);
  if (!statusObj) return;

  const matchingAutomations = project.workflow.automations.filter(
    a => a.trigger === trigger &&
         (a.triggerStatusId === null || a.triggerStatusId === statusObj.id)
  );

  for (const automation of matchingAutomations) {
    await executeAction(automation.action, automation.config, { projectId, taskId, statusSlug });
  }
}

async function executeAction(
  action: AutomationAction,
  config: any,
  context: { projectId: string; taskId: string; statusSlug: string }
): Promise<void> {
  switch (action) {
    case 'NOTIFY_LEADER':
      // Emitir evento Socket.IO para o líder do projeto
      break;
    case 'NOTIFY_ASSIGNEES':
      // Emitir evento Socket.IO para assignees da task
      break;
    case 'ADD_COMMENT':
      // Criar comentário automático na task
      break;
    case 'SET_FIELD':
      // Atualizar campo da task (ex: priority)
      break;
    // ...
  }
}
```

### Pontos de Integração — Código Existente

#### `tasks/routes.ts` — Mudanças Necessárias

```
PATCH /:id/status
  ANTES: valida contra array hardcoded ['BACKLOG', 'TODO', ...]
  DEPOIS: chama validateTransition(projectId, oldStatus, newStatus)
          + chama executeAutomations(ON_EXIT, oldStatus)
          + chama executeAutomations(ON_ENTER, newStatus)

PATCH /:id/position (drag-and-drop)
  ANTES: valida contra COLUMNS array
  DEPOIS: mesma lógica de validateTransition

POST / (criar task)
  ANTES: status default = 'BACKLOG'
  DEPOIS: status default = workflow.statuses.find(s => s.isInitial).slug
```

#### `sprints/routes.ts` — Mudanças Necessárias

```
autoCompleteOverdueSprints():
  ANTES: filtra tasks com status NOT IN ['DONE']
  DEPOIS: filtra tasks cujo status NÃO tem isFinal=true no workflow

syncProjectStatus():
  ANTES: busca tasks com status='IN_PROGRESS'
  DEPOIS: busca tasks cujo status NÃO é isInitial e NÃO é isFinal (ou seja, "em andamento")
```

#### `dashboard/routes.ts` — Mudanças Necessárias

```
task-distribution:
  ANTES: hardcoded ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
  DEPOIS: busca statuses do workflow do projeto filtrado
```

#### `KanbanPage.tsx` — Mudanças Necessárias

```
COLUMNS:
  ANTES: const hardcoded
  DEPOIS: query GET /projects/:id/workflow → statuses ordenados por position

handleDragEnd:
  ANTES: valida contra COLUMNS
  DEPOIS: valida contra statuses do workflow + checa transição permitida (opcional: client-side)

TaskFormFields (status selector):
  ANTES: opções hardcoded
  DEPOIS: opções vindas do workflow
```

### Shared Types

```typescript
// packages/shared/src/index.ts — adicionar

interface WorkflowStatusItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  isInitial: boolean;
  isFinal: boolean;
}

interface WorkflowTransitionItem {
  id: string;
  fromStatusId: string;
  toStatusId: string;
  name?: string;
}

interface WorkflowAutomationItem {
  id: string;
  trigger: AutomationTrigger;
  triggerStatusId?: string;
  action: AutomationAction;
  config: Record<string, any>;
  isActive: boolean;
}

interface WorkflowDetail {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  statuses: WorkflowStatusItem[];
  transitions: WorkflowTransitionItem[];
  automations: WorkflowAutomationItem[];
}
```

## 2.4 Arquitetura — Frontend

### Novas Páginas e Componentes

```
apps/web/src/pages/
├── WorkflowEditorPage.tsx    # Editor visual de workflow (statuses + transições)

apps/web/src/components/workflows/
├── StatusEditor.tsx           # CRUD de statuses (drag para reordenar)
├── TransitionMatrix.tsx       # Matriz checkbox (fromStatus × toStatus)
├── AutomationEditor.tsx       # Lista de automações com formulário
├── WorkflowPreview.tsx        # Preview visual do fluxo (mini-kanban)
```

### Editor de Transições — Matriz Visual

```
              → Backlog  → To Do  → In Dev  → QA  → Done
Backlog          —         ✅       ❌       ❌     ❌
To Do           ✅          —       ✅       ❌     ❌
In Dev          ❌         ❌        —       ✅     ❌
QA              ❌         ❌       ✅        —     ✅
Done            ❌         ❌       ❌       ❌      —
```

Cada célula é um checkbox. Salva em batch via `PUT /workflows/:id/transitions`.

### Rota no App.tsx

```typescript
<Route
  path="/projects/:id/workflow"
  element={
    <AuthorizedRoute resource="projects" action="update">
      <WorkflowEditorPage />
    </AuthorizedRoute>
  }
/>
```

## 2.5 Fases de Implementação

### Fase 1 — Schema e Migration (2-3 dias)
1. Criar modelos Prisma (Workflow, WorkflowStatus, WorkflowTransition, WorkflowAutomation)
2. Adicionar workflowId ao Project
3. Alterar Task.status de enum para String
4. Criar migration com seed do workflow padrão
5. Associar projetos existentes ao workflow padrão
6. Atualizar shared types

### Fase 2 — API CRUD de Workflows (3-4 dias)
1. Módulo `workflows/routes.ts` com CRUD completo
2. Endpoint `GET /projects/:id/workflow` (retorna workflow com statuses)
3. Validação: impedir deletar status com tasks
4. Validação: impedir deletar workflow em uso
5. Seed automático: ao criar projeto sem workflow, associar o padrão

### Fase 3 — Integração nos Fluxos Existentes (3-4 dias)
1. `tasks/routes.ts`: validar transições + status dinâmicos
2. `sprints/routes.ts`: adaptar autoComplete e syncProjectStatus
3. `dashboard/routes.ts`: task-distribution dinâmico
4. Testes manuais de todos os fluxos afetados

### Fase 4 — Kanban Dinâmico (2-3 dias)
1. `KanbanPage.tsx`: carregar colunas do workflow
2. Drag-and-drop com validação de transição (visual feedback)
3. Status selector dinâmico nos formulários de task
4. Cores customizáveis nas colunas

### Fase 5 — Editor de Workflow (3-4 dias)
1. `WorkflowEditorPage` com StatusEditor
2. TransitionMatrix (checkbox grid)
3. Preview visual
4. Integrar na navegação do projeto

### Fase 6 — Automações (3-4 dias)
1. Motor de automações no backend
2. Integrar com mudanças de status (tasks)
3. UI de configuração de automações
4. Notificações via Socket.IO

**Total estimado: 16-22 dias**

## 2.6 Riscos da Implementação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Migração Task.status (enum→string) quebra queries | ALTO | Testar TODAS as queries que filtram por status antes de mergear |
| Projetos sem workflow causam erros | ALTO | Fallback para workflow padrão; nunca permitir project sem workflowId |
| Transições impedem drag-and-drop intuitivo | MÉDIO | Feedback visual claro (coluna fica vermelha se transição não permitida) |
| Automações com loops infinitos | MÉDIO | Máximo de 5 automações encadeadas; flag `triggeredByAutomation` para evitar recursão |
| Performance com muitos status/transições | BAIXO | Limitar a 15 status e 100 transições por workflow |

---

# CRONOGRAMA CONSOLIDADO

```
SEMANA 1-2:  Detecção de Risco — Fases 1-2 (engine + dashboard)
SEMANA 3:    Detecção de Risco — Fases 3-4 (cobertura completa + config)
SEMANA 4:    Workflows — Fase 1 (schema + migration)
SEMANA 5:    Workflows — Fases 2-3 (API + integração)
SEMANA 6:    Workflows — Fase 4 (Kanban dinâmico)
SEMANA 7:    Workflows — Fases 5-6 (editor + automações)
SEMANA 8:    Testes, polish, edge cases, documentação
```

**Total: ~8 semanas trabalhando solo com auxílio de IA**

---

# DECISÕES EM ABERTO

1. **Notificações:** Usar apenas Socket.IO (in-app) ou adicionar email/push?
2. **Templates de workflow:** Oferecer templates pré-definidos (Scrum, Kanban, Suporte) além do padrão?
3. **Permissões de workflow:** Quem pode editar o workflow de um projeto? Só admin e líder?
4. **Histórico de risco:** Vale persistir um snapshot diário dos alertas para análise de tendência?
5. **Risco no Kanban:** Mostrar alertas diretamente nos cards ou só no dashboard?
