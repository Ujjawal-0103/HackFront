# Traceback Secrets Management & Incident Response Procedure

> **Sprint:** Sprint 9 — Production Readiness & Release Hardening  
> **Status:** Active Operational Security Document

---

## 1. Principles of Secrets Management

1. **Zero Hardcoded Secrets:** No API keys, database passwords, session tokens, or private keys may ever be committed to the Git repository.
2. **Environment Isolation:** Secrets used in production must be distinct from staging, test, and development environments.
3. **No Secret Printing:** Application loggers, error filters, and configuration validators must sanitize and redact all tokens, credentials, and connection strings before emitting output.
4. **Automated Secret Scanning:** Pre-commit hooks and CI quality gates scan staged diffs for accidental credential leakage.

---

## 2. Secrets Inventory & Storage

| Secret Type                | Purpose                                  | Format                                    | Recommended Production Storage                                                                       |
| -------------------------- | ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **PostgreSQL Credentials** | Database access                          | `DATABASE_URL` with secure credentials    | AWS Secrets Manager, HashiCorp Vault, Kubernetes Secret                                              |
| **Redis Password**         | BullMQ queue authentication              | Alphanumeric string                       | Secret Manager / Container Environment                                                               |
| **GitHub App Private Key** | RS256 JWT generation for API access      | PEM RSA Private Key (2048-bit+)           | Base64-encoded environment secret or mounted read-only volume                                        |
| **GitHub Webhook Secret**  | HMAC-SHA256 signature verification       | 32+ character high-entropy hex string     | Secret Manager / Container Environment                                                               |
| **User Session Tokens**    | Authenticated user session bearer tokens | `tb_live_<userId>_<entropy>`              | Stored in PostgreSQL with SHA-256 hash (`tokenHash`); raw token returned only once on login/register |
| **MCP Server Token**       | API access for Model Context Protocol    | Bearer token set as `TRACEBACK_API_TOKEN` | Injected into MCP host launcher or server environment                                                |

---

## 3. Incident Response: Exposed Credentials

If an engineer suspects or discovers that a secret has been exposed (e.g. committed to Git, posted to an issue, leaked in build logs):

### Step 1: Immediate Revocation (Containment)

- **GitHub App Key / Secret:** Revoke the private key immediately via the GitHub App settings page (`https://github.com/settings/apps/<app-name>`). Generate a new private key and update the secret store.
- **Database Password:** Rotate the PostgreSQL user password immediately in the database:
  ```sql
  ALTER USER traceback_app WITH PASSWORD 'new_high_entropy_password';
  ```
  Restart containers with the updated `DATABASE_URL`.
- **User Session Token:** Revoke the session immediately via the API `POST /api/auth/logout` or delete directly from the database:
  ```sql
  DELETE FROM user_sessions WHERE token_hash = sha256('leaked_token');
  ```
- **Webhook Secret:** Update the secret on GitHub and in the server configuration simultaneously.

### Step 2: Investigation & Audit

- Review access logs during the exposure window for unauthorized IP addresses or unexpected requests.
- Inspect the commit history. If committed to a branch, do not merely overwrite with another commit. Note: do not rewrite published repository history without team consensus.

### Step 3: Post-Mortem & Preventative Action

- Document the incident timeline, affected systems, and remediation in an internal security advisory.
- Verify pre-commit hooks and scanning rules.
