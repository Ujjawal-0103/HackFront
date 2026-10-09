# ADR-008: Background Job Processing

- **Identifier:** ADR-008
- **Title:** Redis-backed BullMQ Queue for Asynchronous Repository Ingestion
- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Ingesting thousands of historical commits, diffs, and pull requests from GitHub takes substantial time and can easily exceed synchronous HTTP request timeouts. Ingestion tasks must be processed asynchronously in manageable batches while respecting GitHub API rate limits.

## Options Considered

1. **Synchronous In-Memory Processing:** Processing ingestion within the HTTP request handler.
2. **PostgreSQL-based Job Table:** Polling a database table for pending sync jobs.
3. **Redis with BullMQ (Selected):** Dedicated distributed task queue with concurrency control, delayed retries, rate limiting, and progress reporting.

## Decision Criteria

- High reliability, rate-limiting support, and retry backoff.
- Native TypeScript integration with NestJS (`@nestjs/bullmq`).
- Real-time job status streaming to the frontend.

## Decision & Consequences

Adopt Redis with BullMQ for ingestion and vectorization pipelines.

- **Consequences:** Sync jobs are partitioned into discrete tasks (`sync-commits`, `sync-pull-requests`, `generate-embeddings`). Ingestion workers can pause automatically when GitHub rate limit headers indicate depletion.

## Trade-offs

- Requires Redis as an additional infrastructure dependency.

## Security Implications

- Job payloads must store repository IDs and session IDs, never raw GitHub credentials or secret tokens.

## Revisit Conditions

- Revisit if serverless deployment topology is mandated where persistent Redis connections are problematic.
