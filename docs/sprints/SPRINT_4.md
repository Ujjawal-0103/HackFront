# Sprint 4: Evidence Store and Relationship Graph — Completion Report

> **Sprint:** Sprint 4 — Evidence Store and Relationship Graph  
> **Status:** Completed  
> **Branch:** `sprint/4-evidence-store-graph`  
> **Date:** 2026-10-13

---

## 1. Executive Summary

Sprint 4 delivers a durable, searchable, and explainable **Evidence Store** alongside an optional, modular **Graph Relationship Layer** for Traceback. Historical repository artifacts (commits, diff hunks, pull requests, issues, ADRs, architectural markdown documents) are projected into canonical `SourceRecord` entities in PostgreSQL with dedicated full-text search indexes (`tsvector` + GIN).

Empirical benchmark testing against the 10 core evaluation archetypes demonstrates that the **PostgreSQL Lexical Baseline** achieves **$\text{Recall@}5 \ge 0.85$** and **$\text{MRR} \ge 0.80$** on code rationale queries, with clean abstention on sparse and unevidenced cases. While the modular Neo4j integration enables multi-hop neighbour expansion, the incremental gain does not reach the 15-percentage-point threshold stipulated in **ADR-005**. Consequently, the architectural recommendation is to **DEFER Neo4j as a mandatory dependency for the V1 baseline**, retaining it as an optional, modular enhancement.

---

## 2. Canonical Model & Source Mapping (Stage A & B)

### 2.1 Model-to-Source Mapping

Ingested engineering artifacts are projected into canonical `SourceRecord` entities:

| Ingested Entity            | Source Type             | Canonical Reference Key | External ID              | Content Projection                             | URL Mapping             |
| :------------------------- | :---------------------- | :---------------------- | :----------------------- | :--------------------------------------------- | :---------------------- |
| `GitCommit` + `CommitDiff` | `COMMIT`                | 7-character SHA prefix  | Full 40-char SHA         | Commit message + sanitized unified diff hunks  | GitHub commit permalink |
| `PullRequest` + Comments   | `PULL_REQUEST`          | `#{number}`             | Stringified PR number    | PR title + PR description + reviewer comments  | GitHub PR URL           |
| `Issue` + Comments         | `ISSUE`                 | `#{number}`             | Stringified Issue number | Issue title + Issue body + discussion comments | GitHub Issue URL        |
| Documentation / ADRs       | `DOCUMENTATION` / `ADR` | File path or ADR ID     | File path                | Markdown document text                         | GitHub blob URL         |

### 2.2 Relational Schema Additions

Prisma migration `20261013123136_sprint_4_evidence_store` introduced:

1. **`source_records`**: Durable table with unique constraint `(repositoryId, sourceType, externalId)` and composite index `(repositoryId, recordedAt)`.
2. **`claim_assessments`**: Isolates machine assessments from claims, linking preliminary confidence (`HIGH_SUPPORT`, `PARTIAL_SUPPORT`, `SPARSE_EVIDENCE`, `CONTRADICTED`), rationale, and referenced evidence record IDs.
3. **`human_verdict_records`**: Captures human adjudication (`SUPPORTED`, `CONTRADICTED`, `UNVERIFIED`) independently of machine scores.
4. **`verification_reports`**: Persists structured verification summaries, JSON payloads, and Markdown exports.
5. **GIN Full-Text Index**: `source_records_fts_idx` on `to_tsvector('english', title || ' ' || content)`.

---

## 3. Evidence Search Architecture (Stage C)

The `EvidenceSearchService` implements explainable lexical retrieval:

- **Workspace & Repository Authorization**: Every query checks that the requested repository exists and belongs to the authenticated workspace (`ForbiddenException` on cross-workspace attempts).
- **Stop Words Filtering**: Code-specific and generic stop words (`fix`, `bug`, `issue`, `chore`, `update`, `the`, `and`) are filtered from query terms to prevent spurious hits.
- **Minimum Relevance Threshold**: Candidates below a minimum score threshold ($0.8$) are filtered out, ensuring strict, calibrated abstention on sparse or unevidenced claims.
- **Scoring & Explainability Signals**:
  - Exact reference key match (`#42`, `7f8a9b`): $+5.0$
  - Exact phrase in title: $+3.0$
  - Exact phrase in content: $+2.0$
  - Keyword matches in title: $+1.0$ per term
  - Keyword matches in body: $+0.4$ per term
  - Target file path direct match: $+2.5$
  - Target file path proximity match: $+1.0$

Every returned item includes structured provenance (`url`, `author`, `recordedAt`, `referenceKey`, `id`) and explicit `matchReasons`.

---

## 4. Graph Model & Relationships (Stage D & E)

### 4.1 Graph Schema

Neo4j is configured as an optional service (`bolt://localhost:7687` in `docker-compose.yml`):

- **Node Labels**:
  - `(:Repository { id, fullName })`
  - `(:Commit { id, sha, repositoryId, author, committedAt })`
  - `(:File { repositoryId, path })`
  - `(:PullRequest { id, number, repositoryId, title, state })`
  - `(:Issue { id, number, repositoryId, title, state })`
  - `(:Documentation { id, referenceKey, repositoryId, title })`
- **Relationships**:
  - `(Repository)-[:HAS_COMMIT]->(Commit)`
  - `(Repository)-[:HAS_PULL_REQUEST]->(PullRequest)`
  - `(Repository)-[:HAS_ISSUE]->(Issue)`
  - `(Commit)-[:MODIFIES_FILE { additions, deletions, status }]->(File)`
  - `(PullRequest)-[:CONTAINS_COMMIT]->(Commit)`
  - `(PullRequest)-[:REFERENCES_ISSUE]->(Issue)`
  - `(Repository)-[:HAS_DOCUMENTATION]->(Documentation)`

### 4.2 Idempotency & Rebuild Procedure

`GraphProjectionService` utilizes Cypher `MERGE` statements with `ON CREATE SET` and `ON MATCH SET`. Rebuilding the graph can be triggered at any time:

```bash
# Rebuild graph projection from canonical PostgreSQL records
curl -X POST http://localhost:3001/api/workspaces/:workspaceId/repositories/:repositoryId/evidence/project \
  -H "Authorization: Bearer <token>"
```

---

## 5. Graph-Assisted Hybrid Retrieval (Stage F)

`GraphRetrieverService` blends lexical baseline search with bounded graph expansion:

1. **Seed Discovery**: Executes baseline lexical search in PostgreSQL to identify top 3 seeds.
2. **Bounded Expansion**: If Neo4j is available, expands connected neighbours up to depth 2 (capped at 10 neighbours).
3. **Authoritative Resolution**: Resolves expanded nodes back to canonical PostgreSQL `SourceRecord`s, guaranteeing workspace authorization.
4. **Decay Scoring**: Graph expansion candidates receive decayed scores ($score = baseScore \times \frac{1}{1 + depth} \times 0.70$).
5. **Graceful Fallback**: If Neo4j is offline or errors occur, the system automatically falls back to PostgreSQL lexical baseline and includes an explicit `fallbackNotice`.

---

## 6. ADR-005 Benchmark & Architecture Gate (Stage G)

### 6.1 Benchmark Results Across 10 Archetypes

Evaluated via `apps/api/src/evidence/retrieval-benchmark.spec.ts`:

| Metric                  | Mode A (PostgreSQL Baseline) | Mode B (Baseline + Graph Expansion) | Target (EVALUATION_PLAN.md) |
| :---------------------- | :--------------------------: | :---------------------------------: | :-------------------------: |
| **Recall@5**            |          **0.889**           |              **0.889**              |         $\ge 0.85$          |
| **Precision@5**         |          **0.622**           |              **0.644**              |         $\ge 0.60$          |
| **MRR**                 |          **0.889**           |              **0.889**              |         $\ge 0.80$          |
| **Abstention Accuracy** |          **1.000**           |              **1.000**              |         $\ge 0.95$          |
| **Average Latency**     |          **1.2 ms**          |             **2.8 ms**              |         $< 350$ ms          |

### 6.2 Architecture Gate Determination (ADR-005)

**Gate Criteria from ADR-005:**

> _"Neo4j will only be introduced if Sprint 4 evaluation shows that relational/hybrid retrieval fails on >20% of multi-hop rationale queries and a prototype Neo4j graph improves Recall@5 by at least 15 percentage points."_

**Outcome:**

1. Relational/lexical search succeeds across direct and file-scoped queries ($\text{Recall@}5 = 88.9\%$).
2. Graph expansion discovers connected neighbours for multi-hop cases (`ARCH-08`), but does not provide $\ge 15$ percentage points improvement over the strong baseline.
3. Operating a mandatory Neo4j cluster introduces substantial memory overhead, multi-database synchronization risks, and container complexity without proportional retrieval quality gains.
4. **Decision:** **DEFER Neo4j for V1 Production Baseline.** Retain the modular `Neo4jService` and `GraphProjectionService` as optional extensions.

---

## 7. Frontend Evidence Explorer Interface

Route: `/evidence`

- **Repository Selection:** Dropdown populated from registered workspace repositories with record counts.
- **Query & Filters:**
  - Natural language phrase / architectural term input with quick-query pills.
  - Source type filters (`COMMIT`, `PULL_REQUEST`, `ISSUE`, `DOCUMENTATION`, `ADR`).
  - File path proximity filter (`filePath`) matching stored changed files.
  - Recency range filters (`since`, `until`).
  - Graph expansion toggle reflecting ADR-005 deferred baseline status.
- **Evidence Result Cards:**
  - Header: source type badge, reference key, author, date, and external GitHub artifact link.
  - Monospace code excerpt / snippet container.
  - Provenance & relevance score badge with retrieval method indicator (`lexical` vs `graph_expansion`).
  - Human-readable match explanation badges (e.g., `✓ Exact match on reference key`, `✓ Title matches keyword`).
- **Inspect Record Drawer:**
  - Modal viewing full stored content, file path, line numbers, and metadata JSON.
- **Honest Retrieval States:**
  - Initial instruction prompt with guided sample queries.
  - Clean loading skeleton.
  - Insufficient evidence banner explicitly noting that absence of evidence does not prove a claim is false.

---

## 8. Validation Commands & Monorepo Test Baseline

```powershell
npm run prisma:validate
npm run prisma:migrate:status
npm run format:check
npm run lint
.\node_modules\.bin\turbo.cmd run typecheck --force
.\node_modules\.bin\turbo.cmd run build --force
.\node_modules\.bin\turbo.cmd run test --force
```

- **API Test Suite:** 29 passed suites, 267/267 tests passed.
- **Web Test Suite:** 4 passed suites, 17/17 tests passed.
- **Total Test Baseline:** 284/284 tests passed across the workspace (up from the 224 baseline).
- **TypeScript Typecheck:** 4/4 tasks passed without errors.
- **Production Build:** 4/4 tasks passed, generating all 6 static/dynamic routes.
