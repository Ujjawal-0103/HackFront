# ==============================================================================
# Traceback API Backend Production Dockerfile
# Multi-stage build with non-root security execution and healthcheck
# ==============================================================================

# --- Stage 1: Build & Prune Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build essentials for native module compilation
RUN apk add --no-cache libc6-compat python3 make g++

# Copy monorepo workspace configurations and lockfile
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY packages/shared-types ./packages/shared-types

# Install all dependencies reproducibly
RUN npm ci

# Generate Prisma Client for PostgreSQL schema
RUN npm run prisma:generate --workspace=@traceback/api

# Build shared types dependency
RUN npm run build --workspace=@traceback/shared-types

# Copy API backend source code
COPY apps/api/src ./apps/api/src

# Build production NestJS bundle
RUN npm run build --workspace=@traceback/api

# --- Stage 2: Production Runtime Container ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Add non-root system group and user
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 -G nodejs nodejs

# Install wget for lightweight healthcheck execution
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types ./packages/shared-types

# Copy built node_modules and Prisma client artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Set file permissions for non-root execution
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Container Healthcheck (polls /api/health endpoint)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

# Launch production NestJS server
CMD ["node", "apps/api/dist/main.js"]
