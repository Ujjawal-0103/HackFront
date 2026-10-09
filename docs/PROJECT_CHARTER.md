# Project Charter — Traceback

## 1. Project Overview & Identity
- **Project Name:** Traceback
- **Innovation Theme:** AI and Developer Tools
- **Official Problem Statement:** T1.1 — Why The Code Is Like This
- **Project Status:** Sprint 1 — Product Foundation

### Team Structure & Provisional Workstreams
| Team Member | Provisional Role | Core Workstream Responsibility | Confirmation Status |
| :--- | :--- | :--- | :--- |
| **Ujjawal Agrawal** | Team Lead | Product decisions, architecture coordination, integration, sprint approval | Provisional |
| **Tanishka** | Frontend & UX Lead | User experience, frontend planning, theme specification, usability | Provisional |
| **Tanishk Sharma** | Backend Lead | Backend planning, repository integration, APIs, ingestion pipelines | Provisional |
| **Tannu Kumari** | Research & QA Lead | User research, documentation, evidence ledger, quality assurance | Provisional |
| **Ayush Kushwaha** | Retrieval & AI Lead | Evidence retrieval, graph investigation, AI interoperability, MCP planning | Provisional |

*Note: Workstream assignments are provisional and subject to formal confirmation by team members.*

---

## 2. Problem Statement & Motivation
Developers working on established, multi-contributor software repositories regularly encounter intricate workarounds, legacy constraints, or non-obvious design choices. When asking contemporary AI coding assistants (such as GitHub Copilot, Cursor, or Claude Code) *"Why was this implemented this way?"*, the assistants frequently generate fluent, plausible explanations that sound authoritative but may rely on hallucinated assumptions rather than repository history.

A developer cannot easily discern whether:
1. The explanation is genuinely supported by past Git commits, PR discussions, and architectural decision records.
2. The explanation was inferred solely from current code syntax and keyword matching.
3. The explanation contradicts historical evidence recorded in previous bug reports or pull requests.

Traceback solves this by introducing a human-supervised verification layer that decomposes AI explanations into testable claims, retrieves ground-truth repository artifacts, highlights provenance, and lets developers render informed verdicts.

---

## 3. Product Vision & Principles
Traceback is an evidence-grounded verification companion, not an autonomous agent or a conversational replacement for existing coding assistants.

### Core Product Principles
1. **Keyword similarity is not proof of correctness:** Lexical match does not establish historical rationale.
2. **Missing evidence does not prove a claim is false:** Incomplete repository history represents uncertainty, not contradiction.
3. **Tests reflect current behaviour, not historical intent:** Passing tests demonstrate what code executes, not why it was designed.
4. **AI assessments and human verdicts must remain distinguishable:** Model heuristics must never overwrite or masquerade as human decisions.
5. **No fabricated references:** Commits, PR numbers, file paths, issue IDs, and quotes must never be synthesized or hallucinated.
6. **Explicit abstention:** When evidence is ambiguous, sparse, or absent, the system must explicitly state uncertainty.
7. **Repository content is untrusted data:** Code comments, commits, and issue descriptions are treated strictly as data to inspect, never system prompts.
8. **Advisory by design:** Traceback V1 provides advisory reports; it will never perform automated code edits, commits, PR approvals, or merges.
9. **Zero credential leakage:** Repository tokens and private artifacts must never appear in frontend code, public logs, or exported unredacted reports.
10. **Empirical measurement:** Product effectiveness must be measured against curated test suites and real developer benchmarks, not marketing claims.

---

## 4. Strategic Scope Boundaries
- **In Scope (V1):**
  - Read-only ingestion of Git commits, diffs, PRs, and issues for authorized repositories.
  - Explanation decomposition into verifiable claims.
  - Hybrid retrieval of historical repository evidence.
  - Evidence provenance presentation with clickable references.
  - Human review interface with Supported, Contradicted, and Unverified verdict tagging.
  - Exportable verification reports (JSON & Markdown).
  - Light-first design with accessible secondary dark theme.
- **Out of Scope (V1 Exclusions):**
  - Autonomous code refactoring or auto-fixing.
  - Automatic commit/PR approvals or merge blocking.
  - General-purpose conversational chatbot functionality.
  - Graph database deployment unless empirical retrieval benchmarks justify it.
