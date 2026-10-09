# ADR-003: Evidence Storage and Source Provenance Model

- **Identifier:** ADR-003
- **Title:** PostgreSQL with Prisma ORM for Immutable Provenance Records
- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Traceback's core product principle is: _"Never invent source references, commits, issue identifiers, quotations, or historical decisions."_ Every piece of evidence matched to a claim must possess immutable provenance, including repository identifier, source type (`COMMIT`, `PULL_REQUEST`, `ISSUE`, `DOCUMENTATION`), reference key (SHA, PR #, file line range), author, timestamp, and verified URL.

## Options Considered

1. **Unstructured Document Store (MongoDB):** Flexible schema for storing raw Git JSON dumps.
2. **Relational Database (PostgreSQL) with Prisma ORM:** Strongly typed schema with foreign-key constraints enforcing provenance linking.
3. **Flat File Storage (Git / JSON files):** Storing evidence caches directly in file system (similar to starter prototype).

## Decision Criteria

- Data integrity and referential constraints.
- Type safety in application code via Prisma client.
- Ability to perform structured relational queries alongside vector similarity search via `pgvector`.

## Decision & Consequences

Adopt PostgreSQL managed via Prisma ORM.

- **Consequences:** Entities (`Repository`, `Commit`, `PullRequest`, `Issue`, `EvidenceRecord`, `Claim`, `Verdict`) have strictly enforced relationships. Evidence records cannot exist orphaned without an authenticated repository parent.

## Trade-offs

- Schema migrations must be managed deliberately as data structures evolve.

## Security Implications

- Multi-tenant workspace data must enforce repository-level authorization checks on every query (`WHERE workspaceId = ...`).

## Revisit Conditions

- Revisit if high-volume git diff ingestion creates database write bottlenecks exceeding 10,000 commits/minute.
