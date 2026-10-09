# ADR-005: Neo4j and Knowledge Graph Justification Criteria

- **Identifier:** ADR-005
- **Title:** Conditional Deferral of Neo4j Graph Database for V1 Baseline
- **Status:** Deferred / Conditional
- **Date:** 2026-10-09

## Context
Code repositories possess inherent graph topology (e.g., Commit $\rightarrow$ modifies $\rightarrow$ File; PR $\rightarrow$ closes $\rightarrow$ Issue; Commit $\rightarrow$ child of $\rightarrow$ Parent Commit). Introducing a graph database (Neo4j) is often proposed for architectural provenance. However, operating a dedicated Neo4j instance adds operational complexity, memory requirements, and synchronization overhead.

## Options Considered
1. **Mandatory Neo4j Graph Database in V1:** Model all entities and edges in Neo4j from day one.
2. **Relational Graph Modeling in PostgreSQL:** Use recursive Common Table Expressions (CTEs) and indexed foreign keys for graph traversal (parent commits, PR-issue links).
3. **Defer Neo4j Pending Empirical Benchmark:** Build V1 baseline using PostgreSQL (ADR-003, ADR-004); benchmark retrieval recall in Sprint 4 before deciding on Neo4j.

## Decision Criteria
- Product principle: *"A graph database added solely for novelty is prohibited."*
- Empirical verification of whether multi-hop graph queries (e.g. Commit $\rightarrow$ PR $\rightarrow$ Issue $\rightarrow$ ADR) measurably improve retrieval over hybrid search.

## Decision & Consequences
Defer Neo4j deployment for the V1 baseline. Implement entity relationships in PostgreSQL.
- **Criteria for Re-evaluation (Sprint 4 Gate):** Neo4j will only be introduced if Sprint 4 evaluation shows that relational/hybrid retrieval fails on >20% of multi-hop rationale queries and a prototype Neo4j graph improves Recall@5 by at least 15 percentage points.

## Trade-offs
- Deep graph traversals (>3 degrees of separation) are slower in SQL than native graph stores, but such deep queries are rare in code rationale investigations.

## Security Implications
- Avoids expanding the attack surface and credential management overhead associated with a secondary database cluster.

## Revisit Conditions
- Formal review during Sprint 4 (Evidence Store and Retrieval).
