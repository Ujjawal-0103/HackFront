# Traceback Root Cause Register & Technical Audit

**Author:** Principal Software Engineer, Application Architect, QA & Security Lead  
**Status:** Complete & Verified  
**Date:** 2026-10-25  
**Working Branch:** `feature/github-live-integration` (tracking `sprint-8-quality-hardening` base)

---

## Root Cause Register Matrix

### RC-01: Mock Sandbox & Ingestion Rate Limit Warning (`59 remaining (< 100)`)

- **Observed Symptom:** Synchronizing a mock repository or unconfigured repository failed with: `GitHub rate limit low quota safety threshold reached: 59 remaining (< 100)`.
- **Exact Source Code Location:**
  - `apps/api/src/github/github.module.ts` (static binding of `GITHUB_INGESTION_ADAPTER_TOKEN`)
  - `apps/api/src/github/github-ingestion.adapter.ts:354-385` (`executeRequest` omitted auth token when `installationId` was unauthenticated)
  - `apps/api/src/ingestion/ingestion-orchestrator.service.ts`
- **Conditions Required to Reproduce:** Trigger repository synchronization on a repository without an active GitHub installation token or in mock mode while the live adapter was bound.
- **Underlying Root Cause:**
  1. `GitHubIngestionAdapter` made outbound HTTP requests to `https://api.github.com` without an `Authorization` header.
  2. GitHub limits unauthenticated client IPs to **60 requests per hour**. After 1 request, 59 remained.
  3. Proactive safety guard (`RATE_LIMIT_LOW_QUOTA_THRESHOLD = 100`) blocked the request because `59 < 100`.
- **Why Previous Implementation Allowed It:** The module provider statically selected `GitHubIngestionAdapter` regardless of runtime workspace installation status, and entity-fetching methods lacked token propagation.
- **Minimal Safe Correction:**
  - Implemented `DelegatingGitHubIngestionAdapter` (`apps/api/src/github/delegating-github-ingestion.adapter.ts`).
  - Strict sandbox routing: requests in mock mode, or with `installationId === 1001`, or for fixtures (`acme-corp`) route strictly to `MockGitHubIngestionAdapter` (zero real HTTP requests).
  - Live requests route to `GitHubIngestionAdapter` using installation tokens with 5,000 requests/hr quota.
  - Added an assertion in `GitHubIngestionAdapter` explicitly rejecting `installationId === 1001`.
- **Regression Test:** `apps/api/src/github/github-integration.spec.ts` ("Mock vs Live Integration Boundary" & "DelegatingGitHubIngestionAdapter").
- **Runtime Validation:** Verified against live GitHub API for repository `Ujjawal-0103/HackFront` (140 commits, 9 PRs ingested; quota remaining: 4,997/5,000).

---

### RC-02: Stale Stuck `SYNCING` Job State in Database and UI

- **Observed Symptom:** Repositories page displayed an infinite "Syncing..." status; the Sync button remained permanently disabled even after days or application restarts.
- **Exact Source Code Location:**
  - `apps/api/src/ingestion/ingestion-orchestrator.service.ts` (retries for rate-limit errors did not set terminal state)
  - `apps/api/src/ingestion/ingestion-sync.service.ts` (absence of stale job cleanup)
  - `apps/web/src/app/repositories/page.tsx` (`isSyncing = repo.syncStatus === "SYNCING"`)
- **Conditions Required to Reproduce:** Any sync job encountering an unhandled or retryable error on a background worker where the job failed to reach `COMPLETED` or `FAILED`.
- **Underlying Root Cause:** The sync job database record `ab7d2926-6c76-479f-85e0-f9799f4d2d8c` created on 2026-10-18 remained indefinitely in `SYNCING` status with the rate-limit error message. Frontend code locked the UI if `syncStatus === "SYNCING"`.
- **Why Previous Implementation Allowed It:** No background reaper or lifecycle timeout was in place to detect stale abandoned jobs (> 15 minutes).
- **Minimal Safe Correction:**
  - Implemented `cleanupStaleSyncJobs(repositoryId?: string)` in `IngestionSyncService` to transition jobs older than 15 minutes to `FAILED`.
  - Added a 15-minute staleness check in `apps/web/src/app/repositories/page.tsx` to unlock the UI button.
  - Added an inline diagnostic banner in the UI with a direct **Retry Sync** button.
- **Regression Test:** `apps/api/src/ingestion/ingestion-sync.service.spec.ts` ("cleanupStaleSyncJobs").
- **Runtime Validation:** Database query confirmed job `ab7d2926-6c76-479f-85e0-f9799f4d2d8c` transitioned from `SYNCING` to `FAILED`; subsequent syncs completed cleanly.

---

### RC-03: Private Key Path Resolution Failure (`isConfigured: false`)

- **Observed Symptom:** API logged `GitHub App running in development mock sandbox mode (live credentials unconfigured)` even though valid `.env` and `secrets/github-app-private-key.pem` existed.
- **Exact Source Code Location:**
  - `apps/api/src/config/configuration.ts:54-68`
  - `apps/api/src/github/github-app-auth.service.ts:72-88`
- **Conditions Required to Reproduce:** Launching the API via Turborepo (`turbo run dev`) or directly from `apps/api`, where `process.cwd()` is `C:\Users\Ujjaw\HackFront\apps\api`.
- **Underlying Root Cause:** `path.resolve(process.cwd(), keyPath)` resolved to `apps/api/secrets/github-app-private-key.pem`, which did not exist because `secrets/` is located at the monorepo root. Key reading threw `ENOENT`, which was caught and caused silent fallback to mock mode.
- **Why Previous Implementation Allowed It:** Assumed `process.cwd()` is always the repository root.
- **Minimal Safe Correction:** Updated both `configuration.ts` and `github-app-auth.service.ts` to probe candidate directories (`process.cwd()`, `path.resolve(process.cwd(), '../..')`, `path.resolve(process.cwd(), '..')`).
- **Regression Test:** `apps/api/src/github/github-integration.spec.ts` ("Private Key Path Resolution").
- **Runtime Validation:** API bootstrap successfully logs: `[GitHubService] GitHub App live configuration detected and loaded`.

---

### RC-04: IPv6 Port Collision on Port 3001

- **Observed Symptom:** Next.js frontend or browser requests to `http://localhost:3001/api/...` returned HTML of an unrelated web application instead of JSON from Traceback API.
- **Exact Source Code Location:** `apps/web/src/lib/api.ts:31-35`
- **Conditions Required to Reproduce:** An unrelated process (PID 28900 for `Cloud_File_Storage_System`) bound to IPv6 `[::]:3001` on Windows while Traceback API was bound to IPv4 `0.0.0.0:3001`.
- **Underlying Root Cause:** Windows Node.js 18+ resolves `localhost` to `::1` (IPv6 loopback) before `127.0.0.1`. Requests to `localhost:3001` were routed to the foreign application.
- **Why Previous Implementation Allowed It:** Used `localhost:3001` instead of explicit IPv4 `127.0.0.1:3001`.
- **Minimal Safe Correction:** Updated `apps/web/src/lib/api.ts` to default to `http://127.0.0.1:3001/api`.
- **Regression Test:** `apps/web/src/lib/api.spec.ts`.
- **Runtime Validation:** Verified curl requests to `http://127.0.0.1:3001/api/health` return valid Traceback API JSON payloads.

---

### RC-05: Seeding Unique Constraint Failure on Default Users

- **Observed Symptom:** API logged continuous warnings on every request:
  `[WorkspacesService] Failed to seed default workspaces in database: Unique constraint failed on the fields: (email)`.
- **Exact Source Code Location:** `apps/api/src/workspaces/workspaces.service.ts:48-53`
- **Conditions Required to Reproduce:** Calling `ensureDefaultWorkspaces()` when `user_1` was already in the database.
- **Underlying Root Cause:** Both `user_1` and `usr_verified_123` were declared with `email: "alex@company.com"`. In the Prisma schema, `User.email` is `@unique`. Upserting `usr_verified_123` by `id` attempted to insert duplicate email `"alex@company.com"`, throwing a unique constraint error and preventing `this.defaultsSeeded = true` from being set.
- **Why Previous Implementation Allowed It:** Dev fixtures treated `user_1` and `usr_verified_123` as aliases without accounting for the database unique email constraint.
- **Minimal Safe Correction:** Updated `usr_verified_123`'s seed email to `alex.verified@company.com`.
- **Regression Test:** `apps/api/src/workspaces/workspaces.service.spec.ts` & full test suite.
- **Runtime Validation:** Seeding completes without warnings on API startup.

---

### RC-06: Corrupted Webpack Cache in Web Application (`Cannot find module './193.js'`)

- **Observed Symptom:** Next.js development server on port 3000 returned HTTP 500 with `Cannot find module './193.js'` in `webpack-runtime.js`.
- **Exact Source Code Location:** `apps/web/.next` build cache.
- **Conditions Required to Reproduce:** Running `next build` or Turborepo build while the Next.js dev server was active, invalidating internal chunk manifests.
- **Underlying Root Cause:** Webpack chunk manifests referenced intermediate build artifacts that were deleted or modified by concurrent build operations.
- **Minimal Safe Correction:** Cleared `apps/web/.next` directory and cleanly restarted the development server.
- **Runtime Validation:** Next.js successfully compiles and serves `/login`, `/repositories`, and `/evidence` with HTTP 200 OK.
