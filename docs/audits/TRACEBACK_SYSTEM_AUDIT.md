# Traceback System Architecture, Security & Operational Audit

**System:** Traceback (Human-Supervised Verification System for AI-Generated Code Explanations)  
**Author:** Principal Software Engineer, Application Architect & Security Lead  
**Audit Date:** 2026-10-25  
**Working Branch:** `feature/github-live-integration` (tracking `sprint-8-quality-hardening` base)

---

## 1. System Topology & Architecture

Traceback is structured as an npm-governed monorepo orchestrated via Turborepo:

```
[ Web Browser Client ] (Next.js 14 / React 18 on :3000)
         |
         | HTTP / REST (http://127.0.0.1:3001/api)
         v
[ Traceback API Gateway ] (NestJS 10 on :3001)
   |-- Authentication & Workspace Guards (JWT + HMAC-SHA256)
   |-- Repositories & Ingestion Controllers
   |-- Ingestion Orchestrator Service
   |-- Claim Extractor & Verification Engines
   |
   +---> [ PostgreSQL 16 ] (Port 5432) — Authoritative relational data & FTS evidence ledger
   +---> [ Redis / BullMQ ] (Port 6379) — Background sync queue (with in-process development fallback)
   +---> [ GitHub REST API ] (api.github.com) — Authenticated via GitHub App installation tokens
   +---> [ Model Context Protocol (MCP) Server ] (packages/mcp-server) — stdio integration for IDE assistants
```

---

## 2. Authentication & Workspace Isolation

### 2.1 Session & Token Lifecycle
- **Password Security:** Scrypt-based hashing with cryptographically secure salts (`password.util.ts`).
- **Session Tokens:** 256-bit cryptographically secure hex tokens with SHA-256 database hashing (`tokenHash` in `user_sessions` table). Raw tokens are never persisted in plaintext.
- **Expiration & Revocation:** Configurable session TTL (default 7 days). Revocation transitions `isRevoked: true` in PostgreSQL; revoked tokens are rejected immediately by `AuthGuard`.
- **Identity Integrity:** `AuthGuard` strictly enforces that unauthenticated requests never substitute or inherit fallback identities (such as `usr_verified_123`).

### 2.2 Object-Level Workspace Authorization
- Every authenticated request requires a valid `x-workspace-id` header or URL workspace parameter.
- `WorkspaceGuard` asserts that the authenticated user holds an active membership record in `workspace_members` for the targeted workspace.
- Cross-workspace queries, evidence retrieval, repository operations, and verification sessions strictly reject unauthorized workspace IDs with HTTP 403 Forbidden.

---

## 3. GitHub Integration: Live Mode vs. Development Mock Sandbox

| Dimension | Development Mock Sandbox | Live Production Integration |
|---|---|---|
| **Activation Flag** | `isConfigured: false`, `isMockMode: true` | `isConfigured: true`, `isMockMode: false` |
| **Prerequisites** | None (default in development when credentials are absent) | Valid `GITHUB_APP_ID`, valid RSA private key PEM (`GITHUB_APP_PRIVATE_KEY_PATH` or string), `GITHUB_APP_SLUG` |
| **Ingestion Adapter** | `MockGitHubIngestionAdapter` | `GitHubIngestionAdapter` |
| **Network Boundary** | Strict: **Zero calls to `api.github.com`** | Authenticated GitHub REST calls with Bearer installation token |
| **Rate Limit Quota** | None consumed (deterministic in-memory fixture responses) | 5,000 requests/hour per installation (monitored against safety threshold) |
| **Installation ID** | Fixture `1001` (cannot be linked in live mode) | Valid numeric GitHub App installation ID (e.g. `173390166`) |
| **Fixture Guard** | Handled by `DelegatingGitHubIngestionAdapter` | `GitHubIngestionAdapter` rejects `installationId === 1001` with `GitHubValidationError` |
| **Production Rule** | **Strictly forbidden** when `NODE_ENV === "production"` | Mandatory for production operations |

---

## 4. Background Ingestion & Reliability

### 4.1 Redis & Queue Degradation Strategy
- **Production Mode:** BullMQ backed by Redis for durable, distributed job orchestration with exponential backoff and bounded retries (3 attempts).
- **Development Fallback Mode:** When Redis is offline in local development, `IngestionSyncService` logs a warning and routes the ingestion task directly to `IngestionOrchestratorService`, ensuring developers can synchronize and test repositories without requiring external infrastructure.
- **Graceful Shutdown:** Connection event handlers prevent unhandled rejections during process termination.

### 4.2 Self-Healing Stale Job Reaper
- Stale sync jobs (> 15 minutes) stuck in `SYNCING` state are automatically marked `FAILED` by `cleanupStaleSyncJobs()`.
- The frontend computes job age against current time; jobs older than 15 minutes unlock the Sync button and present a "Retry Sync" action.

---

## 5. Model Context Protocol (MCP) Server Audit

- **Package:** `@traceback/mcp-server`
- **Supported Tools:**
  1. `verify_explanation`: Verifies AI-generated code explanations against stored repository evidence.
  2. `find_historical_context`: Retrieves commit and PR context matching file paths and query terms.
  3. `check_change_against_decisions`: Evaluates prospective code diffs against historical architectural decisions.
- **Security Protections:**
  - Strict input validation using Zod schemas with bounded character lengths.
  - Prompt injection neutralization: Repository diffs and code snippets are treated strictly as passive text data.
  - Credential isolation: MCP tools only communicate with the API using trusted server-configured tokens. Caller-supplied credentials are never accepted.
  - Redaction: Error handlers sanitize downstream API errors to prevent token leakage in tool outputs.

---

## 6. Dependency & Secret Hygiene Audit

### 6.1 Secret Tracking Review
- Git history and working tree inspected. All `.env` and `secrets/*.pem` files are excluded by `.gitignore`.
- Placeholder examples in `.env.example` verified free of private keys, client secrets, and real tokens.
- No secret credentials exist in client-side bundles or public frontend environment variables.

### 6.2 Dependency Audit Findings
- Monorepo `npm audit` returned 33 vulnerabilities (including `multer`, `next`, `postcss`, `tmp`, `webpack`).
- **Architectural Decision:** Per project safety guidelines, `npm audit fix --force` is **not permitted** as it introduces major breaking changes (Next.js 16, NestJS 12, Express 5, Zod 4).
- Production deployments use containerized multi-stage builds with non-root runtime users to mitigate local execution risks.
