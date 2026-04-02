# Stack Research — Security & Testing Tools

## Summary

Research into the 2025 tooling for hardening and testing the Inova Node/Express + React monorepo. Key finding: Zod is already installed (3.25.76) but unused — zero migration cost. Vitest beats Jest for this hybrid ESM/CJS monorepo. Pino is the right logger for Docker/stdout. Helmet is missing entirely.

## Input Validation — Zod

**Recommendation:** Use existing Zod 3.25.x installation
**Confidence:** HIGH

### Why Zod
- Already installed in the project (`^3.23.8` in package.json) but used nowhere
- TypeScript-native: schemas produce types automatically (`z.infer<typeof schema>`)
- `z.nativeEnum()` mirrors Prisma enums without duplication
- Lighter than Joi, more type-safe than Yup
- Standard choice for Express + TypeScript in 2025

### Integration Pattern
```typescript
// middleware/validate.ts
import { ZodSchema } from 'zod';
export const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, errors: result.error.flatten() });
  req.body = result.data; // typed and validated
  next();
};
```

### What NOT to use
- **Joi** — heavier, weaker TypeScript integration, declining ecosystem
- **Yup** — React form focused, not ideal for Express middleware
- **zod-prisma-types codegen** — evaluate later; manual schemas first to keep control

## Testing — Vitest + Supertest

**Recommendation:** Vitest for both API and frontend
**Confidence:** HIGH

### Why Vitest over Jest
- API is CommonJS, web is ESM — Jest requires painful per-workspace transform config
- Vitest handles hybrid ESM/CJS natively
- Shares config infrastructure with existing Vite setup in apps/web
- Jest-compatible API (same `describe`/`it`/`expect` patterns)
- Faster execution, native TypeScript support

### API Testing Stack
| Package | Purpose | Version |
|---------|---------|---------|
| `vitest` | Test runner | ^3.x |
| `supertest` | HTTP assertions for Express | ^7.x |
| `@faker-js/faker` | Test data generation | ^9.x |

### Frontend Testing Stack
| Package | Purpose | Version |
|---------|---------|---------|
| `vitest` | Test runner (shared with API) | ^3.x |
| `@testing-library/react` | Component testing | ^16.x |
| `@testing-library/jest-dom` | DOM assertions | ^6.x |
| `jsdom` | Browser environment | ^25.x |

### Prisma Test Strategy
- Use real PostgreSQL for integration tests (Docker)
- `prisma migrate reset --force` before test suite
- Isolated test database via `DATABASE_URL` env override

## Security Headers — Helmet

**Recommendation:** Add helmet
**Confidence:** HIGH

### Why
- `server.ts` sets zero security headers — 14+ header gaps
- One `app.use(helmet())` call fixes most OWASP header recommendations
- Disable `contentSecurityPolicy` (API-only, no HTML)
- Disable `crossOriginEmbedderPolicy` for Socket.IO compatibility

### What NOT to use
- No alternative to Helmet — it's the universal Express security standard

## Structured Logging — Pino

**Recommendation:** Pino + pino-http
**Confidence:** HIGH

### Why Pino over Winston
- ~5x faster than Winston (matters for request logging)
- Produces NDJSON natively — ideal for Docker/stdout
- `pino-http` auto-logs every request with two-line setup
- `console.error` replacement is a direct swap across all modules

### Setup
```typescript
// config/logger.ts
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
```

### What NOT to use
- **Winston** — slower, more config, better for file transport (not needed here)
- **Log management SaaS** — overkill for dev environment

## Socket.IO Auth

**Recommendation:** Use existing jsonwebtoken + prisma in io.use() middleware
**Confidence:** HIGH

### Pattern
- Cookie parsing before Socket.IO handshake
- JWT verification in `io.use()` middleware
- Room membership check against ProjectMember table
- No new packages required — uses existing `jsonwebtoken` and `cookie-parser`

## File Upload Security

**Recommendation:** file-type v18 (CJS compatible)
**Confidence:** MEDIUM

### Why
- Validates actual file content, not just extension
- v19+ is ESM-only; v18 is the safe pin for CJS API
- Add as `fileFilter` in multer config

## Roadmap Implications

1. **No new validation library needed** — Zod is installed. Work = writing schemas + middleware
2. **Testing setup is one config file** — `vitest.config.ts` per app. Bulk of work is writing tests
3. **Security middleware is mostly configuration** — Helmet, CORS hardening, auth limiter are quick wins
4. **Socket.IO auth is the one with real logic** — needs middleware + room membership check
5. **Logging is a find-replace** — setup Pino once, then replace console calls

## Open Questions

- `zod-prisma-types` codegen vs manual schemas — evaluate at validation phase
- `file-type` v18 vs v19 — depends on `import()` support in API
- Test database strategy — Docker PostgreSQL vs SQLite for speed
