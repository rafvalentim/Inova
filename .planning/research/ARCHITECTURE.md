# Architecture Research — Refactoring Patterns

## Summary

Research into how to incrementally refactor the Inova codebase. Key insight: security/validation must come before service layer extraction because Zod schemas define the typed interfaces that services consume. Frontend decomposition is independent and can happen in parallel.

## Build Order

The refactoring phases have hard dependencies:

```
Phase 1: Security + Zod validation
    ↓ (Zod schemas provide typed interfaces)
Phase 2: Service layer extraction (tasks, auth, sprints only)
    ↓ (Services are now testable units)
Phase 3: Frontend decomposition (hooks + subcomponents)
    ↓ (independent — can run parallel with Phase 2)
Phase 4: TypeScript strictness (`any` elimination)
    ↓ (builds on typed schemas + service signatures)
```

**Why this order:**
1. Zod schemas define the contract between routes and business logic — extracting services without typed inputs means you're just moving `any` to a new file
2. Service extraction enables unit testing — tests need isolated business logic, not Express req/res
3. Frontend decomposition is independent of backend changes
4. `any` elimination is a natural side-effect of phases 1-2 if done right

## When Controller/Service Separation Is Worth It

| Module | Lines | `any` Count | Business Logic | Verdict |
|--------|-------|-------------|----------------|---------|
| `tasks/routes.ts` | 692 | 4+ | Complex (status sync, code gen, sprint association, position, comments, attachments, time entries) | **Structural refactor** |
| `auth/routes.ts` | ~360 | 3+ | Complex (login, refresh, logout, password reset, token rotation) | **Structural refactor** |
| `sprints/routes.ts` | ~250 | 2+ | Medium (overdue auto-close, incomplete task migration, completion) | **Structural refactor** |
| `projects/routes.ts` | ~400 | 3+ | Medium (CRUD + members + info items + cancellation) | **Incremental** — extract only if needed for testing |
| `dashboard/routes.ts` | ~200 | 4+ | Low (read-only aggregation queries) | **Incremental** — typed `where` objects only |
| `roles/routes.ts` | ~100 | 1 | Low (simple CRUD) | **Leave as-is** |
| `audit/routes.ts` | ~50 | 1 | Low (read-only list) | **Leave as-is** |
| `users/routes.ts` | ~200 | 1-2 | Low (CRUD + avatar) | **Leave as-is** |
| `reports/routes.ts` | ~200 | 2 | Low (read-only aggregation) | **Leave as-is** |
| `clockify/routes.ts` | ~250 | 2 | Medium (external API integration) | **Incremental** — isolate API calls only |

### Service Layer Pattern for Prisma

```typescript
// modules/tasks/task.service.ts
import prisma from '../../config/database';
import type { CreateTaskInput, UpdateTaskInput } from './task.schemas';

export const taskService = {
  async create(projectId: string, input: CreateTaskInput, userId: string) {
    const code = await generateTaskCode();
    return prisma.task.create({
      data: { ...input, code, projectId, createdById: userId },
      include: { /* standard includes */ },
    });
  },
  // ...
};

// modules/tasks/routes.ts — stays thin
router.post('/projects/:projectId/tasks', authenticate, authorize('tasks', 'create'),
  validate(createTaskSchema),
  async (req: AuthRequest, res) => {
    const task = await taskService.create(req.params.projectId, req.body, req.userId!);
    await createAuditLog(req, 'CREATE', 'tasks', task.id, null, req.body);
    res.status(201).json({ success: true, data: task });
  }
);
```

**Key:** Routes handle HTTP concerns (auth, validation, response). Services handle business logic. No repository layer — Prisma IS the repository.

## Zod Validation Middleware

### Factory Pattern

```typescript
// middleware/validate.ts
import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // now typed
    next();
  };

// For query params
export const validateQuery = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: result.error.flatten().fieldErrors,
      });
    }
    req.query = result.data;
    next();
  };
```

### Schema Co-location

```
modules/tasks/
├── routes.ts         # Express routes (thin)
├── task.service.ts   # Business logic (extracted)
└── task.schemas.ts   # Zod schemas + inferred types
```

### Introduction Strategy
- Add `validate()` middleware per-route, not all at once
- Start with mutating endpoints (POST, PUT, PATCH) — they have the highest risk
- GET query params second
- Each schema also eliminates one `any` usage

## React Page Decomposition

### Strategy: Hooks First, Then Components

**Step 1 — Extract custom hooks for data fetching:**
```typescript
// hooks/useKanbanTasks.ts
export function useKanbanTasks(projectId: string, sprintId?: string) {
  return useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => api.get(`/projects/${projectId}/tasks`, { params: { sprintId } })
      .then(r => r.data.data),
  });
}
```

**Step 2 — Extract subcomponents for discrete UI sections:**
- `KanbanColumn` — single column with task cards
- `TaskDetailModal` — view/edit task detail
- `TaskCreateForm` — new task form
- `SprintSelector` — sprint picker header

**Step 3 — The page becomes orchestration only:**
```typescript
function KanbanPage() {
  const { projectId } = useParams();
  const { tasks, isLoading } = useKanbanTasks(projectId);
  const { moveTask } = useKanbanDnd(projectId);
  // ... render columns using subcomponents
}
```

### What NOT to Extract
- Don't extract components used only once that don't reduce complexity
- Don't extract hooks that wrap a single `useQuery` with no additional logic
- Don't create a `components/kanban/` directory with 15 tiny files — 3-5 meaningful extractions is enough

## Incremental `any` Elimination

### Strategy: New Code First

1. **Zod schemas provide types automatically** — every new schema eliminates `any` in its route
2. **Service function signatures** use Zod inferred types — `any` disappears as a side-effect
3. **Dynamic query builders** — replace `const where: any = {}` with `const where: Prisma.TaskWhereInput = {}`
4. **`unknown` + type guard** over `as any` assertions

### Priority Order
1. Auth boundary (middleware/auth.ts) — highest security impact
2. Mutating endpoints (POST/PUT/PATCH handlers) — highest data integrity impact
3. Read endpoints (GET handlers with query builders) — lower risk
4. Utility code and error handlers — lowest priority

### What NOT to Do
- Don't enable `strict: true` globally in one PR
- Don't do type gymnastics to avoid `any` — if Prisma returns `any` from a raw query, `unknown` + runtime check is fine
- Don't add `// @ts-ignore` or `// @ts-expect-error` as an `any` replacement

## Anti-Patterns to Avoid

### 1. Repository Layer Over Prisma
Prisma IS the data access layer. Adding `TaskRepository` that wraps `prisma.task.findMany()` adds indirection without value. The service layer is the right abstraction boundary.

### 2. Global Validation Before Schemas Exist
Don't add `validate()` middleware to routes before writing the Zod schemas. Each route gets validation when its schema is written, not before.

### 3. Over-Extracting Hooks
A hook that wraps a single `useQuery` call with no transformation is not a useful abstraction. Extract hooks when they contain:
- Multiple queries that need coordination
- Derived state or memoized computations
- Side effects beyond data fetching

### 4. Mixing Validation Into Services
Validation belongs in middleware (HTTP layer). Services trust their inputs are valid. This keeps services testable without HTTP context.

## Module Dependency Map

```
config/ ← (all modules depend on config)
  ↓
middleware/auth.ts ← (most routes depend on auth)
  ↓
middleware/validate.ts ← (NEW — routes add this)
  ↓
modules/*/schemas.ts ← (NEW — Zod schemas per module)
  ↓
modules/*/service.ts ← (NEW — business logic, uses schemas types)
  ↓
modules/*/routes.ts ← (EXISTING — becomes thin, uses validate + service)
```

This shows why validation middleware must exist before service extraction: services consume the types that schemas define.
