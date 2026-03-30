# PRD — Sistema Inova

## Plataforma de Gestão de Projetos e Times de Desenvolvimento

**Versão:** 1.0  
**Data:** 09/03/2026  
**Autor:** Rafael (Product Owner) | Claude (PM/Tech Lead assistente)  
**Status:** Em planejamento

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Problema e Proposta de Valor](#2-problema-e-proposta-de-valor)
3. [Público-alvo e Personas](#3-público-alvo-e-personas)
4. [Arquitetura e Stack Tecnológico](#4-arquitetura-e-stack-tecnológico)
5. [Requisitos Funcionais](#5-requisitos-funcionais)
6. [Requisitos Não Funcionais](#6-requisitos-não-funcionais)
7. [Modelo de Dados](#7-modelo-de-dados)
8. [Fluxos de Tela (Wireframes Descritivos)](#8-fluxos-de-tela-wireframes-descritivos)
9. [Roadmap e Fases de Entrega](#9-roadmap-e-fases-de-entrega)
10. [Matriz de Permissões (RBAC)](#10-matriz-de-permissões-rbac)
11. [API Endpoints (Visão Geral)](#11-api-endpoints-visão-geral)
12. [Integração com Clockify](#12-integração-com-clockify)
13. [Estratégia de Testes](#13-estratégia-de-testes)
14. [Deploy e Infraestrutura](#14-deploy-e-infraestrutura)
15. [Riscos e Mitigações](#15-riscos-e-mitigações)
16. [Métricas de Sucesso](#16-métricas-de-sucesso)
17. [Glossário](#17-glossário)

---

## 1. Visão Geral do Produto

O **Inova** é um sistema interno de gestão de projetos e acompanhamento de times de desenvolvimento, projetado para equipes de 6 a 15 pessoas. O sistema permite que gestores tenham visibilidade completa sobre o andamento de projetos, que analistas organizem sprints e requisitos, e que desenvolvedores registrem e acompanhem suas tarefas diárias de forma transparente.

O Inova adota uma abordagem **híbrida (Scrum + Kanban)**, combinando a cadência de sprints com a flexibilidade visual de um quadro Kanban. Essa escolha se justifica pelo tamanho do time (6-15 pessoas), que se beneficia de entregas iterativas com cerimônias leves, sem a rigidez de um Scrum puro.

**Deploy:** On-premise (servidor próprio da organização).

---

## 2. Problema e Proposta de Valor

### 2.1 Problemas identificados

- **Falta de visibilidade:** Gestores não têm uma visão consolidada e em tempo real de quem está trabalhando em quê, qual o progresso de cada projeto e onde estão os gargalos.
- **Rastreio de tempo fragmentado:** O acompanhamento de horas trabalhadas depende de ferramentas externas (como Clockify) sem integração direta com as tarefas do projeto.
- **Organização descentralizada:** Tasks, sprints e backlog ficam espalhados entre planilhas, mensagens e ferramentas diversas, dificultando a priorização e o planejamento.
- **Falta de histórico e auditoria:** Sem log de atividades, é difícil entender o histórico de decisões e mudanças em tarefas e projetos.

### 2.2 Proposta de Valor

> O Inova centraliza a gestão de projetos, tarefas e tempo do time de desenvolvimento em uma única plataforma on-premise, dando visibilidade em tempo real para gestores, organização para analistas e clareza para desenvolvedores sobre suas entregas.

### 2.3 Diferenciais

- Fluxo híbrido Scrum + Kanban adaptado para times pequenos/médios.
- Integração nativa com Clockify para rastreamento automático de horas.
- Dashboard de acompanhamento com métricas visuais para gestores.
- Audit trail completo para compliance e rastreabilidade.
- Deploy on-premise com controle total dos dados.

---

## 3. Público-alvo e Personas

### 3.1 Atores do Sistema

| Ator | Descrição | Objetivos principais |
|------|-----------|---------------------|
| **Administrador** | Responsável pela configuração do sistema, gerenciamento de usuários, tipos de usuário e parâmetros globais. | Manter o sistema operacional, gerenciar acessos e permissões, configurar integrações. |
| **Gestor** | Líder ou gerente de projeto(s). Precisa de visão macro sobre andamento, prazos e alocação do time. | Acompanhar dashboards, aprovar sprints, identificar gargalos, gerar relatórios. |
| **Analista** | Responsável por levantar requisitos, organizar o backlog, planejar sprints e definir tarefas. | Criar e priorizar tasks, planejar sprints, documentar requisitos, acompanhar progresso. |
| **Desenvolvedor** | Membro do time que executa as tarefas técnicas. Precisa de clareza sobre o que fazer e registrar seu progresso. | Visualizar tasks atribuídas, atualizar status, registrar tempo, comentar em tarefas. |

### 3.2 Persona primária: Gestor — "Carlos"

- **Contexto:** Gerencia 2-3 projetos simultâneos com um time de 10 pessoas.
- **Dor:** Perde tempo coletando informações de diferentes fontes para montar relatórios semanais.
- **Expectativa:** Abrir o Inova e em 30 segundos entender o status de todos os projetos.

### 3.3 Persona primária: Desenvolvedor — "Ana"

- **Contexto:** Trabalha em 1-2 projetos, precisa saber exatamente quais tarefas são prioridade.
- **Dor:** Recebe demandas por diferentes canais (Slack, email, verbal) e perde o controle.
- **Expectativa:** Um único lugar para ver suas tasks, atualizar status e registrar horas.

---

## 4. Arquitetura e Stack Tecnológico

### 4.1 Stack Definido

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | React 18+ com TypeScript | Componentização, tipagem forte, ecossistema maduro. |
| **UI Framework** | Ant Design ou Shadcn/UI + Tailwind | Componentes prontos para dashboards e formulários complexos. |
| **State Management** | Zustand ou React Query | Leve, performático, ideal para o tamanho da aplicação. |
| **Backend** | Node.js com Express ou Fastify + TypeScript | Performance, JSON nativo, mesma linguagem do front. |
| **ORM** | Prisma | Type-safe, migrations automáticas, boa DX. |
| **Banco de Dados** | PostgreSQL 15+ | Robusto, relacional, ideal para dados estruturados de projetos. |
| **Autenticação** | JWT + bcrypt (com refresh token) | Padrão stateless, adequado para on-premise. |
| **Realtime** | Socket.IO | Atualizações em tempo real no Kanban board. |
| **File Storage** | Disco local (on-premise) com abstração para S3 futuramente | Anexos de tasks. |
| **Cache** | Redis (opcional, fase 2) | Cache de sessão e dados frequentes. |

### 4.2 Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                  │
│  React + TypeScript + Ant Design / Shadcn            │
│  State: Zustand / React Query                        │
└───────────────┬──────────────────────────────────────┘
                │ HTTPS (REST API + WebSocket)
┌───────────────▼──────────────────────────────────────┐
│              SERVIDOR DE APLICAÇÃO                    │
│  Node.js + Express/Fastify + TypeScript              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │  Auth   │ │ Projects │ │  Tasks   │ │ Reports │  │
│  │ Module  │ │  Module  │ │  Module  │ │ Module  │  │
│  └─────────┘ └──────────┘ └──────────┘ └─────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────┐    │
│  │  Users   │ │  Sprints  │ │ Clockify Proxy   │    │
│  │  Module  │ │  Module   │ │ (Integração)     │    │
│  └──────────┘ └───────────┘ └──────────────────┘    │
│  Socket.IO Server (real-time updates)                │
└──────┬───────────────┬───────────────┬───────────────┘
       │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────────┐
│ PostgreSQL  │ │ File System │ │ Clockify API    │
│ (Dados)     │ │ (Anexos)    │ │ (Externa)       │
└─────────────┘ └─────────────┘ └─────────────────┘
```

### 4.3 Estrutura de Pastas (Monorepo)

```
inova/
├── apps/
│   ├── web/                  # Frontend React
│   │   ├── src/
│   │   │   ├── components/   # Componentes reutilizáveis
│   │   │   ├── pages/        # Telas da aplicação
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── services/     # Chamadas API
│   │   │   ├── store/        # State management
│   │   │   ├── types/        # TypeScript types
│   │   │   └── utils/        # Utilitários
│   │   └── package.json
│   └── api/                  # Backend Node.js
│       ├── src/
│       │   ├── modules/      # Módulos de domínio
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── projects/
│       │   │   ├── sprints/
│       │   │   ├── tasks/
│       │   │   ├── reports/
│       │   │   └── clockify/
│       │   ├── middleware/    # Auth, logging, error handling
│       │   ├── config/       # Configurações
│       │   └── shared/       # Utilitários compartilhados
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── packages/
│   └── shared/               # Types e utils compartilhados
├── docker-compose.yml
├── .env.example
└── package.json              # Workspace root
```

---

## 5. Requisitos Funcionais

### 5.1 Módulo de Autenticação (RF-AUTH)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-AUTH-001 | O sistema deve permitir login com email e senha. | Alta | 1 |
| RF-AUTH-002 | O sistema deve implementar JWT com access token (15min) e refresh token (7 dias). | Alta | 1 |
| RF-AUTH-003 | O sistema deve permitir recuperação de senha via email com token temporário (válido por 1h). | Alta | 1 |
| RF-AUTH-004 | O sistema deve bloquear o usuário após 5 tentativas de login inválidas por 15 minutos. | Média | 1 |
| RF-AUTH-005 | O sistema deve registrar todas as tentativas de login (sucesso e falha) no audit log. | Média | 1 |
| RF-AUTH-006 | O sistema deve permitir que o usuário altere sua própria senha (exigindo a senha atual). | Alta | 1 |
| RF-AUTH-007 | O sistema deve permitir logout, invalidando o refresh token. | Alta | 1 |

### 5.2 Módulo de Usuários (RF-USER)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-USER-001 | O Administrador deve poder cadastrar novos usuários (nome, email, senha temporária, tipo). | Alta | 1 |
| RF-USER-002 | O Administrador deve poder listar, editar e desativar (soft delete) usuários. | Alta | 1 |
| RF-USER-003 | O sistema deve obrigar o usuário a trocar a senha no primeiro login. | Média | 1 |
| RF-USER-004 | Cada usuário deve ter um perfil com: nome, email, avatar (upload), tipo de usuário e status (ativo/inativo). | Alta | 1 |
| RF-USER-005 | O sistema deve permitir busca e filtro na listagem de usuários (por nome, tipo, status). | Média | 1 |

### 5.3 Módulo de Tipos de Usuário (RF-ROLE)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-ROLE-001 | O Administrador deve poder cadastrar tipos de usuário (roles) com nome e descrição. | Alta | 1 |
| RF-ROLE-002 | Cada tipo de usuário deve ter permissões configuráveis por módulo (CRUD por recurso). | Alta | 1 |
| RF-ROLE-003 | O sistema deve vir com 4 roles pré-configurados: Administrador, Gestor, Analista, Desenvolvedor. | Alta | 1 |
| RF-ROLE-004 | Roles pré-configurados não podem ser excluídos, apenas editados. | Média | 1 |

### 5.4 Módulo de Projetos (RF-PROJ)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-PROJ-001 | Analistas e Gestores devem poder cadastrar projetos com: nome, descrição, data início, data previsão de término, status e membros vinculados. | Alta | 1 |
| RF-PROJ-002 | O status do projeto segue o ciclo: Planejamento → Em andamento → Pausado → Concluído → Cancelado. | Alta | 1 |
| RF-PROJ-003 | Cada projeto deve ter uma lista de membros com seus respectivos papéis no projeto. | Alta | 1 |
| RF-PROJ-004 | O sistema deve permitir busca, filtro e ordenação de projetos (por status, data, responsável). | Média | 1 |
| RF-PROJ-005 | Ao criar um projeto, o sistema deve gerar automaticamente um código único (ex: PROJ-001). | Baixa | 1 |
| RF-PROJ-006 | O projeto deve exibir um resumo com: total de sprints, total de tasks, % conclusão, horas registradas. | Alta | 2 |

### 5.5 Módulo de Sprints (RF-SPRINT)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-SPRINT-001 | Analistas devem poder criar sprints dentro de um projeto com: nome, objetivo, data início, data fim e duração padrão configurável (1-4 semanas). | Alta | 2 |
| RF-SPRINT-002 | Cada sprint tem um ciclo: Planejamento → Ativa → Concluída → Cancelada. | Alta | 2 |
| RF-SPRINT-003 | Apenas uma sprint por projeto pode estar ativa por vez. | Alta | 2 |
| RF-SPRINT-004 | Ao concluir uma sprint, tasks não finalizadas devem poder ser movidas para a próxima sprint ou para o backlog. | Alta | 2 |
| RF-SPRINT-005 | A sprint deve exibir um burndown chart com o progresso diário das tasks. | Média | 2 |
| RF-SPRINT-006 | O sistema deve permitir definir a capacidade da sprint em story points. | Baixa | 2 |

### 5.6 Módulo de Tasks (RF-TASK)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-TASK-001 | Analistas e Gestores devem poder criar tasks com: título, descrição (rich text), prioridade, responsável(is), sprint vinculada, data limite, story points e tags. | Alta | 2 |
| RF-TASK-002 | O fluxo de status da task no Kanban deve ser: Backlog → To Do → In Progress → In Review → Done. | Alta | 2 |
| RF-TASK-003 | Desenvolvedores devem poder mover suas tasks entre colunas via drag-and-drop no quadro Kanban. | Alta | 2 |
| RF-TASK-004 | Cada task deve ter uma seção de comentários onde qualquer membro do projeto pode interagir. | Alta | 2 |
| RF-TASK-005 | Deve ser possível anexar arquivos a uma task (imagens, documentos, até 10MB por arquivo). | Média | 2 |
| RF-TASK-006 | O sistema deve permitir definir dependências entre tasks (bloqueada por / bloqueia). | Baixa | 3 |
| RF-TASK-007 | Cada task deve exibir o tempo total registrado (via Clockify ou manual). | Alta | 3 |
| RF-TASK-008 | Deve ser possível criar subtasks vinculadas a uma task pai. | Média | 3 |
| RF-TASK-009 | O sistema deve permitir filtrar tasks por: responsável, prioridade, status, sprint, tags. | Alta | 2 |
| RF-TASK-010 | O sistema deve permitir a visualização das tasks em modo Kanban (board) e modo Lista (table). | Alta | 2 |

### 5.7 Módulo de Dashboard — Gestores (RF-DASH)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-DASH-001 | O dashboard deve exibir cards resumo: projetos ativos, tasks em andamento, tasks atrasadas, horas registradas na semana. | Alta | 3 |
| RF-DASH-002 | O dashboard deve exibir um gráfico de distribuição de tasks por status (pizza/donut). | Alta | 3 |
| RF-DASH-003 | O dashboard deve exibir o progresso de cada projeto ativo em barra de progresso. | Alta | 3 |
| RF-DASH-004 | O dashboard deve permitir filtro por projeto, período e equipe. | Média | 3 |
| RF-DASH-005 | O dashboard deve exibir a carga de trabalho por membro do time (tasks atribuídas vs concluídas). | Média | 3 |
| RF-DASH-006 | O dashboard deve destacar visualmente tasks atrasadas (vencidas e não concluídas). | Alta | 3 |

### 5.8 Módulo de Relatórios (RF-REP)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-REP-001 | O sistema deve permitir exportar relatório de sprint (tasks, status, responsáveis, tempo) em PDF e Excel. | Alta | 3 |
| RF-REP-002 | O sistema deve permitir exportar relatório de projeto consolidado em PDF e Excel. | Alta | 3 |
| RF-REP-003 | O sistema deve permitir exportar relatório de horas por membro em um período. | Média | 3 |
| RF-REP-004 | Relatórios devem incluir o logotipo da empresa (configurável pelo Administrador). | Baixa | 3 |

### 5.9 Módulo de Audit Log (RF-LOG)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-LOG-001 | O sistema deve registrar toda ação relevante: criação, edição, exclusão, mudança de status, login, alteração de permissão. | Alta | 2 |
| RF-LOG-002 | Cada entrada no log deve conter: timestamp, usuário, ação, recurso afetado, valor anterior e novo valor. | Alta | 2 |
| RF-LOG-003 | Administradores e Gestores devem poder consultar o log com filtros (usuário, ação, período, recurso). | Média | 2 |
| RF-LOG-004 | Logs não podem ser editados ou excluídos (imutáveis). | Alta | 2 |

### 5.10 Módulo de Integração Clockify (RF-CLK)

| ID | Requisito | Prioridade | Fase |
|----|-----------|-----------|------|
| RF-CLK-001 | O Administrador deve poder configurar a API Key do Clockify e o Workspace ID nas configurações do sistema. | Alta | 4 |
| RF-CLK-002 | Cada usuário deve poder vincular seu user ID do Clockify ao perfil no Inova. | Alta | 4 |
| RF-CLK-003 | O sistema deve sincronizar as entradas de tempo do Clockify e vinculá-las às tasks correspondentes (via tag ou descrição padronizada). | Alta | 4 |
| RF-CLK-004 | A sincronização deve ocorrer via cron job a cada 15 minutos e também sob demanda (botão "Sincronizar agora"). | Média | 4 |
| RF-CLK-005 | O sistema deve exibir o tempo total registrado por task, sprint e projeto com base nos dados do Clockify. | Alta | 4 |
| RF-CLK-006 | Caso o Clockify esteja indisponível, o sistema deve permitir registro manual de horas diretamente na task. | Média | 4 |

---

## 6. Requisitos Não Funcionais

| ID | Categoria | Requisito | Meta |
|----|-----------|-----------|------|
| RNF-001 | Performance | O tempo de carregamento de qualquer tela deve ser inferior a 2 segundos. | < 2s |
| RNF-002 | Performance | A API deve responder em menos de 500ms para 95% das requisições. | p95 < 500ms |
| RNF-003 | Escalabilidade | O sistema deve suportar até 50 usuários simultâneos sem degradação. | 50 concurrent |
| RNF-004 | Disponibilidade | O sistema deve ter uptime de 99% em horário comercial (8h-18h). | 99% |
| RNF-005 | Segurança | Todas as senhas devem ser armazenadas com bcrypt (cost factor 12). | bcrypt(12) |
| RNF-006 | Segurança | Toda comunicação deve usar HTTPS (TLS 1.2+). | TLS 1.2+ |
| RNF-007 | Segurança | O sistema deve implementar rate limiting na API (100 req/min por IP). | 100 req/min |
| RNF-008 | Segurança | Tokens JWT devem ser armazenados em httpOnly cookies (não localStorage). | httpOnly |
| RNF-009 | Segurança | O sistema deve proteger contra OWASP Top 10 (XSS, CSRF, SQL Injection, etc.). | OWASP Top 10 |
| RNF-010 | Usabilidade | O sistema deve ser responsivo (desktop-first, funcional em tablets). | Responsive |
| RNF-011 | Usabilidade | O sistema deve seguir WCAG 2.1 nível AA para acessibilidade. | WCAG 2.1 AA |
| RNF-012 | Manutenibilidade | Cobertura de testes unitários mínima de 80% no backend. | ≥ 80% |
| RNF-013 | Backup | O banco de dados deve ter backup automático diário com retenção de 30 dias. | Diário / 30d |
| RNF-014 | Internacionalização | O sistema deve ser desenvolvido em português brasileiro (pt-BR) com estrutura preparada para i18n futuro. | pt-BR |

---

## 7. Modelo de Dados

### 7.1 Diagrama Entidade-Relacionamento (Conceitual)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    roles     │     │    users     │     │  audit_logs  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │◄────│ role_id (FK) │     │ id (PK)      │
│ name         │     │ id (PK)      │────►│ user_id (FK) │
│ description  │     │ name         │     │ action       │
│ permissions  │     │ email        │     │ resource     │
│ is_system    │     │ password     │     │ old_value    │
│ created_at   │     │ avatar_url   │     │ new_value    │
│ updated_at   │     │ status       │     │ ip_address   │
└──────────────┘     │ clockify_id  │     │ created_at   │
                     │ first_login  │     └──────────────┘
                     │ created_at   │
                     │ updated_at   │
                     └──────┬───────┘
                            │
                    ┌───────▼────────┐
                    │ project_members│
                    ├────────────────┤
                    │ id (PK)        │
                    │ project_id(FK) │◄────┐
                    │ user_id (FK)   │     │
                    │ role_in_project│     │
                    │ joined_at      │     │
                    └────────────────┘     │
                                           │
┌──────────────┐     ┌──────────────┐     │
│   sprints    │     │   projects   │─────┘
├──────────────┤     ├──────────────┤
│ id (PK)      │◄────│ id (PK)      │
│ project_id   │     │ code         │
│ name         │     │ name         │
│ goal         │     │ description  │
│ start_date   │     │ status       │
│ end_date     │     │ start_date   │
│ status       │     │ target_date  │
│ capacity_pts │     │ created_by   │
│ created_at   │     │ created_at   │
│ updated_at   │     │ updated_at   │
└──────┬───────┘     └──────────────┘
       │
┌──────▼───────┐     ┌──────────────┐     ┌──────────────┐
│    tasks     │     │  comments    │     │ attachments  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │────►│ task_id (FK) │     │ id (PK)      │
│ sprint_id(FK)│     │ id (PK)      │     │ task_id (FK) │
│ project_id   │     │ user_id (FK) │     │ filename     │
│ parent_id    │     │ content      │     │ filepath     │
│ title        │     │ created_at   │     │ size_bytes   │
│ description  │     │ updated_at   │     │ mime_type    │
│ status       │     └──────────────┘     │ uploaded_by  │
│ priority     │                          │ created_at   │
│ story_points │     ┌──────────────┐     └──────────────┘
│ due_date     │     │ time_entries │
│ position     │     ├──────────────┤
│ tags         │     │ id (PK)      │
│ created_by   │     │ task_id (FK) │
│ created_at   │     │ user_id (FK) │
│ updated_at   │     │ duration_min │
└──────────────┘     │ description  │
       │             │ clockify_id  │
       ▼             │ source       │
┌──────────────┐     │ date         │
│ task_assignees│    │ created_at   │
├──────────────┤     └──────────────┘
│ task_id (FK) │
│ user_id (FK) │
│ assigned_at  │
└──────────────┘
```

### 7.2 Prisma Schema (Resumo)

```prisma
// schema.prisma — Resumo das entidades principais

model User {
  id          String   @id @default(uuid())
  name        String
  email       String   @unique
  password    String
  avatarUrl   String?
  status      UserStatus @default(ACTIVE)
  firstLogin  Boolean  @default(true)
  clockifyId  String?
  roleId      String
  role        Role     @relation(fields: [roleId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  permissions Json     // { "users": ["read","write"], "projects": ["read","write","delete"], ... }
  isSystem    Boolean  @default(false)
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Project {
  id          String        @id @default(uuid())
  code        String        @unique  // PROJ-001
  name        String
  description String?
  status      ProjectStatus @default(PLANNING)
  startDate   DateTime?
  targetDate  DateTime?
  createdById String
  members     ProjectMember[]
  sprints     Sprint[]
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Sprint {
  id          String       @id @default(uuid())
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id])
  name        String
  goal        String?
  startDate   DateTime
  endDate     DateTime
  status      SprintStatus @default(PLANNING)
  capacityPts Int?
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Task {
  id          String     @id @default(uuid())
  projectId   String
  sprintId    String?
  parentId    String?    // subtask reference
  title       String
  description String?    // rich text (HTML)
  status      TaskStatus @default(BACKLOG)
  priority    Priority   @default(MEDIUM)
  storyPoints Int?
  dueDate     DateTime?
  position    Int        // ordering within column
  tags        String[]
  createdById String
  assignees   TaskAssignee[]
  comments    Comment[]
  attachments Attachment[]
  timeEntries TimeEntry[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum UserStatus    { ACTIVE, INACTIVE, BLOCKED }
enum ProjectStatus { PLANNING, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED }
enum SprintStatus  { PLANNING, ACTIVE, COMPLETED, CANCELLED }
enum TaskStatus    { BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE }
enum Priority      { LOW, MEDIUM, HIGH, CRITICAL }
```

---

## 8. Fluxos de Tela (Wireframes Descritivos)

### 8.1 Tela de Login

```
┌─────────────────────────────────────┐
│            🔷 INOVA                 │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  Email                      │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │  Senha                  👁   │   │
│   └─────────────────────────────┘   │
│                                     │
│   [ Esqueci minha senha ]           │
│                                     │
│   ┌─────────────────────────────┐   │
│   │          ENTRAR             │   │
│   └─────────────────────────────┘   │
│                                     │
│   v1.0 — Inova © 2026              │
└─────────────────────────────────────┘
```

**Comportamentos:**
- Validação inline nos campos (email válido, senha mínimo 8 caracteres).
- Botão "Entrar" desabilitado até campos válidos.
- Feedback de erro: "Credenciais inválidas" (sem revelar se email existe).
- Após 5 tentativas: "Conta bloqueada. Tente novamente em 15 minutos."

### 8.2 Tela de Recuperação de Senha

```
┌─────────────────────────────────────┐
│           🔷 INOVA                  │
│     Recuperação de Senha            │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  Email cadastrado           │   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │     ENVIAR LINK             │   │
│   └─────────────────────────────┘   │
│                                     │
│   [ ← Voltar para Login ]          │
└─────────────────────────────────────┘
```

**Comportamentos:**
- Sempre exibe mensagem de sucesso genérica: "Se o email estiver cadastrado, você receberá um link."
- Token temporário expira em 1 hora.
- Link leva para tela de nova senha (com validação de complexidade).

### 8.3 Tela Inicial (Home)

A tela inicial é contextual por perfil:

**Gestor:** Dashboard com cards de resumo, gráficos e lista de projetos.
**Analista:** Visão de projetos com acesso rápido ao backlog e sprints.
**Desenvolvedor:** "Minhas Tasks" com quadro Kanban pessoal filtrado.
**Administrador:** Painel de configuração com atalhos para gestão de usuários e sistema.

### 8.4 Quadro Kanban (Tasks)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Projeto: HEFESTO ERP    Sprint: Sprint 5 (01/03 - 15/03)    [⚙]  │
├──────────┬──────────┬──────────┬──────────┬──────────┐              │
│ BACKLOG  │  TO DO   │IN PROGR. │IN REVIEW │   DONE   │              │
├──────────┼──────────┼──────────┼──────────┼──────────┤              │
│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐│              │
││TASK-042││││TASK-038││││TASK-035││││TASK-033││││TASK-030│││             │
││Criar   ││││Ajustar ││││Implem. ││││Review  ││││Setup   │││             │
││endpoint││││layout  ││││filtros ││││PR #45  ││││CI/CD   │││             │
││        ││││        ││││        ││││        ││││        │││             │
││🔴 Alta ││││🟡 Média││││🔴 Alta ││││🟢 Baixa││││✅ Done │││             │
││👤 Ana  ││││👤 João ││││👤 Ana  ││││👤 Carlos│││👤 Pedro│││             │
││3 pts   ││││2 pts   ││││5 pts   ││││3 pts   ││││2 pts  │││             │
│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘│              │
│┌────────┐│          │          │          │┌────────┐│              │
││TASK-043││          │          │          ││TASK-031│││             │
││...     ││          │          │          ││...     │││             │
│└────────┘│          │          │          │└────────┘│              │
│          │          │          │          │          │              │
│  [+ Add] │  [+ Add] │          │          │          │              │
└──────────┴──────────┴──────────┴──────────┴──────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

**Comportamentos:**
- Drag-and-drop entre colunas (Socket.IO para atualização em tempo real).
- Click no card abre modal de detalhes da task.
- Filtros no topo: responsável, prioridade, tags.
- Toggle entre vista Kanban e Lista.

### 8.5 Dashboard do Gestor

```
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard                                   Período: [Março ▼] │
├─────────────┬─────────────┬─────────────┬────────────────────────┤
│  📊 Projetos│  ✅ Tasks   │  ⚠️ Atrasadas│  ⏱ Horas Semana     │
│  Ativos: 4  │  Andamento:│  12 tasks   │  142h / 175h          │
│             │  47         │             │  (81%)                │
├─────────────┴─────────────┴─────────────┴────────────────────────┤
│                                                                  │
│  Progresso dos Projetos              │  Distribuição de Tasks    │
│  ┌─────────────────────────┐         │  ┌──────────────────┐    │
│  │ HEFESTO  ████████░░ 78% │         │  │   🟦 To Do: 15   │    │
│  │ LICEU    █████░░░░░ 52% │         │  │   🟨 Progress:12 │    │
│  │ GCPRO    ██░░░░░░░░ 23% │         │  │   🟪 Review: 8   │    │
│  │ TRINDADE ██████████ 100%│         │  │   🟩 Done: 47    │    │
│  └─────────────────────────┘         │  └──────────────────┘    │
│                                                                  │
│  Carga por Membro                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Ana       ████████████ 12 tasks (3 atrasadas ⚠️)        │    │
│  │ João      ████████ 8 tasks                               │    │
│  │ Pedro     ██████ 6 tasks                                 │    │
│  │ Maria     █████████ 9 tasks (1 atrasada ⚠️)              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [📄 Exportar PDF]  [📊 Exportar Excel]                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Roadmap e Fases de Entrega

### Visão Geral das Fases

```
FASE 1 (MVP Core)          FASE 2 (Sprints & Tasks)     FASE 3 (Dashboard)         FASE 4 (Clockify)
Semanas 1-4                Semanas 5-10                  Semanas 11-14              Semanas 15-18
───────────────────────── ─────────────────────────── ──────────────────────── ────────────────────
✅ Setup do projeto        ✅ CRUD de Sprints            ✅ Dashboard Gestor        ✅ Config Clockify
✅ Autenticação (JWT)      ✅ CRUD de Tasks              ✅ Gráficos e métricas     ✅ Sync automático
✅ CRUD Usuários           ✅ Quadro Kanban              ✅ Relatórios PDF/Excel    ✅ Time entries
✅ CRUD Roles/Permissões   ✅ Comentários                ✅ Filtros avançados       ✅ Fallback manual
✅ CRUD Projetos           ✅ Anexos de arquivos         ✅ Alertas de atraso       ✅ Relatório horas
✅ Layout base (sidebar)   ✅ Audit Log                                             
✅ Tela de Login           ✅ Real-time (Socket.IO)                                 
✅ Recuperação de senha    ✅ Drag-and-drop                                         
```

### Detalhamento por Sprint

#### FASE 1 — MVP Core (4 semanas)

**Sprint 1 (Semana 1-2): Fundação**
- Setup do monorepo (npm workspaces).
- Configuração do banco PostgreSQL + Prisma.
- Implementação do módulo de autenticação (login, JWT, refresh token, recuperação de senha).
- Criação do layout base da aplicação (sidebar, header, routing).
- Telas de login e recuperação de senha.

**Sprint 2 (Semana 3-4): Cadastros Básicos**
- CRUD completo de Usuários (com upload de avatar).
- CRUD de Roles com sistema de permissões (RBAC).
- CRUD de Projetos (com geração de código, vinculação de membros).
- Middleware de autorização baseado em permissões.
- Testes unitários do backend (meta: 80%).

#### FASE 2 — Sprints & Tasks (6 semanas)

**Sprint 3 (Semana 5-6): Sprints e Tasks Base**
- CRUD de Sprints dentro de projetos.
- CRUD de Tasks com todos os campos.
- Quadro Kanban (visualização e drag-and-drop).
- Toggle Kanban / Lista.

**Sprint 4 (Semana 7-8): Colaboração**
- Sistema de comentários nas tasks.
- Upload de anexos (com validação de tipo e tamanho).
- Real-time updates com Socket.IO.
- Módulo de Audit Log.

**Sprint 5 (Semana 9-10): Refinamento**
- Filtros avançados nas tasks (multi-critério).
- Burndown chart da sprint.
- Mecanismo de mover tasks entre sprints.
- Testes E2E dos fluxos críticos.

#### FASE 3 — Dashboard e Relatórios (4 semanas)

**Sprint 6 (Semana 11-12): Dashboard**
- Dashboard do Gestor com cards de resumo.
- Gráficos de distribuição (Recharts).
- Barra de progresso por projeto.
- Carga de trabalho por membro.

**Sprint 7 (Semana 13-14): Relatórios**
- Exportação de relatório de sprint (PDF e Excel).
- Exportação de relatório de projeto consolidado.
- Alertas visuais de tasks atrasadas.
- Configuração de logotipo da empresa.

#### FASE 4 — Integração Clockify (4 semanas)

**Sprint 8 (Semana 15-16): Integração Base**
- Tela de configuração da integração Clockify (API Key, Workspace).
- Vinculação de usuários Inova ↔ Clockify.
- Sincronização de time entries (cron job + manual).

**Sprint 9 (Semana 17-18): Consolidação**
- Exibição de horas por task, sprint e projeto.
- Relatório de horas por membro.
- Fallback de registro manual de horas.
- Testes de integração e documentação final.

---

## 10. Matriz de Permissões (RBAC)

### Legenda: C = Criar | R = Ler | U = Editar | D = Desativar/Excluir

| Recurso | Administrador | Gestor | Analista | Desenvolvedor |
|---------|:------------:|:------:|:--------:|:-------------:|
| **Usuários** | CRUD | R | R | R (próprio) |
| **Roles** | CRUD | R | R | — |
| **Projetos** | CRUD | CRU | CRU | R |
| **Membros do Projeto** | CRUD | CRU | RU | R |
| **Sprints** | CRUD | CRU | CRUD | R |
| **Tasks (criar)** | ✅ | ✅ | ✅ | ❌ |
| **Tasks (editar)** | ✅ | ✅ | ✅ | Próprias |
| **Tasks (mover status)** | ✅ | ✅ | ✅ | Próprias |
| **Tasks (excluir)** | ✅ | ✅ | ✅ | ❌ |
| **Comentários** | CRUD | CRUD | CRUD | CRU (próprios) |
| **Anexos** | CRUD | CRUD | CRUD | CRU (próprios) |
| **Dashboard** | ✅ | ✅ | R (projetos) | R (próprio) |
| **Relatórios** | ✅ | ✅ | R (projetos) | ❌ |
| **Audit Log** | ✅ | R | ❌ | ❌ |
| **Config. Sistema** | ✅ | ❌ | ❌ | ❌ |
| **Config. Clockify** | ✅ | ❌ | ❌ | ❌ |

---

## 11. API Endpoints (Visão Geral)

### 11.1 Autenticação

```
POST   /api/auth/login                # Login
POST   /api/auth/refresh              # Refresh token
POST   /api/auth/logout               # Logout
POST   /api/auth/forgot-password      # Solicitar reset de senha
POST   /api/auth/reset-password       # Redefinir senha com token
PUT    /api/auth/change-password      # Alterar senha (autenticado)
```

### 11.2 Usuários

```
GET    /api/users                     # Listar (filtros: status, role, search)
GET    /api/users/:id                 # Detalhe
POST   /api/users                     # Criar (Admin)
PUT    /api/users/:id                 # Editar
PATCH  /api/users/:id/status          # Ativar/Desativar
PUT    /api/users/:id/avatar          # Upload avatar
GET    /api/users/me                  # Perfil do usuário logado
```

### 11.3 Roles

```
GET    /api/roles                     # Listar
GET    /api/roles/:id                 # Detalhe
POST   /api/roles                     # Criar (Admin)
PUT    /api/roles/:id                 # Editar (Admin)
DELETE /api/roles/:id                 # Excluir (Admin, apenas não-sistema)
```

### 11.4 Projetos

```
GET    /api/projects                  # Listar (filtros: status, member, search)
GET    /api/projects/:id              # Detalhe com resumo
POST   /api/projects                  # Criar
PUT    /api/projects/:id              # Editar
PATCH  /api/projects/:id/status       # Alterar status
GET    /api/projects/:id/members      # Listar membros
POST   /api/projects/:id/members      # Adicionar membro
DELETE /api/projects/:id/members/:uid # Remover membro
```

### 11.5 Sprints

```
GET    /api/projects/:id/sprints           # Listar sprints do projeto
GET    /api/sprints/:id                    # Detalhe com burndown data
POST   /api/projects/:id/sprints           # Criar sprint
PUT    /api/sprints/:id                    # Editar
PATCH  /api/sprints/:id/status             # Alterar status (ativar, concluir)
POST   /api/sprints/:id/carry-over         # Mover tasks não concluídas
```

### 11.6 Tasks

```
GET    /api/projects/:id/tasks             # Listar tasks (filtros múltiplos)
GET    /api/tasks/:id                      # Detalhe completo
POST   /api/projects/:id/tasks             # Criar task
PUT    /api/tasks/:id                      # Editar
PATCH  /api/tasks/:id/status               # Mover no Kanban
PATCH  /api/tasks/:id/position             # Reordenar (drag-and-drop)
DELETE /api/tasks/:id                      # Excluir
GET    /api/tasks/:id/comments             # Listar comentários
POST   /api/tasks/:id/comments             # Adicionar comentário
PUT    /api/comments/:id                   # Editar comentário
DELETE /api/comments/:id                   # Excluir comentário
POST   /api/tasks/:id/attachments          # Upload anexo
DELETE /api/attachments/:id                # Excluir anexo
GET    /api/users/me/tasks                 # Minhas tasks (cross-project)
```

### 11.7 Relatórios

```
GET    /api/reports/sprint/:id             # Relatório de sprint (PDF/Excel via query param)
GET    /api/reports/project/:id            # Relatório de projeto
GET    /api/reports/hours                  # Relatório de horas (filtros: user, period)
```

### 11.8 Clockify

```
GET    /api/clockify/config                # Ver configuração atual
PUT    /api/clockify/config                # Salvar API Key + Workspace
POST   /api/clockify/sync                  # Sincronizar agora
GET    /api/clockify/status                # Status da última sincronização
PUT    /api/users/:id/clockify             # Vincular Clockify User ID
GET    /api/tasks/:id/time-entries         # Time entries de uma task
POST   /api/tasks/:id/time-entries         # Registro manual de horas
```

### 11.9 Audit Log

```
GET    /api/audit-logs                     # Listar (filtros: user, action, resource, period)
```

---

## 12. Integração com Clockify

### 12.1 Fluxo de Integração

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   INOVA     │     │   Cron Job      │     │  Clockify    │
│  (Backend)  │     │ (cada 15 min)   │     │  API v1      │
└──────┬──────┘     └────────┬────────┘     └──────┬───────┘
       │                     │                      │
       │  1. Config salva    │                      │
       │  (API Key + WS)     │                      │
       │─────────────────────►                      │
       │                     │  2. GET /time-entries │
       │                     │─────────────────────►│
       │                     │                      │
       │                     │  3. Response (JSON)   │
       │                     │◄─────────────────────│
       │                     │                      │
       │  4. Match entries   │                      │
       │  com tasks (via     │                      │
       │  description tag)   │                      │
       │◄────────────────────│                      │
       │                     │                      │
       │  5. Salva no DB     │                      │
       │  (time_entries)     │                      │
       └─────────────────────┘                      │
```

### 12.2 Convenção de Matching

Para vincular time entries do Clockify com tasks do Inova, usamos uma convenção na descrição:

```
Formato: TASK-{ID} - Descrição livre
Exemplo: TASK-035 - Implementação dos filtros avançados
```

O sync engine busca o padrão `TASK-\d+` na descrição e vincula ao task correspondente.

### 12.3 Endpoints Clockify Utilizados

| Endpoint | Uso |
|----------|-----|
| `GET /workspaces` | Descobrir workspace ID |
| `GET /workspaces/{wid}/users` | Listar usuários para vinculação |
| `GET /workspaces/{wid}/time-entries` | Buscar entradas de tempo |
| `GET /workspaces/{wid}/projects` | Opcional: mapear projetos |

### 12.4 Tratamento de Falhas

- Se a API do Clockify estiver fora do ar, o cron registra o erro e tenta novamente no próximo ciclo.
- O sistema oferece botão "Sincronizar agora" para trigger manual.
- Fallback: registro manual de horas diretamente na task do Inova.
- Entradas duplicadas são prevenidas pelo campo `clockify_id` (unique constraint).

---

## 13. Estratégia de Testes

### 13.1 Pirâmide de Testes

| Nível | Ferramenta | Cobertura | Fase |
|-------|-----------|-----------|------|
| **Unitários (Backend)** | Jest + Supertest | ≥ 80% dos services e controllers | 1-4 |
| **Unitários (Frontend)** | Vitest + Testing Library | ≥ 70% dos components críticos | 2-4 |
| **Integração (API)** | Jest + Supertest | Todos os endpoints | 2-4 |
| **E2E** | Playwright | Fluxos críticos (login, task lifecycle, sprint) | 3-4 |
| **Performance** | k6 ou Artillery | Load test com 50 usuários simultâneos | 4 |

### 13.2 Fluxos E2E Prioritários

1. Login → Criar projeto → Adicionar membros → Criar sprint → Criar task → Mover task no Kanban → Concluir sprint.
2. Login (Gestor) → Visualizar dashboard → Exportar relatório.
3. Recuperação de senha completa (request → email → reset → novo login).
4. Sincronização Clockify → Verificar horas na task.

---

## 14. Deploy e Infraestrutura

### 14.1 Arquitetura On-Premise

```
┌─────────────────────────────────────────────┐
│              SERVIDOR ON-PREMISE             │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │           Docker Compose             │   │
│  │                                      │   │
│  │  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │  Nginx   │  │  App Container   │  │   │
│  │  │ (Reverse │──│  Node.js API     │  │   │
│  │  │  Proxy)  │  │  + Static Files  │  │   │
│  │  │  :443    │  │  :3000           │  │   │
│  │  └──────────┘  └────────┬─────────┘  │   │
│  │                         │            │   │
│  │  ┌──────────┐  ┌───────▼──────────┐  │   │
│  │  │  Redis   │  │   PostgreSQL     │  │   │
│  │  │  :6379   │  │   :5432          │  │   │
│  │  └──────────┘  └──────────────────┘  │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Volumes: /data/postgres, /data/uploads      │
│  Backup:  Cron → pg_dump → /data/backups     │
└─────────────────────────────────────────────┘
```

### 14.2 Requisitos de Hardware (Mínimo)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disco | 50 GB SSD | 100 GB SSD |
| SO | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### 14.3 Docker Compose (Estrutura)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://inova:${DB_PASS}@db:5432/inova
      JWT_SECRET: ${JWT_SECRET}
      CLOCKIFY_API_KEY: ${CLOCKIFY_API_KEY}
    depends_on: [db, redis]
    volumes: ["./uploads:/app/uploads"]

  db:
    image: postgres:15-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: inova
      POSTGRES_USER: inova
      POSTGRES_PASSWORD: ${DB_PASS}

  redis:
    image: redis:7-alpine

  nginx:
    image: nginx:alpine
    ports: ["443:443", "80:80"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]

volumes:
  pgdata:
```

### 14.4 Backup

- **Frequência:** Diário às 02:00 (horário local).
- **Método:** `pg_dump` comprimido para `/data/backups/`.
- **Retenção:** 30 dias (rotação automática via script).
- **Restore:** Documentado em runbook.

---

## 15. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|:------------:|:-------:|-----------|
| 1 | Clockify API muda ou fica instável | Média | Alto | Camada de abstração + fallback manual + versionamento da integração. |
| 2 | Scope creep nas fases | Alta | Médio | Roadmap rígido com backlog de "nice to haves" separado. PRD como source of truth. |
| 3 | Performance do Kanban com muitas tasks | Baixa | Médio | Virtualização de lista (react-window), paginação server-side, índices no banco. |
| 4 | Perda de dados (on-premise) | Baixa | Crítico | Backup diário automático, documentação de restore, testes periódicos de recover. |
| 5 | Dificuldade de adoção pelo time | Média | Alto | UI intuitiva, onboarding assistido, envolver o time no design das sprints 1-2. |
| 6 | Falta de email server on-premise para recuperação de senha | Média | Médio | Suportar SMTP externo (Gmail, Outlook) ou reset manual pelo Admin. |

---

## 16. Métricas de Sucesso

### 16.1 Métricas de Produto (após 3 meses de uso)

| Métrica | Meta | Como medir |
|---------|------|------------|
| Adoção | 100% do time usando diariamente | Audit log de logins diários |
| Visibilidade | Gestores acessam dashboard ≥ 3x/semana | Analytics de acesso |
| Atualização de tasks | ≥ 90% das tasks atualizadas no mesmo dia | Status change timestamps |
| Tempo para status report | < 5 minutos (era 30+ min) | Feedback qualitativo |
| Horas rastreadas via Clockify | ≥ 85% das horas vinculadas a tasks | Relatório de horas |

### 16.2 Métricas Técnicas

| Métrica | Meta |
|---------|------|
| Uptime | ≥ 99% em horário comercial |
| Tempo médio de resposta API | < 300ms (p95) |
| Cobertura de testes backend | ≥ 80% |
| Bugs críticos em produção | 0 por sprint |
| Deploy time | < 10 minutos |

---

## 17. Glossário

| Termo | Definição |
|-------|-----------|
| **Sprint** | Período fixo de trabalho (1-4 semanas) onde um conjunto de tasks deve ser concluído. |
| **Task** | Unidade de trabalho atribuível a um ou mais membros do time. |
| **Backlog** | Lista priorizada de tasks que ainda não foram alocadas a uma sprint. |
| **Kanban Board** | Quadro visual com colunas representando estágios do fluxo de trabalho. |
| **Story Points** | Unidade de estimativa de esforço/complexidade de uma task. |
| **Burndown Chart** | Gráfico que mostra o progresso de conclusão de tasks ao longo de uma sprint. |
| **RBAC** | Role-Based Access Control — controle de acesso baseado em papéis/tipos de usuário. |
| **Audit Log** | Registro imutável de todas as ações realizadas no sistema para rastreabilidade. |
| **JWT** | JSON Web Token — padrão para autenticação stateless via tokens assinados. |
| **Soft Delete** | Exclusão lógica (marcação como inativo) sem remoção física do banco de dados. |
| **On-Premise** | Infraestrutura hospedada em servidor próprio da organização (não em nuvem pública). |
| **Clockify** | Ferramenta externa de rastreamento de tempo que será integrada ao Inova. |

---

## Changelog

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 09/03/2026 | Rafael / Claude | Criação inicial do PRD completo. |

---

*Documento gerado como parte do planejamento do Sistema Inova. Todas as decisões técnicas e de escopo devem ser validadas com o time antes do início da implementação.*
