---
focus: arch
generated: 2026-04-01
---

# Directory Structure

## Summary
Monorepo npm workspaces com três pacotes: `apps/api` (backend Express), `apps/web` (frontend React/Vite) e `packages/shared` (tipos compartilhados). A API é organizada em módulos por domínio; o frontend em páginas planas com stores Zustand e serviço de API centralizado.

## Monorepo Root

```
Inova/
├── apps/
│   ├── api/               # Backend Node.js/Express
│   └── web/               # Frontend React/Vite
├── packages/
│   └── shared/            # Tipos e utilitários compartilhados
├── package.json           # Workspace root (npm workspaces)
├── tsconfig.base.json     # TypeScript config base compartilhada
└── package-lock.json
```

## apps/api

```
apps/api/
├── prisma/
│   ├── schema.prisma      # Schema do banco de dados (fonte da verdade)
│   ├── seed.ts            # Seed de dados iniciais (roles, users, projetos demo)
│   └── add-task-code.ts   # Migration helper para campo code de tasks
├── src/
│   ├── server.ts          # Entry point: Express + Socket.IO + rotas montadas
│   ├── config/
│   │   ├── index.ts       # Configuração centralizada (env vars validadas)
│   │   └── database.ts    # Instância singleton do PrismaClient
│   ├── middleware/
│   │   ├── auth.ts        # authenticate (JWT) + authorize (RBAC por resource/action)
│   │   ├── auditLog.ts    # createAuditLog() — registra ações no banco
│   │   └── errorHandler.ts# Handler global de erros Express
│   ├── modules/           # Um diretório por domínio de negócio
│   │   ├── auth/routes.ts
│   │   ├── users/routes.ts
│   │   ├── roles/routes.ts
│   │   ├── projects/routes.ts
│   │   ├── sprints/routes.ts
│   │   ├── tasks/routes.ts       # Mais complexo: tasks, comments, attachments, time entries
│   │   ├── dashboard/routes.ts
│   │   ├── reports/routes.ts
│   │   ├── audit/routes.ts
│   │   └── clockify/routes.ts    # Integração externa Clockify
│   └── utils/
│       └── projectGuard.ts       # rejectIfCancelled() — impede escrita em projetos cancelados
├── package.json
└── tsconfig.json
```

## apps/web

```
apps/web/
├── src/
│   ├── main.tsx           # Entry point: ReactDOM + BrowserRouter + QueryClient + ThemeProvider
│   ├── App.tsx            # Roteamento: PrivateRoute + AuthorizedRoute + HomeRedirect por role
│   ├── index.css          # Estilos globais + .md-preview (markdown rendering)
│   ├── components/
│   │   └── AppLayout.tsx  # Layout principal: sidebar + header + <Outlet />
│   ├── pages/             # Uma página por rota — sem subdiretórios
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ChangePasswordPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── RolesPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── ProjectDetailPage.tsx  # Sprints, membros, detalhe do projeto
│   │   ├── KanbanPage.tsx         # Board DnD com modal de task
│   │   ├── MyTasksPage.tsx
│   │   ├── AuditLogPage.tsx
│   │   └── SettingsPage.tsx
│   ├── providers/
│   │   └── ThemeProvider.tsx  # Ant Design ConfigProvider + tema dark/light
│   ├── services/
│   │   └── api.ts         # Instância axios + interceptors (token em memória + refresh silencioso)
│   └── store/
│       ├── authStore.ts   # useAuthStore: user, isAuthenticated, hasPermission(), refreshUserProfile()
│       └── themeStore.ts  # useThemeStore: dark/light toggle
├── vite.config.ts         # Vite + proxy /api → localhost:3001
├── package.json
└── tsconfig.json
```

## packages/shared

```
packages/shared/
├── src/
│   └── index.ts           # Tipos e constantes exportados para api e web
├── package.json
└── tsconfig.json
```

## Convenções de Localização

| O que adicionar | Onde colocar |
|---|---|
| Nova rota de API | `apps/api/src/modules/<domínio>/routes.ts` |
| Nova página | `apps/web/src/pages/<Nome>Page.tsx` |
| Novo componente reutilizável | `apps/web/src/components/` |
| Novo store global | `apps/web/src/store/<nome>Store.ts` |
| Tipo compartilhado api+web | `packages/shared/src/index.ts` |
| Nova tabela no banco | `apps/api/prisma/schema.prisma` + migration |
| Novo middleware Express | `apps/api/src/middleware/` |

## Naming Conventions

- **Arquivos API:** camelCase (`routes.ts`, `auditLog.ts`, `projectGuard.ts`)
- **Arquivos Web:** PascalCase para componentes/páginas (`KanbanPage.tsx`, `AppLayout.tsx`); camelCase para stores/services (`authStore.ts`, `api.ts`)
- **Módulos API:** plural lowercase (`/users`, `/projects`, `/tasks`)
- **Rotas Web:** kebab-case (`/my-tasks`, `/audit-log`, `/change-password`)
