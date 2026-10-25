# Traceback Local Development Runbook

**Audience:** Developers, DevOps Engineers, and System Operators  
**Updated:** 2026-10-25  

---

## 1. Prerequisites

- **Node.js:** `>= 20.0.0` (Recommended: v20.x or v22.x LTS)
- **npm:** `>= 10.9.0`
- **PostgreSQL:** `16.x` listening on port `5432` (or Docker container)
- **Redis (Optional):** Port `6379` (In local dev, background sync degrades gracefully to in-process execution if Redis is offline)

---

## 2. Environment Configuration

### Root Configuration (`.env`)
Create `.env` at the monorepo root:
```bash
# Database Connection (authoritative)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/traceback_dev?schema=public"

# Session Security
JWT_SECRET="your-secure-random-32-char-jwt-secret-string-here"

# Server Port
PORT=3001

# GitHub App Integration (Optional for mock mode; required for live mode)
GITHUB_APP_ID=5366665
GITHUB_APP_SLUG=traceback-code-verification
GITHUB_APP_PRIVATE_KEY_PATH="./secrets/github-app-private-key.pem"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# MCP Server
TRACEBACK_API_URL=http://127.0.0.1:3001/api
TRACEBACK_WORKSPACE_ID=ws_alpha
```

### Web Client Configuration (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
```

---

## 3. Starting the Application

### Option A: Standard Full-Stack Development
```bash
npm run dev
```
Starts Turborepo watching both `@traceback/api` (port 3001) and `@traceback/web` (port 3000).

### Option B: Isolated Service Development
To run services independently:
```bash
# Terminal 1 - Start API
npm run build --workspace=@traceback/api
node --enable-source-maps apps/api/dist/main

# Terminal 2 - Start Frontend
npm run dev --workspace=@traceback/web
```

---

## 4. Verification & Diagnostics

### Check API Health
```bash
curl.exe http://127.0.0.1:3001/api/health
```
Expected output:
```json
{"status":"ok","service":"@traceback/api","version":"0.1.0"}
```

### Check GitHub App Integration Status
```bash
curl.exe http://127.0.0.1:3001/api/workspaces/ws_alpha/github/status \
  -H "Authorization: Bearer <token>" \
  -H "x-workspace-id: ws_alpha"
```

---

## 5. Port Management & Conflict Resolution

If port `3001` or `3000` is already in use:
```powershell
# Identify process on port 3001
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State

# Inspect process details before stopping
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId, CommandLine

# Gracefully terminate the specific process
Stop-Process -Id <PID>
```
*Note: Never kill unknown processes or unrelated Node.js applications.*

---

## 6. Route Map, Access Control & Route Guard

### 6.1 Route Topology

| Route | Classification | Description | Access Policy |
|---|---|---|---|
| `/login` | Public | User authentication form with password visibility toggle & forgot-password link | Unrestricted |
| `/register` | Public | User onboarding form with live `PasswordStrengthIndicator` | Unrestricted |
| `/forgot-password` | Public | Password recovery request form with generic safe response | Unrestricted |
| `/reset-password` | Public | Password reset execution with token verification & strength indicator | Unrestricted |
| `/` | Protected | Workspace Overview Dashboard | Authenticated Session Required |
| `/verify` | Protected | Core Code Verification Studio & Human Verdict Review | Authenticated Session Required |
| `/history` | Protected | Workspace Verification History & Audit Reports | Authenticated Session Required |
| `/repositories` | Protected | Repository Management & GitHub Integration Status | Authenticated Session Required |
| `/evidence` | Protected | Evidence Search & Historical Provenance Explorer | Authenticated Session Required |

### 6.2 Route Guarding (`RouteGuard.tsx`)
- All application workspace pages (`/`, `/verify`, `/history`, `/repositories`, `/evidence`) are wrapped with `RouteGuard`.
- Unauthenticated requests are intercepted prior to rendering protected workspace data or making authorized API calls, redirecting immediately to `/login?returnTo=<encoded-path>`.
- Open-redirect protection: `returnTo` values are sanitized to ensure only relative application paths (beginning with `/` and not `//` or `/\`) are honored.
- Session restoration displays an honest, non-leaking loading indicator without flashing protected data.

---

## 7. Header Navigation & Profile Controls

### 7.1 Unauthenticated State
- **Left:** Traceback logo and branding link.
- **Center:** Completely clear — zero workspace navigation links (Overview, Verify, History, Repositories, Evidence are hidden).
- **Right:** "Sign In" link, "Register" button, and accessible icon-only `ThemeToggle`.

### 7.2 Authenticated State
- **Left:** Traceback logo and branding link.
- **Center:** Navigation tabs for all authorized workspace sections (Overview, Verify, History & Reports, Repositories, Evidence) with active route indicator.
- **Right:**
  - Workspace selector dropdown showing active workspace and role.
  - User profile dropdown displaying the authenticated user's actual name and email, with actions:
    - **Switch Account:** Navigates to `/login` to authenticate as another identity.
    - **Register New Account:** Navigates to `/register`.
    - **Sign Out:** Revokes session via `POST /api/auth/logout`, cleans client `localStorage`, and redirects to `/login`.
  - Icon-only `ThemeToggle` (☀️ in dark mode to switch to light, 🌙 in light mode to switch to dark).

---

## 8. Password Security, Visibility & Recovery

### 8.1 Password Input & Live Strength
- **Password Visibility:** Handled by `PasswordInput.tsx` with interactive eye/eye-off toggle button (`type="button"`). Passwords default to hidden.
- **Live Strength Indicator:** Handled by `PasswordStrengthIndicator.tsx` measuring length, character varieties, and backend criteria (min 8 chars, letters and numbers), presenting levels: `Too short`, `Weak`, `Fair`, `Strong`.

### 8.2 Password Recovery Flow
1. **Request (`POST /api/auth/forgot-password`):**
   - User inputs email address.
   - Generic response prevents account enumeration: `"If an account exists for that email, password-reset instructions will be sent."`
   - Rate limiting: Max 5 requests per 15 minutes per email address.
   - Generates cryptographically secure 32-byte hex entropy (64 chars).
   - Only the SHA-256 hash of the token is stored in PostgreSQL (`password_reset_tokens` table) with a 1-hour expiration window.
   - Previous unused tokens for the user are invalidated upon generating a new token.
2. **Execution (`POST /api/auth/reset-password`):**
   - Validates token existence, expiration, and ensures single-use (`usedAt == null`).
   - Updates user password hash using `scrypt`.
   - Atomically invalidates the reset token and revokes all active sessions for the user (`user_sessions` purged).
   - User must sign in with their new credentials.

### 8.3 Email Provider Configuration
- Configured via environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- When SMTP is not configured in local development, `EmailService` logs an honest advisory warning without failing requests, permitting automated testing through `getLatestResetTokenForTest()`.

---

## 9. Running Validation Suites

```bash
# Run all unit tests
npm run test:unit

# Run full TypeScript typecheck across monorepo
npm run typecheck

# Run ESLint across monorepo
npm run lint

# Compile API production bundle
npm run build --workspace=@traceback/api
```
