# GitHub App Integration Diagnostics & Troubleshooting

This document provides technical diagnosis, root cause analysis, and resolution procedures for GitHub App integration issues in Traceback.

---

## 1. Diagnostic Matrix: `isConfigured` and `isMockMode`

| `isConfigured` | `isMockMode` | Meaning | UI Presentation | Required Action |
|---|---|---|---|---|
| `false` | `true` | **Development Mock Sandbox Mode**: Live credentials (`GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY`) are missing or unparseable. `NODE_ENV !== "production"`. | Amber badge: `Development Mock Sandbox Active (Mock Installation #1001 - Fixtures Only)` | Supply valid `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` in `apps/api/.env` or root `.env`. |
| `false` | `false` | **Production Unconfigured**: Credentials missing while `NODE_ENV === "production"`. Mock mode strictly rejected. | Red banner / `403 Forbidden` | Set valid credentials before starting in production. |
| `true` | `false` | **Live Mode Configured**: Live App ID and cryptographically verified private key loaded. | Green badge: `Live GitHub App Connected: <account> (#<id>)` (or uninstalled message) | Complete GitHub App installation callback or select repositories. |

---

## 2. Root Cause Analysis: Rate Limit Warning (51 Remaining < 100)

### Observation
Ingestion previously logged:
```
GitHub rate limit low quota safety threshold reached: 51 remaining (< 100)
```

### Technical Root Cause
1. In `apps/api/src/github/github.module.ts`, `GITHUB_INGESTION_ADAPTER_TOKEN` statically resolved to `GitHubIngestionAdapter` even when mock sandbox mode was active.
2. In `apps/api/src/ingestion/ingestion-orchestrator.service.ts`, entity ingestion calls to `this.githubAdapter` (`getRepository`, `getCommits`, `getCommit`, `getPullRequests`, `getIssues`) omitted `{ installationId }`.
3. In `GitHubIngestionAdapter.executeRequest`, omitting `options.token` and `options.installationId` caused requests to be sent to `https://api.github.com` without an Authorization header.
4. GitHub enforces a strict 60 requests/hour IP limit on unauthenticated requests. When 9 requests were consumed, 51 remained.
5. The proactive rate limit guard (`RATE_LIMIT_LOW_QUOTA_THRESHOLD = 100`) detected `51 < 100` and threw a `GitHubRateLimitError`.

### Resolution Applied
1. In `github.module.ts`, dynamic factory provider switches to `MockGitHubIngestionAdapter` in development mock mode and `GitHubIngestionAdapter` in live mode.
2. In `ingestion-orchestrator.service.ts`, `{ installationId: payload.installationId }` is passed down to all adapter calls, ensuring authenticated requests with the installation access token (5,000 req/hr quota).

---

## 3. Analysis: Stored Installation ID 1001

### Observation
Workspaces previously created in development had `installationId: 1001` with `accountLogin: "Ujjawal-0103"` persisted in the `github_installations` database table.

### Technical Analysis
- Installation ID 1001 is the deterministic mock installation ID defined in `MockGitHubClient`.
- In mock mode, this installation serves fixture repositories (`Ujjawal-0103/HackFront` and `acme-corp/payment-service`).
- In the frontend, the previous status bar checked `if (gitHubStatus?.installation)` before `isMockMode`, falsely presenting the mock installation as a green live connection.

### Resolution Applied
- Frontend updated to prioritize `isMockMode`: when in mock mode with installation 1001, it explicitly displays:
  `🟡 Development Mock Sandbox Active (Mock Installation #1001 - Fixtures Only)`.
- When live credentials are provided and `isLiveConfigured === true`, if the workspace still has installation 1001, the UI and API allow disconnecting via `DELETE /api/workspaces/:workspaceId/github/installation` and connecting the real GitHub App installation.

---

## 4. Environment Configuration Audit Checklist

Check presence and format of required variables without printing secret values:

| Variable | Expected Format | Validation Logic |
|---|---|---|
| `GITHUB_APP_ID` | Numeric string (e.g. `123456`) | `Boolean(val && String(val).trim())` |
| `GITHUB_APP_PRIVATE_KEY` | PEM format or Base64-encoded PEM | `crypto.createPrivateKey(normalizePrivateKey(val))` |
| `GITHUB_APP_PRIVATE_KEY_PATH` | File path to `.pem` key file | `fs.existsSync(resolvedPath)` |
| `GITHUB_APP_SLUG` | Alphanumeric slug (e.g. `traceback-verifier`) | Used in redirect URL |
| `GITHUB_WEBHOOK_SECRET` | 32+ char secret string | HMAC-SHA256 signature verification |

---

## 5. Safe Verification Procedures

### Verify API Health
```bash
curl -i http://localhost:3001/api/health
```
Expected: `HTTP 200 OK`, `status: "ok"`.

### Verify Integration Status
```bash
curl -i http://localhost:3001/api/workspaces/<workspace-id>/github/status \
  -H "Authorization: Bearer <session-token>" \
  -H "x-workspace-id: <workspace-id>"
```
Expected in mock mode:
```json
{
  "isConfigured": false,
  "isMockMode": true,
  "installation": { "installationId": 1001, "accountLogin": "Ujjawal-0103" }
}
```
Expected in live mode:
```json
{
  "isConfigured": true,
  "isMockMode": false,
  "appSlug": "<your-app-slug>",
  "installation": null,
  "installUrl": "https://github.com/apps/<slug>/installations/new?state=..."
}
```
