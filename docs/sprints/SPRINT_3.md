# Sprint 3 — GitHub Ingestion, Synchronization, and Repository Interface

## 1. Overview & Objectives

Sprint 3 establishes the ingestion and synchronization backbone for Traceback. It enables connecting authorized GitHub repositories, pulling historical commits, diffs, pull requests, issues, and comments into PostgreSQL, managing background synchronization via BullMQ/Redis queues, handling GitHub webhooks, and providing a user-facing dashboard for monitoring sync health and inspecting imported activity.

## 2. Implemented Architecture & Data Model

### Authoritative Ingestion Pipeline

1. **GitHub API Adapter & Authentication (`GitHubService`, `GitHubAppAuthService`, `GitHubAppClient`):**
   - Implements RS256 JWT generation for GitHub App authentication.
   - Exchanges installation tokens with rate limit detection and exponential backoff retry.
   - Includes `MockGitHubClient` sandbox for offline development and CI test verification.
2. **Ingestion Queue & Orchestrator (`IngestionQueueModule`, `IngestionOrchestratorService`, `IngestionProcessor`):**
   - BullMQ queue `ingestion-sync` backed by Redis 7.
   - Handles `INITIAL_IMPORT`, `INCREMENTAL_SYNC`, and `MANUAL` resynchronizations.
   - Atomic job state tracking in PostgreSQL `repository_sync_jobs` table (`PENDING`, `SYNCING`, `COMPLETED`, `FAILED`).
3. **Repository Management (`RepositoriesService`, `RepositoriesController`):**
   - Scoped to multi-tenant workspace context (`/workspaces/:workspaceId/repositories`).
   - `POST /workspaces/:workspaceId/repositories` imports and verifies GitHub repository authorization.
   - `GET /workspaces/:workspaceId/repositories` retrieves registered repositories with summary counts and latest sync job.
   - `GET /workspaces/:workspaceId/repositories/:repositoryId/activity` previews recent commits, pull requests, and issues.
4. **Webhook Processor (`GitHubWebhookService`, `GitHubWebhookController`):**
   - HMAC SHA-256 signature verification (`X-Hub-Signature-256`).
   - Idempotent event processing with delivery ID deduplication.
   - Handles `push`, `pull_request`, `issues`, and installation permission revocation events.

## 3. Frontend Repository & Ingestion Interface

Route: `/repositories`

- **Repository Overview:**
  - Real authorized repositories retrieved from NestJS API (`GET /workspaces/:workspaceId/repositories`).
  - Privacy badge, default branch, last indexed timestamp, and canonical repository ID.
  - Live status indicator: `Synced` (green), `Syncing...` (blue), `Failed` (red), `Pending Initial Sync` (yellow).
- **Synchronization Controls:**
  - "Trigger Sync" action enqueues BullMQ resynchronization.
  - "Project Evidence" action runs canonical `SourceRecord` projection for Sprint 4 evidence retrieval.
  - "Explore Evidence" links directly to `/evidence?repo=<id>`.
  - Detailed error banner displays failure explanations (rate limits vs provider network errors).
- **Activity & Details Preview:**
  - Expandable drawer per repository.
  - Job execution history with trigger type, start/end timestamps, and imported item counts.
  - Tabbed activity preview: recent commits with SHAs and GitHub links, recent PRs with merge status, and recent issues.
- **Connect Repository Modal:**
  - Lists authorized repositories from GitHub App installation (`GET /workspaces/:workspaceId/github/repositories`).
  - Single-click import into active workspace.

## 4. Verification & Test Coverage

- **API Ingestion & Repository Suites (29 suites, 267 tests):**
  - `repositories.service.spec.ts` (5 tests)
  - `repositories.controller.spec.ts` (4 tests)
  - `ingestion-sync.service.spec.ts` (9 tests)
  - `ingestion-sync.controller.spec.ts` (3 tests)
  - `ingestion-orchestrator.service.spec.ts` (13 tests)
  - `ingestion-persistence.service.spec.ts` (14 tests)
  - `github-webhook.service.spec.ts` (9 tests)
  - `github-app.client.spec.ts` (8 tests)
  - `github-ingestion.adapter.spec.ts` (12 tests)
- **Web Frontend Suites (4 suites, 17 tests):**
  - `repositories/page.spec.tsx` (5 tests): verifies loading, empty state, repo listing, manual sync trigger, connect modal, and activity inspection.

## 5. Known Limitations & Manual Prerequisites for Production

1. **Live GitHub App Credentials:**
   - In development/CI, `GitHubService` operates in a local sandbox mode using `MockGitHubClient` (`Ujjawal-0103/HackFront` and `acme-corp/payment-service`).
   - For live GitHub App synchronization, set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` in `.env`.
