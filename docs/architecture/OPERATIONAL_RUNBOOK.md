# Traceback Operational Runbook & Observability Guide

> **Sprint:** Sprint 9 — Production Readiness & Release Hardening  
> **Status:** Active Operational Reference  
> **Applies to:** Production Engineering, Site Reliability Engineering (SRE), and Support

---

## 1. Observability Architecture

Traceback utilizes a lightweight, structured observability model designed for high operational visibility without external dependency bloat.

### 1.1 Request Correlation (`X-Request-ID`)

- Every incoming HTTP request to the API receives or propagates an `X-Request-ID` header.
- The correlation ID is attached to the request context and returned on all HTTP responses.
- Clients, web frontends, and MCP server sessions should include this ID when reporting errors.

### 1.2 Structured Logging & Automatic Redaction

All logging through NestJS `Logger` and Express middleware automatically routes through the global secret redaction engine:

- Database URLs (`postgresql://user:pass@host`) are sanitized to `postgresql://user:[REDACTED]@host`.
- Authorization headers (`Bearer <token>`) are sanitized to `Bearer [REDACTED]`.
- Session tokens (`tb_live_*`, `tb_token_*`, `traceback_token_*`) are sanitized to `[REDACTED_TOKEN]`.
- Passwords, webhook secrets, and private keys are never emitted to stdout or stderr.

---

## 2. Health & Readiness Monitoring

### 2.1 API Liveness Check (`GET /api/health`)

- **Purpose:** Verifies that the NestJS process is running and responding to HTTP requests.
- **Expected Status:** HTTP 200 OK.
- **Example Response:**
  ```json
  {
    "status": "ok",
    "service": "@traceback/api",
    "version": "0.1.0",
    "timestamp": "2026-10-18T10:00:00.000Z",
    "uptimeSeconds": 1420
  }
  ```

### 2.2 API Readiness Check (`GET /api/ready`)

- **Purpose:** Verifies that critical downstream infrastructure dependencies (PostgreSQL connection pool, configuration) are operational.
- **Expected Status:**
  - HTTP 200 OK when database is responsive.
  - HTTP 503 Service Unavailable when database connection is degraded or down.
- **Example Response (Healthy):**
  ```json
  {
    "status": "ready",
    "service": "@traceback/api",
    "timestamp": "2026-10-18T10:00:00.000Z",
    "checks": {
      "config": { "ready": true, "message": "Configuration validated successfully" },
      "database": { "ready": true, "message": "PostgreSQL database responsive" }
    }
  }
  ```

### 2.3 Web Frontend Health Check (`GET /api/health`)

- **Purpose:** Verifies that the Next.js web application is running and responding.
- **Expected Status:** HTTP 200 OK.

---

## 3. Background Job Queue Monitoring (BullMQ & Redis)

### 3.1 Job Queue Overview

Repository ingestion operations (fetching Git commits, pull requests, issues, and diffs) execute asynchronously via BullMQ on the `ingestion-queue` Redis queue.

### 3.2 Job Lifecycle & Status Inspection

Jobs move through the following states:

1. `PENDING` -> Enqueued in Redis.
2. `SYNCING` -> Ingestion worker actively processing batches.
3. `COMPLETED` -> All historical artifacts persisted and FTS indexed.
4. `FAILED` -> Terminal failure recorded with sanitized error message.

### 3.3 Retry Strategy & Failure Visibility

- **Retryable Errors:** Rate limits (HTTP 429), gateway timeouts (HTTP 504), transient network disconnections are retried up to 3 times with exponential backoff (200ms, 400ms, 800ms).
- **Non-Retryable Errors:** Bad credentials (HTTP 401), installation revoked, repository not found (HTTP 404) immediately transition the job to `FAILED` and log an error alert without retrying.

---

## 4. Troubleshooting Common Incidents

### Incident 1: Database Connection Refused at Startup

- **Symptom:** API logs `Can't reach database server at localhost:5434` or container exits.
- **Diagnosis:**
  1. Check PostgreSQL container status: `docker ps -f name=postgres`.
  2. Test database port: `pg_isready -h localhost -p 5434 -U postgres`.
  3. Verify `DATABASE_URL` matches container network name in production.
- **Mitigation:** Start container `docker compose up -d postgres` and verify health.

### Incident 2: Redis Disconnection during Ingestion

- **Symptom:** API logs `Failed to enqueue sync job: Redis connection refused on 6379`.
- **Diagnosis:**
  1. Check Redis container: `docker exec -it traceback-prod-redis redis-cli ping`.
  2. Verify memory limits and persistent volume permissions.
- **Mitigation:** Restart Redis service and trigger re-sync from web UI or API.

### Incident 3: MCP Client Receives 401 Unauthorized

- **Symptom:** MCP tool invocation returns `UNAUTHENTICATED: TRACEBACK_API_TOKEN is not configured`.
- **Diagnosis:**
  1. Verify client configuration has `TRACEBACK_API_TOKEN` populated.
  2. Verify token has not expired or been revoked via logout.
- **Mitigation:** Generate a new session token via `/login` and update launcher config.

---

## 5. Known Operational Limitations

1. **Neo4j Cluster Disconnection:** When Neo4j is offline or not deployed, Traceback transparently falls back to PostgreSQL Full-Text Search. No graph visualization is displayed, but evidence retrieval remains 100% operational.
2. **Repository Diff Size Caps:** Source code diffs exceeding 20,000 characters are safely truncated to protect worker memory.
3. **Public API Rate Limits:** Login attempts are rate-limited to 5 failed attempts per 15-minute window per email address.
