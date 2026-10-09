# ADR-006: AI Assessment Boundaries and Human Verdict Separation

- **Identifier:** ADR-006
- **Title:** Strict Decoupling of Heuristic AI Assessments from Authoritative Human Verdicts
- **Status:** Accepted
- **Date:** 2026-10-09

## Context

When verifying explanations, an LLM can analyze retrieved diffs and estimate whether evidence supports or refutes a claim. However, AI models can hallucinate inferences or misinterpret subtle developer discussions. Treating an AI assessment as the final truth defeats the purpose of human-supervised verification.

## Options Considered

1. **Fully Autonomous Verification:** LLM assigns final verdict directly; user only views output.
2. **AI-Assisted Human Adjudication (Selected):** LLM extracts claims, retrieves candidate evidence, and computes preliminary confidence score; human reviewer adjudicates the official verdict (`Supported`, `Contradicted`, `Unverified`).
3. **Pure Manual Verification:** System retrieves evidence with zero AI summarization.

## Decision Criteria

- Product principle: _"AI assessments and human verdicts must remain strictly distinguishable."_
- Preventing automation bias and preserving human accountability.

## Decision & Consequences

Decouple AI assessment and human verdict in both data schema and UI presentation.

- **Consequences:** The data model maintains two separate fields on each claim: `aiPreliminaryConfidence` (enum: `HIGH_SUPPORT`, `PARTIAL_SUPPORT`, `SPARSE_EVIDENCE`, `CONTRADICTED`) and `humanVerdict` (enum: `SUPPORTED`, `CONTRADICTED`, `UNVERIFIED`). Exported reports highlight the human reviewer's final verdict as authoritative.

## Trade-offs

- Requires human attention for every verified report, but ensures 100% human accountability for critical decisions.

## Security Implications

- Prevents malicious automated prompt manipulations from hijacking audit reports.

## Revisit Conditions

- Revisit if enterprise users request optional auto-approval policies for high-confidence non-critical documentation checks in future versions.
