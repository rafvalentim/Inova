---
focus: quality
generated: 2026-04-01
---

# Coding Conventions

## Summary
Codebase TypeScript com ESLint implícito (sem config customizada visível). A API segue um padrão consistente de rotas inline (sem controllers separados), com `any` usado pragmaticamente em query builders. O frontend usa React Query para server state e Zustand para client state, com componentes de página grandes e monolíticos.

## API Patterns (Express)

### Estrutura de Rota
Cada módulo tem um único `routes.ts` com handlers inline — sem separação controller/service:
```typescript
const router = Router();
router.get('/path', authenticate, authorize('resource', 'action'), async (req: AuthRequest, res) => {
    try {
        // lógica direta com prisma
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Context error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});
export default router;
```

### Response Shape
Todas as respostas seguem o padrão `{ success: boolean, data?: any, message?: string }`:
```typescript
// Sucesso
res.json({ success: true, data: item });
res.status(201).json({ success: true, data: created });
// Erro de cliente
res.status(400).json({ success: false, message: 'Mensagem em pt-BR' });
res.status(404).json({ success: false, message: 'Recurso não encontrado' });
// Erro de servidor
res.status(500).json({ success: false, message: 'Erro interno do servidor' });
```

### Auth Pattern
```typescript
// Apenas autenticação
router.get('/path', authenticate, async (req: AuthRequest, res) => { ... });

// Autenticação + autorização RBAC
router.post('/path', authenticate, authorize('resource', 'create'), async (req: AuthRequest, res) => { ... });

// Autorização manual inline (quando lógica é mais complexa)
const hasPermission = req.userRole === 'Administrador' ||
    req.userPermissions?.['resource']?.includes('action');
```

### Audit Logging
Toda operação de escrita (CREATE/UPDATE/DELETE) registra audit log:
```typescript
await createAuditLog(req, 'CREATE', 'resource', entity.id, previousValue, newValue);
```

### Prisma Patterns
- `select` explícito em joins para limitar campos retornados
- `_count` para contagens sem carregar relações
- Transações implícitas via múltiplos awaits (sem `prisma.$transaction` exceto onde explicitamente necessário)
- `upsert` para relações many-to-many junction tables

## Frontend Patterns (React)

### Componentes de Página
Páginas são componentes grandes e monolíticos em `src/pages/`. Não há componentes atômicos reutilizáveis além do `AppLayout`. Toda lógica de data fetching, estado local e renderização fica na página.

### Data Fetching
Usa React Query (`@tanstack/react-query`) para server state:
```typescript
const { data, isLoading, refetch } = useQuery({
    queryKey: ['resource', param],
    queryFn: () => api.get('/endpoint').then(r => r.data.data),
});
const mutation = useMutation({
    mutationFn: (data) => api.post('/endpoint', data),
    onSuccess: () => { refetch(); message.success('Mensagem pt-BR'); },
});
```

### Client State
Zustand para estado global de auth e tema:
```typescript
const user = useAuthStore((s) => s.user);
const { hasPermission } = useAuthStore();
// Verificação de permissão em componentes
if (hasPermission('tasks', 'update')) { ... }
```

### UI Components
Ant Design como design system principal. Componentes Ant (`Table`, `Modal`, `Form`, `Button`, `message`, `Select`) são usados diretamente nas páginas sem abstração.

### Permissões no Frontend
Guard de permissão é feito via `hasPermission(resource, action)` do `useAuthStore`:
- Nível de rota: `AuthorizedRoute` em `App.tsx`
- Nível de componente: verificação inline `hasPermission('tasks', 'delete')` para mostrar/ocultar botões

## TypeScript

- `strict` não verificado explicitamente — `any` é usado frequentemente em query builders e tipagens dinâmicas de Prisma
- `as const` em arrays de status para type narrowing
- `AuthRequest extends Request` para adicionar campos do usuário autenticado
- Imports de tipo inline quando necessário (`import type { ... }`)
- Erro conhecido: `apps/web/src/services/api.ts:63` tem TS2322 (type mismatch em failedQueue)

## Linguagem e Mensagens

- Toda UI em português (pt-BR)
- Mensagens de erro da API em pt-BR
- Comentários no código mistos (pt-BR e inglês)
- Nomes de variáveis/funções em inglês
