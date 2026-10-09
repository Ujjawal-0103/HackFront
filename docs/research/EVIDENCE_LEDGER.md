# Evidence Ledger — Traceback

> **Purpose:** Explicitly distinguish empirically verified evidence from inferences, working hypotheses, and assumptions across the Traceback product lifecycle.  
> **Status:** Sprint 1 Baseline | Last Updated: 2026-10-09

---

## 1. Epistemological Classification Taxonomy

- **[VERIFIED EVIDENCE]:** Corroborated by primary documentation, direct tool observation, official release notes, or tested code executions.
- **[INFERENCE]:** A logical deduction drawn from verified evidence, but not directly tested as an end-to-end outcome.
- **[WORKING HYPOTHESIS]:** A structured proposition formulated for empirical testing during upcoming sprints or human interviews.
- **[UNVERIFIED ASSUMPTION]:** A baseline belief or default expectation that has not yet been subjected to validation.

---

## 2. Categorized Ledger Entries

### Category A: Market & User Behavior

| ID        | Item                                                                                          | Classification            | Source / Basis                                                                                                                                                                        | Validation Mechanism                                                        |
| :-------- | :-------------------------------------------------------------------------------------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- |
| **EV-01** | Engineers frequently ask AI assistants _"Why was this written this way?"_                     | **Working Hypothesis**    | Anecdotal developer reports and community posts.                                                                                                                                      | 8+ developer interviews using `docs/research/INTERVIEW_GUIDE.md` (Pending). |
| **EV-02** | AI code assistants often generate plausible but unverified historical rationale.              | **Verified Evidence**     | Tested with GitHub Copilot and Claude Code: when asked about arbitrary legacy code without context, models generate plausible rationales that cannot be linked to actual git commits. | Controlled evaluation dataset in `docs/evaluation/EVALUATION_PLAN.md`.      |
| **EV-03** | Senior engineers spend >20 minutes manually researching legacy commit history per occurrence. | **Working Hypothesis**    | Estimated baseline based on manual `git log` and PR search latency.                                                                                                                   | Developer interview questions Q3 and Q4.                                    |
| **EV-04** | Engineers will prioritize a dedicated verification interface over in-editor chat.             | **Unverified Assumption** | Proposed UX flow assumes a focused review workspace is valuable for complex rationale.                                                                                                | Prototype usability testing in Sprint 6 & 8.                                |

### Category B: Tool Capabilities & Technical Feasibility

| ID        | Item                                                                                         | Classification                                                        | Source / Basis                                                                                                                                                  | Validation Mechanism                                    |
| :-------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| **EV-05** | GitHub Copilot and Cursor index Git commit SHAs and diffs.                                   | **Verified Evidence**                                                 | Official documentation (github.com, cursor.com) verified on 2026-10-09.                                                                                         | Documentation audit in `COMPETITOR_RESEARCH.md`.        |
| **EV-06** | Claude Code operates via terminal and can run arbitrary git commands.                        | **Verified Evidence**                                                 | Official Anthropic Claude Code documentation verified on 2026-10-09.                                                                                            | Documentation audit in `COMPETITOR_RESEARCH.md`.        |
| **EV-07** | Hybrid retrieval (BM25 + Dense Vectors) outperforms pure vector search on code commit diffs. | **Inference**                                                         | General information retrieval benchmarks on technical code search indicate keyword identifiers (function names, error codes) are lost in pure dense embeddings. | Empirical retrieval benchmark in Sprint 4.              |
| **EV-08** | Graph database (Neo4j) is necessary for V1 retrieval.                                        | **Unverified Assumption** (Provisional: **Rejected for V1 baseline**) | Graph databases introduce heavy operational overhead; relational schema with indexed foreign keys may suffice.                                                  | ADR-005 evaluation in Sprint 4.                         |
| **EV-09** | Malicious commit messages can trigger prompt injection in LLM verifiers.                     | **Verified Evidence**                                                 | Known LLM vulnerability (indirect prompt injection via untrusted ingested text).                                                                                | Adversarial test suite in `THREAT_MODEL.md` (Sprint 8). |

---

## 3. Human Research Pending Confirmation

The following items are strictly **PENDING HUMAN RESEARCH** and MUST NOT be represented as completed:

1. Completion of developer interviews with qualifying participants.
2. Willingness-to-pay or adoption metrics for independent verification tools.
3. Statistical distribution of false AI claims in legacy code refactoring projects.
