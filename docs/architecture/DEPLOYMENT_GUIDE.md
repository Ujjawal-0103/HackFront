# Traceback Deployment & Infrastructure Guide

> **Document Status:** Operational Deployment Specification  
> **Applies to:** Docker, Docker Compose, Kubernetes, and Bare Metal Linux Deployments

---

## 1. Deployment Topology & Environments

Traceback operates in three discrete environments:

```
[Development]
  Local Dev: Host Node.js processes + Docker Compose (PostgreSQL on 5434, Redis on 6379, Neo4j on 7474)

[Automated CI/Testing]
  GitHub Actions: Ephemeral PostgreSQL 16 & Redis 7 service containers with automated Prisma migrations

[Production]
  Multi-container Orchestration:
    - Ingress / Reverse Proxy (e.g. Caddy or Nginx with TLS termination)
    - Web Frontend (`@traceback/web` container on 3000)
    - API Backend (`@traceback/api` container on 3001)
    - PostgreSQL 16 (isolated internal container network, persistent volume)
    - Redis 7 (isolated internal container network, persistent volume)
```

---

## 2. Container Security Architecture

All production containers enforce enterprise container security standards:

1. **Multi-Stage Builds:** Development dependencies, TypeScript compilers, and temporary caches are stripped out of the runtime stage.
2. **Non-Root Execution:**
   - API executes under dedicated system user `nodejs` (UID 10001, GID 10001).
   - Web executes under dedicated system user `nextjs` (UID 10001, GID 10001).
3. **Network Isolation:** PostgreSQL and Redis containers reside on `traceback-internal`, an internal Docker network with `internal: true`. They have no host port mappings and are inaccessible from external interfaces.
4. **Health & Startup Dependency:**
   - PostgreSQL must be healthy (`pg_isready`) before API starts.
   - Redis must be healthy (`redis-cli ping`) before API starts.
   - API must be healthy (`GET /api/health`) before Web starts.
5. **No Watch Mode in Production:** Production containers run deterministic production builds (`node apps/api/dist/main.js` and `npm run start --workspace=@traceback/web`), never development file watchers.

---

## 3. Production Deployment Step-by-Step

### 3.1 Step 1: Environment Preparation

Create a dedicated, secret-protected `.env.production` file on the deployment host:

```bash
# Production Database Credentials (use high-entropy passwords)
POSTGRES_USER=traceback_prod_app
POSTGRES_PASSWORD=generate_a_very_secure_random_password_here_32chars!
POSTGRES_DB=traceback_production

# Web & API Base URLs
WEB_URL=https://traceback.yourcompany.com
NEXT_PUBLIC_API_URL=https://traceback.yourcompany.com/api

# GitHub App Integration (Optional — required only for live repo ingestion)
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
```

### 3.2 Step 2: Database Migration Deployment

Before launching web and API services, execute the idempotent Prisma migration deployment against the production database:

```bash
# Execute migrations within an ephemeral migration runner container:
docker run --rm \
  --network traceback_traceback-internal \
  -e DATABASE_URL="postgresql://traceback_prod_app:YOUR_PASSWORD@traceback-prod-postgres:5432/traceback_production?schema=public" \
  traceback-prod-api:latest \
  npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### 3.3 Step 3: Launch Service Stack

Launch the multi-container stack in detached mode:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 3.4 Step 4: Verify Deployment Health

Poll the health endpoints:

```bash
# API Health Check
curl -f http://127.0.0.1:3001/api/health
# Response: {"status":"ok","service":"@traceback/api","version":"0.1.0",...}

# API Readiness Check (verifies DB connection pool)
curl -f http://127.0.0.1:3001/api/ready
# Response: {"status":"ready","service":"@traceback/api",...}

# Web Frontend Health Check
curl -f http://127.0.0.1:3000/api/health
# Response: {"status":"ok","service":"@traceback/web",...}
```

---

## 4. Zero-Downtime Rollback & Graceful Shutdown

1. Both containers register handlers for `SIGTERM` and `SIGINT`, allowing active HTTP requests and in-flight BullMQ jobs up to 15 seconds to drain before process exit.
2. In the event of a deployment failure, containers restart with the previous image tag:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-build
   ```
