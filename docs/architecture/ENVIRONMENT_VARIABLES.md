# Traceback Environment Variable Reference & Configuration Guide

> **Document Version:** 1.0.0 (Sprint 9 Release Hardening)  
> **Applies to:** Monorepo (`apps/api`, `apps/web`, `packages/mcp-server`)

---

## 1. Overview & General Configuration Rules

Traceback uses typed environment configuration managed via `@nestjs/config` in the API, `process.env` in Next.js, and scoped environment variables in the MCP server CLI.

### Core Rules:

1. **Never Commit Secrets:** Real API keys, database credentials, JWT secrets, and private keys must never be committed to Git.
2. **Strict Production Validation:** The API validates that required production variables are set at startup and rejects default development credentials.
3. **Least Privilege:** API tokens and credentials should grant minimum required scopes.

---

## 2. Environment Variables by Component

### 2.1 API Backend (`apps/api`)

| Variable                   | Description                                                            | Required in Prod? | Default (Dev)                                                                       | Example                                                            |
| -------------------------- | ---------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                 | Application runtime environment (`development`, `test`, `production`). | **Yes**           | `development`                                                                       | `production`                                                       |
| `PORT`                     | HTTP port on which the NestJS API listens.                             | No                | `3001`                                                                              | `3001`                                                             |
| `DATABASE_URL`             | PostgreSQL 16 connection URI including schema parameter.               | **Yes**           | `postgresql://postgres:postgrespassword@localhost:5434/traceback_dev?schema=public` | `postgresql://user:pass@db-host:5432/traceback_prod?schema=public` |
| `WEB_URL`                  | URL of the frontend application for CORS authorization.                | **Yes**           | `http://localhost:3000`                                                             | `https://traceback.example.com`                                    |
| `REDIS_HOST`               | Hostname for Redis 7 (used by BullMQ ingestion queue).                 | **Yes**           | `localhost`                                                                         | `redis.internal`                                                   |
| `REDIS_PORT`               | Port for Redis service.                                                | No                | `6379`                                                                              | `6379`                                                             |
| `REDIS_PASSWORD`           | Password for Redis authentication (recommended in production).         | No                | _(empty)_                                                                           | `s3cur3_r3d1s_p@ss`                                                |
| `GITHUB_APP_ID`            | GitHub App ID for live repository ingestion.                           | Optional*         | _(empty)_                                                                           | `123456`                                                           |
| `GITHUB_APP_CLIENT_ID`     | GitHub App OAuth client ID.                                            | Optional*         | _(empty)_                                                                           | `Iv1.abc123xyz`                                                    |
| `GITHUB_APP_CLIENT_SECRET` | GitHub App OAuth client secret.                                        | Optional*         | _(empty)_                                                                           | `ghs_secret_xyz`                                                   |
| `GITHUB_APP_PRIVATE_KEY`   | GitHub App PEM private key string (base64 or multiline).               | Optional*         | _(empty)_                                                                           | `-----BEGIN RSA PRIVATE KEY...`                                    |
| `GITHUB_WEBHOOK_SECRET`    | Secret used to verify HMAC-SHA256 GitHub webhook signatures.           | Optional*         | `development-webhook-secret`                                                        | `whsec_random_entropy_string`                                      |
| `NEO4J_URI`                | Bolt URI for optional Neo4j graph database.                            | No (Optional)     | `bolt://localhost:7687`                                                             | `bolt://neo4j.internal:7687`                                       |
| `NEO4J_USERNAME`           | Username for Neo4j database.                                           | No                | `neo4j`                                                                             | `neo4j`                                                            |
| `NEO4J_PASSWORD`           | Password for Neo4j database.                                           | No                | `tracebackpassword`                                                                 | `neo4j_secret_pass`                                                |
| `NEO4J_DATABASE`           | Database name for Neo4j instance.                                      | No                | `neo4j`                                                                             | `neo4j`                                                            |

_\*Note: GitHub App variables are required only when enabling live GitHub repository synchronization. When omitted, Traceback operates cleanly using local test fixtures, mock adapters, or PostgreSQL full-text search._

---

### 2.2 Web Frontend (`apps/web`)

| Variable              | Description                                                         | Required in Prod? | Default (Dev)               | Example                                 |
| --------------------- | ------------------------------------------------------------------- | ----------------- | --------------------------- | --------------------------------------- |
| `NODE_ENV`            | Next.js environment.                                                | **Yes**           | `development`               | `production`                            |
| `PORT`                | Web server listening port.                                          | No                | `3000`                      | `3000`                                  |
| `NEXT_PUBLIC_API_URL` | Browser-accessible base URL for Traceback API endpoints.            | **Yes**           | `http://localhost:3001/api` | `https://api.traceback.example.com/api` |
| `DEFAULT_THEME`       | Application default theme (strictly enforced as light first-visit). | No                | `light`                     | `light`                                 |

---

### 2.3 Model Context Protocol (MCP) Server (`packages/mcp-server`)

| Variable                       | Description                                                                  | Required? | Default                     | Example                      |
| ------------------------------ | ---------------------------------------------------------------------------- | --------- | --------------------------- | ---------------------------- |
| `TRACEBACK_API_URL`            | Base URL of the running Traceback API instance.                              | No        | `http://localhost:3001/api` | `http://localhost:3001/api`  |
| `TRACEBACK_API_TOKEN`          | Bearer session token used by the MCP server to authenticate against the API. | **Yes**   | _(empty)_                   | `tb_live_usr_abc123_entropy` |
| `TRACEBACK_WORKSPACE_ID`       | Default workspace ID to use when not specified in client arguments.          | No        | _(empty)_                   | `ws_alpha`                   |
| `TRACEBACK_REQUEST_TIMEOUT_MS` | Timeout for API requests in milliseconds.                                    | No        | `15000`                     | `20000`                      |

---

## 3. Configuration Validation at Startup

In `apps/api/src/config/configuration.ts`, Traceback enforces startup constraints when `NODE_ENV=production`:

1. `DATABASE_URL` must be non-empty and start with `postgresql://` or `postgres://`.
2. `DATABASE_URL` cannot equal the local development connection string containing `postgrespassword@localhost`.
3. `PORT` must be a valid port number between `1` and `65535`.
4. If invalid or missing, bootstrap halts immediately with a clear error without printing secret credentials.
