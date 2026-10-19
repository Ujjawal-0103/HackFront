# Traceback GitHub App Integration & Setup Guide

This guide details the complete configuration, installation, authentication, and diagnostic procedures for connecting GitHub repositories to a Traceback workspace using GitHub Apps.

---

## 1. Overview & Architecture

Traceback connects to GitHub via a dedicated GitHub App rather than legacy OAuth Apps or personal access tokens (PATs). This ensures:

- Fine-grained, repository-scoped access.
- Organization and personal account compatibility.
- Workspace-isolated repository management: each workspace associates with its authorized GitHub App installation.
- Tamper-resistant HMAC-SHA256 connection state tokens preventing cross-workspace installation hijacking.
- Clean separation between development/sandbox mock modes and live production configurations.

---

## 2. Environment Variables

The backend API (`apps/api`) and web frontend (`apps/web`) require the following environment variables:

### Backend Configuration (`apps/api/.env`)

| Variable Name                 | Required    | Description                                                             | Example / Format                       |
| ----------------------------- | ----------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `GITHUB_APP_ID`               | Yes (Live)  | GitHub App numeric ID (from App settings page)                          | `123456`                               |
| `GITHUB_APP_PRIVATE_KEY`      | Yes (Live*) | RSA Private Key PEM string or Base64 (see Section 4)                    | `-----BEGIN RSA PRIVATE KEY-----...`   |
| `GITHUB_APP_PRIVATE_KEY_PATH` | Alternative | Path to downloaded `.pem` key file (used if key string is omitted)      | `./secrets/github-app-private-key.pem` |
| `GITHUB_APP_SLUG`             | Optional    | GitHub App slug (URL identifier) for install redirects                  | `traceback-verifier`                   |
| `GITHUB_WEBHOOK_SECRET`       | Recommended | Secret token configured for webhook delivery validation                 | Random 32+ character string            |
| `JWT_SECRET`                  | Required    | Application secret used for signing session and connection state tokens | `min-32-chars-hex-or-base64`           |
| `NODE_ENV`                    | Optional    | Set to `production` in live environments                                | `production` / `development` / `test`  |

> **Production Safety Rule**: When `NODE_ENV=production`, Traceback **strictly disables mock mode**. Missing live credentials will reject requests with `403 Forbidden` (`Live GitHub App integration is not configured`), preventing accidental exposure of mock sandbox data in production environments.

### Frontend Configuration (`apps/web/.env.local`)

| Variable Name         | Required | Description                       | Default                 |
| --------------------- | -------- | --------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Required | Base URL of Traceback API backend | `http://localhost:3001` |

---

## 3. Creating & Configuring the GitHub App

1. Navigate to your GitHub account or organization settings:
   - **Personal**: `GitHub Settings -> Developer settings -> GitHub Apps -> New GitHub App`
   - **Organization**: `Organization Settings -> Developer settings -> GitHub Apps -> New GitHub App`
2. **Basic Information**:
   - **GitHub App name**: `Traceback Code Verifier` (or your preferred unique name).
   - **Homepage URL**: `https://your-traceback-domain.com` (or `http://localhost:3000` for local dev).
3. **Identifying and Authorizing Users**:
   - **Callback URL**: `https://your-traceback-domain.com/repositories` (or `http://localhost:3000/repositories`).
   - **Request user authorization (OAuth) during installation**: Checked (optional if using installation token flow).
4. **Post Installation**:
   - **Setup URL (redirect URL)**: `https://your-traceback-domain.com/repositories` (or `http://localhost:3000/repositories`).
   - When a user installs the GitHub App, GitHub will redirect to this URL with query parameters: `?installation_id=...&setup_action=install`.
5. **Webhook**:
   - **Active**: Checked (if webhook event ingestion is configured).
   - **Webhook URL**: `https://your-api-domain.com/api/github/webhook`.
   - **Webhook secret**: Must match `GITHUB_WEBHOOK_SECRET`.
6. **Repository Permissions**:
   Configure the following minimum read permissions:
   - **Repository contents**: `Read-only` (to inspect source code, file trees, and AST patterns).
   - **Commit statuses**: `Read-only` (for verification CI/CD status correlation).
   - **Issues**: `Read-only` (for requirement and issue evidence provenance).
   - **Pull requests**: `Read-only` (for PR discussion and diff evidence verification).
   - **Metadata**: `Read-only` (mandatory, enabled by default).
7. **Subscribe to Events**:
   - `Push`
   - `Pull request`
   - `Issues`
   - `Installation` and `Installation target` (tracks app installations and uninstalls).
8. **Where can this GitHub App be installed?**:
   - **Only on this account** (for private internal deployments), OR
   - **Any account** (for multi-tenant SaaS deployments).

---

## 4. Private Key Formatting Requirements

After registering the app, scroll to the bottom of the App settings page and click **Generate a private key**. A `.pem` file will download.

To configure `GITHUB_APP_PRIVATE_KEY` in environment variables:

1. **Single-line with literal `\n`**:
   Replace all real newlines with `\n`:
   ```bash
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...truncated...\n-----END RSA PRIVATE KEY-----"
   ```
2. **Base64-encoded**:
   Encode the entire PEM file into a single Base64 string:
   ```bash
   # On macOS/Linux:
   base64 -i private-key.pem | tr -d '\n'
   # On Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("private-key.pem"))
   ```
   Provide the base64 string directly in `GITHUB_APP_PRIVATE_KEY`. Traceback automatically detects and decodes Base64-encoded PEM keys.

---

## 5. Installing and Connecting to a Traceback Workspace

### Step-by-Step Connection Lifecycle

1. **Initiate Connection in Traceback**:
   - Log in to Traceback and ensure you are an active member with `OWNER` or `ADMIN` role in the target workspace.
   - Navigate to `/repositories`.
   - Click **Connect Repository**.
2. **Install Flow**:
   - If no installation exists for the workspace, the modal displays the GitHub App status.
   - Click **Install GitHub App**. Traceback generates a cryptographically signed state token (`HMAC-SHA256`) binding the workspace ID and user ID with a 15-minute expiration.
   - Traceback redirects the user to `https://github.com/apps/<app-slug>/installations/new?state=<token>`.
3. **Authorize in GitHub**:
   - Select the target GitHub personal account or organization.
   - Choose repository access: **All repositories** or **Only select repositories**.
   - Click **Install & Authorize**.
4. **Callback & Association**:
   - GitHub redirects back to `/repositories?installation_id=...&state=...`.
   - The frontend forwards the `installationId` and signed `state` token to `POST /api/workspaces/:workspaceId/github/installation`.
   - The backend validates:
     - User session and workspace membership (`OWNER` or `ADMIN`).
     - State token HMAC signature, workspace binding, and timestamp expiration.
     - Fetches and verifies installation details against GitHub API using JWT App credentials.
     - Persists or updates the `GitHubInstallation` record associated with the workspace.
5. **Repository Discovery & Ingestion**:
   - Authorized repositories are queried via `GET /api/workspaces/:workspaceId/github/repositories`.
   - The user selects repositories to import and ingest into the Traceback evidence index.

### Disconnecting an Installation

- Workspace Owners or Admins can click **Disconnect GitHub App** in `/repositories`.
- Invokes `DELETE /api/workspaces/:workspaceId/github/installation`.
- Removes the association in the workspace, preventing repository discovery without removing previously ingested historical evidence.

---

## 6. Diagnosing Authentication & Repository List Errors

Traceback provides explicit frontend states and backend diagnostic error codes:

| Error State / Status                    | Root Cause                                                         | Resolution                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Authentication Required (401)**       | User session is missing or expired.                                | Click "Sign In to Continue". Preserves `returnTo=/repositories`.                              |
| **No Active Workspace**                 | No workspace selected in current session.                          | Select or create a workspace from the workspace switcher.                                     |
| **GitHub App Not Configured (403)**     | `GITHUB_APP_ID` or `GITHUB_APP_PRIVATE_KEY` missing in production. | Provide valid GitHub App credentials in `apps/api/.env`.                                      |
| **Installation Not Found (404)**        | Workspace has not yet connected a GitHub App installation.         | Click "Install GitHub App" to begin authorization.                                            |
| **No Authorized Repositories**          | GitHub App is installed, but 0 repositories were granted.          | Configure GitHub App installation settings in GitHub to grant access to desired repositories. |
| **State Token Invalid / Expired (400)** | Callback state signature mismatch or older than 15 minutes.        | Initiate the connection flow again from the Traceback UI.                                     |
| **Cross-Workspace Access Denied (403)** | Non-owner/admin user attempted to connect/disconnect installation. | Only workspace `OWNER` or `ADMIN` roles may modify installations.                             |

---

## 7. Mock / Sandbox Mode vs. Live Mode

Traceback includes a built-in development sandbox (`MockGitHubClient`) to facilitate offline local development and automated testing:

- **Enabled When**: In non-production environments (`NODE_ENV !== "production"`) when `GITHUB_APP_ID` or `GITHUB_APP_PRIVATE_KEY` is omitted.
- **Fixture Repositories**: Returns deterministic fixtures (`octocat/Hello-World`, `traceback/core-engine`, `acme/infrastructure`) under installation ID `1001`.
- **UI Visibility**: The repositories dashboard displays a prominent **"MOCK SANDBOX ACTIVE"** badge to ensure developers are always aware mock data is in use.
- **Production Guard**: If `NODE_ENV === "production"`, mock fallback is forbidden. The API returns HTTP 403 with `"Live GitHub App integration is not configured"`.

---

## 8. Verification & Validation Summary

- **Validated with Automated Offline Mocks & Tests**:
  - HMAC-SHA256 connection state token signing, tampering rejection, and expiration.
  - Workspace `GitHubInstallation` persistence, upsert, and deletion lifecycle.
  - Multi-tenant cross-workspace access isolation.
  - Role-based authorization (`OWNER`/`ADMIN` vs `MEMBER`).
  - Frontend error presentation, sign-in redirects, and empty repository handling.
  - Production mock-mode disabling.
- **Requires Live GitHub App Credentials**:
  - Direct live communication with `https://api.github.com/app/installations/:id/access_tokens`.
  - Ingestion of live proprietary Git trees and pull request discussions.
  - Live GitHub webhook delivery signature validation.
