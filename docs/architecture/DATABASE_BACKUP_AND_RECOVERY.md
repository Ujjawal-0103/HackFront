# Traceback Database Backup, Migration & Disaster Recovery Runbook

> **Sprint:** Sprint 9 — Production Readiness & Release Hardening  
> **Status:** Active Operational Runbook  
> **Primary Store:** PostgreSQL 16  
> **Schema Management:** Prisma ORM with committed SQL migrations

---

## 1. Migration Architecture & Governance

Traceback manages database schema state through committed, reproducible SQL migration files in `apps/api/prisma/migrations`:

| Migration Directory                        | Applied Changes                                                         | Indexes Created                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `20261009184048_init`                      | Core identity, workspaces, repositories, verification sessions, claims. | Primary keys, foreign keys, unique workspace/user constraints.     |
| `20261011033600_sprint_3_ingestion`        | Git commits, PRs, issues, diff hunks, sync jobs.                        | `(repositoryId, sha)`, `(repositoryId, number)`, `committedAt`.    |
| `20261013123136_sprint_4_evidence_store`   | Source records, claim assessments, reports, GIN FTS index.              | `source_records_fts_idx` (GIN on title + content), reference keys. |
| `20261015141036_sprint_6_auth_and_history` | Password hashes, user sessions table, reviewer IDs.                     | `user_sessions(tokenHash)`, `user_sessions(userId)`.               |

### 1.1 Development vs. Production Migration Commands

- **Development Only:** `npm run prisma:migrate:dev` — Prompts for migration names, detects schema drift, generates new migration files. **NEVER run in production.**
- **Production Migration:** `npm run prisma:migrate:deploy` — Idempotently applies pending unapplied migrations from committed migration files. Safe for automated CI and deployment pipelines.
- **Status Inspection:** `npm run prisma:migrate:status` — Inspects the database and compares migration state against committed files.

---

## 2. Backup Procedures

### 2.1 Full Logical Backup (`pg_dump`)

Execute daily or prior to any application deployment:

```bash
# Automated logical backup compressed with custom format (directory or tar format)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/traceback_backup_${TIMESTAMP}.dump"

docker exec -t traceback-prod-postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -F c \
  -b \
  -v \
  -f "${BACKUP_FILE}"

# Verify backup file size and integrity
ls -lh "${BACKUP_FILE}"
```

### 2.2 Schema-Only Backup

To capture schema definitions without table data:

```bash
docker exec -t traceback-prod-postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --schema-only \
  -f "/backups/traceback_schema_${TIMESTAMP}.sql"
```

---

## 3. Disaster Recovery & Restoration Procedures

### 3.1 Restoring from a Logical Backup (`pg_restore`)

To restore an existing database or recover to a new database instance:

```bash
# 1. Terminate existing application connections to prevent locks:
docker exec -i traceback-prod-postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();"

# 2. Recreate target database (clean slate):
docker exec -i traceback-prod-postgres psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker exec -i traceback-prod-postgres psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"

# 3. Restore data and indexes from custom dump:
docker exec -i traceback-prod-postgres pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -v \
  --no-owner \
  --no-privileges \
  "${BACKUP_FILE}"

# 4. Re-verify Prisma migration status against restored database:
npm run prisma:migrate:status --workspace=@traceback/api
```

---

## 4. Database Resilience & Connection Handling

1. **Connection Pooling:** Prisma Client manages connection pooling with retry logic.
2. **Graceful Error Handling:**
   - When PostgreSQL is temporarily unreachable, `ReadinessService` returns HTTP 503 (`not_ready`) without leaking database credentials.
   - Graph and evidence queries gracefully fall back to local PostgreSQL full-text search when optional services (Neo4j) are disconnected.
3. **Data Integrity:** Cascading deletes are enforced on repository and session deletions (`onDelete: Cascade`), while historical reviewer records are preserved (`onDelete: SetNull`).
