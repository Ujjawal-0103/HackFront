# Traceback Incident Recovery & Troubleshooting Guide

**Audience:** System Administrators, On-Call Engineers, and Maintainers  
**Date:** 2026-10-25  

---

## 1. Incident: Repository Stuck in `SYNCING` State

### Symptom
The UI displays an infinite spinning indicator on a repository, and the Sync button is disabled.

### Root Cause
A background worker terminated unexpectedly, encountered a transient rate limit, or Redis lost connection during execution, leaving the job status in PostgreSQL as `SYNCING`.

### Resolution Procedure
1. Trigger the automated stale job reaper by initiating a new status request:
   ```bash
   curl.exe -X GET http://127.0.0.1:3001/api/workspaces/<workspaceId>/repositories/<repositoryId>/sync/status \
     -H "Authorization: Bearer <token>" \
     -H "x-workspace-id: <workspaceId>"
   ```
   Jobs older than 15 minutes are automatically transitioned to `FAILED`.
2. Alternatively, in the Web UI, if a job has been running for > 15 minutes, the interface unlocks the **Retry Sync** button. Clicking this triggers a new idempotent synchronization job.
3. If manual database intervention is required in an emergency:
   ```sql
   UPDATE ingestion_sync_jobs 
   SET status = 'FAILED', 
       error_message = 'Manual incident recovery: terminated abandoned sync job'
   WHERE status = 'SYNCING' 
     AND started_at < NOW() - INTERVAL '15 minutes';
   ```

---

## 2. Incident: GitHub API Rate Limit Warnings (`403 / 429`)

### Symptom
Logs indicate `GitHub rate limit low quota safety threshold reached: X remaining (< 100)`.

### Root Cause
- If in mock sandbox mode: Verify that `DelegatingGitHubIngestionAdapter` is active. Fixtures must route to `MockGitHubIngestionAdapter` and must never make calls to `api.github.com`.
- If in live mode: Verify that the request is authenticated with an installation access token (`ghs_...`). Unauthenticated requests share an IP limit of 60 req/hr. Authenticated installation tokens receive 5,000 req/hr.

### Resolution Procedure
1. Verify the GitHub App status for the workspace:
   ```bash
   curl.exe http://127.0.0.1:3001/api/workspaces/<workspaceId>/github/status \
     -H "Authorization: Bearer <token>" \
     -H "x-workspace-id: <workspaceId>"
   ```
2. Inspect the returned `isConfigured` and `isMockMode` fields.
3. If live credentials are valid, check remaining quota on GitHub:
   Installation tokens provide 5,000 requests per hour. The proactive safety threshold pauses ingestion when < 100 requests remain until the reset window expires.

---

## 3. Incident: Redis Offline / Background Queue Degraded

### Symptom
API logs warning:
`[IngestionSyncService] Failed to enqueue sync job ... to Redis queue: Connection is closed.`

### Resolution Procedure
- In local development: Traceback automatically falls back to direct execution via `IngestionOrchestratorService`. Ingestion continues without Redis.
- In production:
  1. Check Redis container/service status:
     ```bash
     docker ps -f name=redis
     ```
  2. Inspect Redis logs:
     ```bash
     docker logs traceback-redis --tail 50
     ```
  3. Restart the Redis container:
     ```bash
     docker restart traceback-redis
     ```

---

## 4. Incident: Corrupted Webpack Chunk Cache in Frontend

### Symptom
Next.js returns HTTP 500 with `Cannot find module './193.js'` or similar chunk errors.

### Resolution Procedure
1. Stop the Next.js process.
2. Remove the cached `.next` directory:
   ```powershell
   Remove-Item -Recurse -Force apps/web/.next
   ```
3. Restart Next.js dev server:
   ```bash
   npm run dev --workspace=@traceback/web
   ```
