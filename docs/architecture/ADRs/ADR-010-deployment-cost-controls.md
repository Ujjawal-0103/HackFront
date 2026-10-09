# ADR-010: Deployment and Operational Cost Controls

- **Identifier:** ADR-010
- **Title:** Containerized Deployment with Strict Token Budgeting
- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Traceback relies on external LLM APIs (Anthropic Claude, OpenAI, Google Gemini) for claim extraction and grounding assessments, alongside PostgreSQL and Redis infrastructure. Operational costs can escalate rapidly if repository diffs are naively dumped into LLM prompts.

## Options Considered

1. **Unbounded Prompt Context:** Ingest full file histories and large diffs directly into large context windows (100k+ tokens).
2. **Context-Pruned Prompting with Local Embeddings:** Use localized chunking, diff hunk truncation, and prompt token budgeting (max 8k tokens per verification session).
3. **Self-Hosted Open Weights Models:** Run local Llama/Mistral instances on GPU VMs.

## Decision Criteria

- Predictable per-query operational cost (<$0.05 per explanation verification).
- High verification accuracy.
- Deployment simplicity.

## Decision & Consequences

Adopt containerized deployment (Docker Compose for staging/local, Kubernetes/ECS for production) with strict prompt token budgets and context pruning.

- **Budgeting Rules:**
  - Claim extraction prompt capped at 1,500 input tokens.
  - Evidence retrieval context limited to top-5 most relevant diff hunks (each capped at 500 tokens).
  - Overall session budget capped at 8,000 prompt tokens.

## Trade-offs

- Very large diffs must be truncated or summarized by hunk rather than included in full.

## Security Implications

- Container images must run as non-root users with minimal base OS images (e.g., `node:20-alpine`).

## Revisit Conditions

- Revisit if open-source models achieve comparable citation accuracy at lower inference costs in future sprints.
