# Inova

Plataforma interna de gestão de projetos e times de desenvolvimento, projetada para equipes de 6 a 15 pessoas. Combina uma abordagem híbrida **Scrum + Kanban**, centralizando tarefas, sprints, rastreamento de tempo e relatórios em um único lugar — com deploy on-premise.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite, Ant Design, Zustand, React Query |
| Backend | Node.js, Express, TypeScript, Socket.io |
| Banco de dados | PostgreSQL 15 + Prisma ORM |
| Infra | Docker, Docker Compose, Nginx |
| Integração | Clockify API |

---

## Estrutura do Projeto

```
Inova/
├── apps/
│   ├── api/          # Backend (Express + Prisma)
│   └── web/          # Frontend (React + Vite)
├── packages/
│   └── shared/       # Tipos e utilitários compartilhados
├── docker-compose.yml
└── package.json
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) e Docker Compose
- [npm](https://www.npmjs.com/) >= 9

---

## Como rodar localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na pasta `apps/api/`:

```env
DATABASE_URL="postgresql://inova:inova123@localhost:5432/inova"
JWT_SECRET="sua-chave-secreta"
JWT_REFRESH_SECRET="sua-chave-refresh-secreta"
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### 3. Suba o banco de dados

```bash
docker compose up db -d
```

### 4. Execute as migrations e o seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Rode o projeto em modo de desenvolvimento

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3000](http://localhost:3000)

---

## Deploy com Docker

Para rodar toda a stack em produção:

```bash
docker compose up -d
```

A aplicação ficará disponível em `http://localhost` (porta 80 via Nginx).

Variáveis de ambiente configuráveis no `docker-compose.yml`:

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_PASS` | `inova123` | Senha do PostgreSQL |
| `JWT_SECRET` | `super-secret-dev-key` | Segredo do JWT |
| `JWT_REFRESH_SECRET` | `super-secret-refresh-dev-key` | Segredo do refresh token |
| `CORS_ORIGIN` | `http://localhost` | Origem permitida pelo CORS |

> ⚠️ Altere os valores padrão antes de ir para produção.

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Roda API e Web simultaneamente |
| `npm run dev:api` | Roda apenas a API |
| `npm run dev:web` | Roda apenas o frontend |
| `npm run build` | Build de todos os workspaces |
| `npm run db:migrate` | Executa as migrations do banco |
| `npm run db:seed` | Popula o banco com dados iniciais |
| `npm run db:generate` | Gera o Prisma Client |

---

## Módulos da API

- **auth** — Autenticação JWT com refresh token
- **users** — Gestão de usuários
- **roles** — Controle de permissões (RBAC)
- **projects** — Gestão de projetos
- **sprints** — Planejamento e controle de sprints
- **tasks** — Tarefas com suporte a Kanban
- **dashboard** — Visão consolidada de métricas
- **reports** — Geração de relatórios
- **clockify** — Integração com Clockify para rastreamento de horas
- **audit** — Log de atividades e auditoria

---

## Licença

Uso interno. Todos os direitos reservados.
