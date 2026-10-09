# ADR-004: Search and Retrieval Baseline

- **Identifier:** ADR-004
- **Title:** Hybrid Search Baseline (BM25 Full-Text + pgvector Dense Embeddings)
- **Status:** Accepted
- **Date:** 2026-10-09

## Context
Traceback must retrieve relevant historical commits, diffs, PR discussions, and documentation given an AI-generated claim. Code repositories contain distinct information types: precise technical identifiers (e.g., function names `validateJwtToken`, error codes `ECONNRESET`, commit SHAs) and conceptual rationale (e.g., *"mitigating memory leaks in WebSocket reconnections"*).

## Options Considered
1. **Pure Lexical Search (PostgreSQL Full-Text / BM25):** Fast, exact match for symbol names, but fails on conceptual paraphrasing.
2. **Pure Dense Vector Search (pgvector / OpenAI embeddings):** Good at semantic similarity, but frequently misses exact identifier names, PR numbers, or specific function signatures.
3. **Hybrid Search (BM25 + pgvector with Reciprocal Rank Fusion - RRF):** Combines lexical score and dense vector score to rank top candidate evidence.

## Decision Criteria
- Recall@5 and Mean Reciprocal Rank (MRR) on technical code rationale queries.
- Operational simplicity (single PostgreSQL database hosting both relational tables and vector embeddings).

## Decision & Consequences
Adopt Hybrid Search combining PostgreSQL full-text search (tsvector) and dense semantic vector embeddings via `pgvector`, fused using Reciprocal Rank Fusion (RRF).
- **Consequences:** Eliminates need for a separate external vector database in V1. Solves both exact symbol matching and semantic rationale search.

## Trade-offs
- Requires generating embeddings during repository ingestion; requires tuning RRF weighting parameters ($k=60$).

## Security Implications
- Text chunks sent to embedding APIs must exclude detected secrets and private API keys.

## Revisit Conditions
- Revisit if vector search latency exceeds 500ms on repositories with >100,000 commits.
