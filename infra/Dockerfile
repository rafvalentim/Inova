# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/ packages/
COPY apps/ apps/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build shared package, API and Web
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production

WORKDIR /app

# Copy workspace manifests and install production deps only
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma

# Copy built frontend (served by nginx)
COPY --from=builder /app/apps/web/dist /app/public

# Create uploads directory
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
