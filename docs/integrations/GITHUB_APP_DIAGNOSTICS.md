# GitHub App Integration Diagnostics & Audit Report

**Date:** 2026-10-25  
**Branch:** `feature/github-live-integration`  
**System:** Traceback (Code Rationale Verification Engine)  
**Authoritative Specification:** [`PROJECT_SPEC.md`](../../PROJECT_SPEC.md)

---

## 1. Executive Summary

This diagnostic report documents the root causes, architectural fixes, test validations, and live GitHub App integration state for Traceback repository ingestion.

All primary issues identified in the problem statement have been resolved:

1. **Mock Mode Rate Limit Bug:** Resolved. Mock fixtures (`installationId: 1001` or `MockGitHubIngestionAdapter`) are strictly sandboxed and never contact `api.github.com`.
2. **Rate Limit Warning (`59 remaining (< 100)`):** Root cause identified as unauthenticated public requests sent by the live ingestion adapter when installation tokens were missing.
3. **Stale `SYNCING` Job State in Database and UI:** Resolved. Stale jobs (> 15 minutes) are automatically transitioned to `FAILED`. The UI unfreezes buttons and provides an explicit "Retry Sync" action.
4. **Configuration Resolution Bug:** Resolved. `GITHUB_APP_PRIVATE_KEY_PATH` resolution now checks candidate root directories (`process.cwd()`, `../..`, `..`, etc.) so keys load seamlessly from both root and workspace subdirectories.
5. **Live GitHub Ingestion Verification:** Verified end-to-end against live GitHub App (`traceback-code-verification`, App ID `5366665`) for repository `Ujjawal-0103/HackFront`. Ingested 140 commits and 9 PRs with authenticated quota (4,997/5,000 remaining).

---

## 2. Root Cause Analysis

### 2.1 Why Mock Mode & Live Synchronization Triggered Rate Limit Warnings

- **The Warning:** `GitHub rate limit low quota safety threshold reached: 59 remaining (< 100)`.
- **Mechanism:**
  1. Previously, `apps/api/src/github/github.module.ts` bound `GITHUB_INGESTION_ADAPTER_TOKEN` directly to `GitHubIngestionAdapter` or used a static flag that did not account for runtime execution contexts.
  2. When an ingestion job was triggered without a valid installation access token, `GitHubIngestionAdapter.executeRequest()` issued unauthenticated HTTP requests to `https://api.github.com`.
  3. GitHub enforces an IP-based limit of 60 requests per hour for unauthenticated calls. After 1 request was consumed, 59 remained.
  4. The safety guard (`RATE_LIMIT_LOW_QUOTA_THRESHOLD = 100`) detected `59 < 100` and threw a `GitHubRateLimitError`.

### 2.2 Did Mock Mode Contact the Actual GitHub API?

- **Yes, historically:** When repositories with mock installation ID 1001 were synced while `GITHUB_INGESTION_ADAPTER_TOKEN` pointed to `GitHubIngestionAdapter`, it executed outbound calls to `api.github.com/repos/Ujjawal-0103/HackFront`.
- **Fix Applied:** Implemented [`DelegatingGitHubIngestionAdapter`](../../apps/api/src/github/delegating-github-ingestion.adapter.ts). It acts as an authoritative runtime boundary:
  - Any request where `isMockMode === true`, or `installationId === 1001`, or for known fixtures (`acme-corp`) is routed strictly to `MockGitHubIngestionAdapter`. Zero network requests are made.
  - Furthermore, `GitHubIngestionAdapter` includes an assertion throwing `GitHubValidationError` if `installationId === 1001` is ever received.

### 2.3 Did Stale Jobs or Old Processes Contribute?

- **Yes:**
  1. An old synchronization job (`ab7d2926-6c76-479f-85e0-f9799f4d2d8c`) created on 2026-10-18 was classified as retryable upon receiving the rate-limit error, leaving its status indefinitely stuck in `SYNCING`.
  2. The frontend calculated `isSyncing = repo.syncStatus === "SYNCING"`, permanently disabling the Sync button in the UI.
  3. A background Node.js process (PID 28900, `Cloud_File_Storage_System`) was bound to IPv6 `[::]:3001`. Windows Node 18+ resolved `localhost` to `::1` before `127.0.0.1`, intercepting `http://localhost:3001` with an unrelated HTML application.
  4. **Fix Applied:**
     - Added `cleanupStaleSyncJobs()` in `IngestionSyncService` to transition jobs older than 15 minutes to `FAILED`.
     - Updated `apps/web/src/lib/api.ts` to use `http://127.0.0.1:3001/api` by default.
     - Updated `apps/web/src/app/repositories/page.tsx` with a 15-minute staleness check and a direct "Retry Sync" action.

---

## 3. Environment Configuration Status

Audit of environment configuration (values omitted per security policy):

| Setting                       | Status              | Details                                                                                        |
| ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `GITHUB_APP_ID`               | **Present & Valid** | Numeric GitHub App ID (`5366665`)                                                              |
| `GITHUB_APP_PRIVATE_KEY_PATH` | **Present & Valid** | `./secrets/github-app-private-key.pem` exists and parses cleanly via `crypto.createPrivateKey` |
| `GITHUB_APP_SLUG`             | **Present & Valid** | `traceback-code-verification` (matches live GitHub App slug)                                   |
| `GITHUB_WEBHOOK_SECRET`       | **Present & Valid** | Configured for HMAC-SHA256 signature verification                                              |
| `GITHUB_APP_CLIENT_ID`        | **Present**         | Configured for OAuth callbacks                                                                 |
| `GITHUB_APP_CLIENT_SECRET`    | **Present**         | Configured for OAuth token exchange                                                            |

---

## 4. Provider Architecture: Mock vs Live Mode

```
                        [ Repository Sync Trigger ]
                                     |
                                     v
                   [ DelegatingGitHubIngestionAdapter ]
                                     |
           +-------------------------+-------------------------+
           |                                                   |
 (Mock Mode OR installationId=1001)                   (Live Configured)
           |                                                   |
           v                                                   v
[ MockGitHubIngestionAdapter ]                       [ GitHubIngestionAdapter ]
  - Pure fixture data                                  - Authenticated App Client
  - Zero outbound HTTP                                 - Installation Token (5k/hr)
  - Deterministic test data                            - Live api.github.com
```

- **Mock Mode:** `MockGitHubIngestionAdapter` is used.
- **Live Mode:** `GitHubIngestionAdapter` is used with installation-level authentication tokens (`Bearer ghs_...`).
- **Defensive Safeguard:** `GitHubIngestionAdapter` validates `installationId !== 1001`.

---

## 5. Files Changed

1. **`apps/api/src/config/configuration.ts`**:
   - Added multi-path probing for `GITHUB_APP_PRIVATE_KEY_PATH` (probing `process.cwd()`, `../..`, `..`, `../../..`) to resolve correctly whether started from repository root or subproject directory.
2. **`apps/api/src/github/github-app-auth.service.ts`**:
   - Added directory candidate traversal for private key loading.
3. **`apps/api/src/github/github.service.ts`**:
   - Added slug fallback to `traceback-code-verification`.
4. **`apps/api/src/github/delegating-github-ingestion.adapter.ts`** _(New File)_:
   - Dynamic router routing between mock and live adapters based on runtime installation ID and mock status.
5. **`apps/api/src/github/github.module.ts`**:
   - Injected `DelegatingGitHubIngestionAdapter` as the provider for `GITHUB_INGESTION_ADAPTER_TOKEN`.
6. **`apps/api/src/github/github-ingestion.adapter.ts`**:
   - Added validation check rejecting mock installation ID 1001.
7. **`apps/api/src/github/github.controller.ts`**:
   - Rejects linking mock installation 1001 when live mode is configured (`BadRequestException`).
   - Cleans up stale/duplicate installations for the workspace.
8. **`apps/api/src/ingestion/ingestion-sync.service.ts`**:
   - Added `cleanupStaleSyncJobs()` to prevent jobs from getting stuck in `SYNCING`.
   - Injected `IngestionOrchestratorService` for direct synchronous execution when Redis/BullMQ is offline in development.
9. **`apps/web/src/lib/api.ts`**:
   - Changed default API URL to `http://127.0.0.1:3001/api` to prevent IPv6 port collision with unrelated processes.
10. **`apps/web/src/app/repositories/page.tsx`**:
    - Added UI warning when mock installation 1001 is linked in live mode.
    - Added job staleness calculation to unlock buttons from permanent "Syncing...".
    - Added inline error diagnostics and "Retry Sync" action.
11. **`apps/api/src/github/github-integration.spec.ts`**:
    - Added regression tests for mock isolation and live installation token forwarding.
12. **`apps/api/src/ingestion/ingestion-sync.service.spec.ts`**:
    - Added regression tests for stale job cleanup and error recovery.

---

## 6. Test Commands & Actual Results

### 6.1 Unit Tests (`apps/api`)

- **Command:** `npm run test:unit`
- **Result:** **PASSED (100%)**
- **Summary:** 42 test suites passed, 383 tests passed.

### 6.2 Ingestion & GitHub Integration Specs

- **Command:** `npx jest src/github/github-integration.spec.ts`
- **Result:** **16 passed, 0 failed**
- **Command:** `npx jest src/ingestion/ingestion-sync.service.spec.ts`
- **Result:** **15 passed, 0 failed**

### 6.3 TypeScript Typecheck

- **Command:** `npm run typecheck`
- **Result:** **PASSED across all 4 packages** (`@traceback/shared-types`, `@traceback/claim-extractor`, `@traceback/api`, `@traceback/web`).

### 6.4 Nest API Production Build

- **Command:** `npm run build` in `apps/api`
- **Result:** **PASSED** (`dist/` compiled cleanly with source maps).

---

## 7. Final Runtime Verification

### 7.1 Health & Integration Status

```bash
curl.exe http://127.0.0.1:3001/api/health
# {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}
```

```json
// GET /api/workspaces/7d1c1d97-a71f-4651-883a-915c959cbbac/github/status
{
  "isConfigured": true,
  "isMockMode": false,
  "appSlug": "traceback-code-verification",
  "installation": {
    "installationId": 173390166,
    "accountLogin": "Ujjawal-0103"
  }
}
```

### 7.2 Live Repository Synchronization

- **Repository:** `Ujjawal-0103/HackFront` (`19463ffa-b65b-4828-8236-fb6461d429a5`)
- **Action:** Live repository ingestion via GitHub App Installation token.
- **Result:**
  - Status: `COMPLETED`
  - Commits Ingested: **140 commits**
  - Pull Requests Ingested: **9 pull requests**
  - GitHub Quota Remaining: **4,997 / 5,000** authenticated requests.
  - Zero unauthenticated quota warnings.

---

## 8. Environmental Limitations Noted

- During browser automated verification via Playwright, the Playwright manager failed to download driver binaries from `playwright.azureedge.net` (HTTP 404). Per operating instructions, this environmental limitation is noted, and live API / runtime end-to-end verifications were performed directly against the running services.

---

## 9. Final Git Status

- **Branch:** `feature/github-live-integration`
- **Tracked Uncommitted Changes Preserved:**
  - `.env.example` (preserved)
  - `docs/product/PRODUCT_REQUIREMENTS.md` (preserved)
- **No secret files staged or committed:** `.env` and `secrets/*.pem` verified untracked and in `.gitignore`.
