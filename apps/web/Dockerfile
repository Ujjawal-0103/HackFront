# ==============================================================================
# Traceback Web Frontend Production Dockerfile
# Multi-stage build with non-root security execution and healthcheck
# ==============================================================================

# --- Stage 1: Build Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy monorepo workspace configurations and lockfile
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/next.config.js ./apps/web/
COPY packages/shared-types ./packages/shared-types

# Install all dependencies reproducibly
RUN npm ci

# Build shared types dependency
RUN npm run build --workspace=@traceback/shared-types

# Copy Web frontend source code and public assets
COPY apps/web/src ./apps/web/src

# Build production Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@traceback/web

# --- Stage 2: Production Runtime Container ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Add non-root system group and user
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 -G nodejs nextjs

# Install wget for lightweight healthcheck execution
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/web/next.config.js ./apps/web/
COPY packages/shared-types ./packages/shared-types

# Copy node_modules and built .next artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Set file permissions for non-root execution
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Container Healthcheck (polls /api/health endpoint)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Launch production Next.js server
CMD ["npm", "run", "start", "--workspace=@traceback/web"]
