# PROJECT SPECIFICATION — TRACEBACK

> **Authoritative Specification Document**  
> Version: 1.0.0-draft | Status: In Review | Last Updated: 2026-10-09

---

## 1. The Eight Foundational Answers

### 1.1 What is the product?

Traceback is a human-supervised verification system for AI-generated code explanations. It takes an explanation produced by an existing coding assistant regarding why a piece of code exists, extracts individual claims, retrieves verifiable historical evidence from the repository (Git commits, diffs, pull requests, issues, ADRs, test suites), presents the evidence with transparent provenance, and allows a developer to review each claim and render a definitive verdict (Supported, Contradicted, or Unverified).

### 1.2 Who uses it?

Software engineers and technical leads maintaining established, multi-contributor repositories (starting with JavaScript/TypeScript ecosystems) who use AI coding assistants and need to reliably understand non-obvious code implementations without relying on unverified AI assertions.

### 1.3 What must it do?

1. Ingest authorized repository history (commits, diffs, PRs, issues, markdown documentation).
2. Accept an external AI-generated explanation alongside target code context.
3. Decompose the explanation into atomic, verifiable historical claims.
4. Search and retrieve relevant repository records using hybrid semantic and lexical retrieval.
5. Display retrieved evidence with immutable provenance links (commit SHAs, PR numbers, file line ranges).
6. Provide an AI-grounded preliminary assessment while clearly demarcating it as distinct from human verdicts.
7. Support human claim adjudication with three standard states: `Supported`, `Contradicted`, and `Unverified`.
8. Explicitly abstain from making claims when historical evidence is insufficient or ambiguous.
9. Generate structured, shareable verification reports (JSON and formatted Markdown).
10. Deliver a light-theme-first accessible user interface with persistent optional dark theme.

### 1.4 What does it not do?

- **It is NOT a general-purpose chat interface:** It does not answer broad trivia, write boilerplate, or generate novel application code.
- **It is NOT an autonomous refactoring agent:** It does not modify source code, execute automated commits, or push code.
- **It is NOT an automated PR blocker or gatekeeper in V1:** All outputs are strictly advisory; no CI/CD blocking or merging actions.
- **It does NOT fabricate evidence:** It never synthesizes non-existent commit hashes, PR numbers, or documentation quotes.

### 1.5 What data does it use?

- Public and user-authorized private Git repositories: commit history, author metadata, diffs, commit messages.
- GitHub API metadata: pull request discussions, reviewer comments, linked issues, bug reports, issue labels.
- In-repo architectural documentation: Architecture Decision Records (ADRs), READMEs, design RFCs, test specifications.
- User-supplied text: the AI-generated explanation and optional snippet of code under investigation.

### 1.6 What are its constraints?

- **Security:** Treat all repository text, comments, and commit messages as untrusted third-party data (potential prompt injection vector).
- **GitHub API Limits:** Must strictly adhere to rate limits (5,000 req/hr for authenticated GitHub Apps) through caching and batch ingestion.
- **Privacy & Secrets:** Private repository code and secrets must never be leaked across workspaces or logged in telemetry.
- **Default Theming:** First-time interface visits MUST render in light mode (#F8FAFC page background), regardless of OS theme settings.
- **Advisory Boundary:** The system must never auto-merge or modify repository state.

### 1.7 What does "Done" mean for V1?

A developer can select a target repository, paste an AI-generated explanation, view decomposed claims, inspect matched historical commits/PRs with verified URLs and line diffs, assign human verdicts to each claim, and download a validated verification report in under 90 seconds, with zero fabricated citations and a documented evaluation benchmark demonstrating >85% citation precision.

### 1.8 What remains unknown?

- The exact distribution of developer willingness to verify explanations versus trusting them passively (requires pending human interviews).
- Whether graph traversal (Neo4j) yields a statistically significant retrieval improvement over hybrid vector + lexical search on typical repositories.
- The optimal claim decomposition granularity (sentence-level vs. logical assertion level) to minimize developer review fatigue.

---

## 2. Functional Requirements Matrix (RF-01 – RF-10)

| ID        | Requirement Description         | Priority | Acceptance Criteria                                                                                                                                                           | Verification Method                                                                     | Dependencies                          | Status             |
| :-------- | :------------------------------ | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------ | :----------------- |
| **RF-01** | Select Authorized Repository    | P0       | User selects an authorized GitHub repository or local sample repo; permission level (read-only) confirmed prior to query execution.                                           | Automated integration test with mock GitHub App auth; validation of repo access errors. | GitHub OAuth / GitHub App integration | Pending Sprint 2   |
| **RF-02** | Supply AI Explanation           | P0       | User inputs raw text of an external AI explanation (max 10,000 characters) and optional file path / snippet context; input is sanitized and validated.                        | Unit test for input sanitization, length boundaries, and character validation.          | None                                  | Pending Sprint 5/6 |
| **RF-03** | Identify Reviewable Claims      | P0       | System decomposes explanation into atomic, testable claims; rejects trivial fluff or syntax restatements.                                                                     | Evaluation suite testing claim extraction precision across 50 benchmark explanations.   | LLM Claim Extraction Adapter          | Pending Sprint 5   |
| **RF-04** | Retrieve Historical Evidence    | P0       | Hybrid search queries repository store (commits, diffs, PRs, issues, ADRs) returning top candidate evidence with similarity/relevance scores.                                 | Automated retrieval benchmark measuring recall@5 and MRR against ground-truth dataset.  | Ingestion pipeline & Evidence Store   | Pending Sprint 3/4 |
| **RF-05** | Provenance & Source References  | P0       | Every piece of retrieved evidence includes immutable provenance: commit SHA, PR number, issue ID, file path, author, and timestamp. Zero hallucinated URLs.                   | Automated validator checking all citation URLs and SHAs against actual git database.    | Evidence Store                        | Pending Sprint 4   |
| **RF-06** | Demarcate AI vs. Human Verdicts | P0       | UI visually distinguishes between preliminary AI assessments (heuristic confidence) and human verdicts (user-selected status). AI assessment cannot override human selection. | UI accessibility & component visual audit; snapshot tests.                              | UI Theme Foundation                   | Pending Sprint 6   |
| **RF-07** | Tri-State Human Verdicts        | P0       | Human reviewer can assign one of three verdicts per claim: `Supported`, `Contradicted`, or `Unverified`, with optional review notes.                                          | End-to-end user flow test verifying state transitions and persistence.                  | UI Component State                    | Pending Sprint 6   |
| **RF-08** | Explicit Abstention             | P0       | When retrieved evidence confidence falls below threshold or is missing, system explicitly presents status as "Insufficient Evidence" rather than guessing.                    | Automated evaluation asserting abstention behavior on negative and sparse test cases.   | AI Assessment Adapter                 | Pending Sprint 5   |
| **RF-09** | Verification Report Generation  | P1       | Compiles complete review session into structured summary: input explanation, claims, evidence citations, AI assessments, human verdicts, and review timestamp.                | Unit test verifying JSON report schema conformance and markdown formatting.             | Verification Engine                   | Pending Sprint 6   |
| **RF-10** | Structured Report Export        | P1       | User can export report as validated JSON or formatted Markdown file; sensitive tokens automatically redacted.                                                                 | Integration test verifying exported file download and payload structure.                | Report Generator                      | Pending Sprint 6   |

---

## 3. Non-Functional Requirements (RN-01 – RN-12)

- **RN-01 (Security - Untrusted Input):** All repository code, commit messages, PR text, and issue descriptions must be treated as untrusted data. Input sanitization must neutralize prompt injection vectors before LLM processing.
- **RN-02 (Privacy & Workspace Isolation):** Data from private repositories must be scoped strictly to the authenticated organization/workspace; multi-tenant database queries must enforce tenant isolation at the schema or row level.
- **RN-03 (Repository Permissions):** The GitHub App integration must request the absolute minimum required permissions: read-only access to repository contents, commit statuses, issues, and pull requests. No write, administration, or workflow permissions.
- **RN-04 (Reliability & Rate Limiting):** External GitHub API interactions must implement an exponential backoff retry mechanism (max 3 retries) and respect `X-RateLimit-Reset` headers.
- **RN-05 (Error Handling):** Failures during ingestion, parsing, or retrieval must fail gracefully, returning structured error objects with clear user-facing explanations without revealing system stack traces.
- **RN-06 (Maintainability):** Codebase must maintain modular architecture separating ingestion, indexing, retrieval, assessment, and presentation, with strict TypeScript interfaces and minimum 80% test coverage on core business logic.
- **RN-07 (Accessibility - WCAG 2.1 AA):** All user interface components must meet WCAG 2.1 AA standards, including keyboard navigation, ARIA attributes for state toggles, and minimum 4.5:1 contrast ratios.
- **RN-08 (Theming):** Light theme is the default on initial load; dark theme is a user-toggleable secondary mode. Preferences persist in `localStorage` without modifying application state.
- **RN-09 (Performance):** Claim decomposition and initial evidence retrieval for a standard explanation (<5 claims) must complete within 5 seconds for pre-indexed repositories.
- **RN-10 (Observability):** Structured logging (JSON format) must capture operation latencies, retrieval query metrics, token usage, and error events without logging source code or repository secrets.
- **RN-11 (Data Retention & Deletion):** Users must have the ability to purge indexed repository metadata and cached verification reports on demand.
- **RN-12 (Cost Management):** Token usage per verification request must be budgeted and capped (<8,000 prompt tokens per standard review) using aggressive chunking and context pruning.

---

## 4. Explicit Exclusions

The following areas are strictly out of scope for Traceback V1:

1. Building an interactive conversational chatbot for arbitrary programming questions.
2. Automated code generation, editing, or pull request creation.
3. Automated merging, deployment, or CI/CD blocking mechanisms.
4. Billing, payment gateways, or subscription metering.
5. Organization-wide developer productivity scoring or surveillance analytics.
6. Support for version control systems other than Git/GitHub in V1.
7. Premature deployment of a graph database before baseline vector/lexical retrieval benchmarks are established.
