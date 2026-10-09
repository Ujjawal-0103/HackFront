# Sprint 1 Backlog: Product Foundation

> **Sprint Objective:** Establish an evidence-informed, testable product specification, user experience journey, architecture decision records, security threat model, evaluation strategy, and nine-sprint roadmap so that the engineering team can begin Sprint 2 without scope ambiguity.  
> **Status:** Execution in Progress | Last Updated: 2026-10-09

---

## 1. Provisional Team Workstream Assignments
*Note: All assignments are provisional and subject to formal team confirmation.*
- **Ujjawal Agrawal:** Team Lead — Product decisions, architecture coordination, integration, sprint approval.
- **Tanishka:** Frontend & UX — User experience, frontend planning, theme specification, usability.
- **Tanishk Sharma:** Backend — Backend planning, repository integration, APIs, ingestion pipelines.
- **Tannu Kumari:** Research & QA — User research, documentation, evidence ledger, quality assurance.
- **Ayush Kushwaha:** Retrieval & AI — Evidence retrieval, graph investigation, AI interoperability, MCP planning.

---

## 2. Sprint 1 Task Backlog (S1-01 through S1-12)

### Task S1-01: Audit the Repository
- **Description:** Inspect the current working tree, git status, existing prototype presence, and environmental constraints.
- **Suggested Owner:** Ujjawal Agrawal
- **Dependencies:** None
- **Deliverable:** Baseline audit report documented in onboarding notes and AGENTS.md.
- **Acceptance Criteria:** Clean working tree confirmed; presence or absence of prototype established without fabricating nonexistent files.
- **Verification Method:** Git status and directory listing commands executed and verified.
- **Status:** **Done**

### Task S1-02: Establish Repository Conventions
- **Description:** Configure root `.gitignore`, `.editorconfig`, and `AGENTS.md` with persistent operating principles for AI assistants.
- **Suggested Owner:** Ujjawal Agrawal
- **Dependencies:** S1-01
- **Deliverable:** `.gitignore`, `.editorconfig`, `AGENTS.md`.
- **Acceptance Criteria:** Excludes secrets and build artifacts; defines 10 core trust principles; mandates small atomic commits.
- **Verification Method:** Git commit `96817cf` verified in commit history.
- **Status:** **Done**

### Task S1-03: Define the Problem and ICP
- **Description:** Formulate the problem hypothesis, provisional Ideal Customer Profile, current developer workarounds, and epistemological assumptions.
- **Suggested Owner:** Tannu Kumari
- **Dependencies:** S1-02
- **Deliverable:** `docs/product/ICP_AND_PROBLEM.md`, `docs/research/OPEN_QUESTIONS.md`.
- **Acceptance Criteria:** Clearly separates verified evidence from working hypotheses; defines provisional target maintainer profile.
- **Verification Method:** Git commit `2c8742d` verified in commit history.
- **Status:** **Done** (Note: Empirical validation remains pending human interviews).

### Task S1-04: Research Competitors
- **Description:** Research existing AI coding assistants (GitHub Copilot, Cursor, Claude Code, Antigravity, CodeSource, Codex) regarding historical code capabilities, citations, and PR analysis.
- **Suggested Owner:** Tannu Kumari / Ayush Kushwaha
- **Dependencies:** S1-03
- **Deliverable:** `docs/research/COMPETITOR_RESEARCH.md`, `docs/research/EVIDENCE_LEDGER.md`.
- **Acceptance Criteria:** Documents official sources, verification dates (2026-10-09), verified capabilities, and unverified assumptions without fabricated claims.
- **Verification Method:** Git commit `6a319f1` verified in commit history.
- **Status:** **Done**

### Task S1-05: Prepare Developer Interviews
- **Description:** Prepare semi-structured interview kit with 8 past-behavior inquiries and screening notes template.
- **Suggested Owner:** Tannu Kumari
- **Dependencies:** S1-03
- **Deliverable:** `docs/research/INTERVIEW_GUIDE.md`, `docs/research/INTERVIEW_NOTES_TEMPLATE.md`.
- **Acceptance Criteria:** Contains 8 behavioral questions probing past actions; template includes criteria and classifications; field interviews marked pending.
- **Verification Method:** Git commit `f8e9f8e` verified in commit history.
- **Status:** **Done** (Field interview execution marked **Pending Human Research**).

### Task S1-06: Define Product Requirements and Exclusions
- **Description:** Author authoritative `PROJECT_SPEC.md` answering the 8 foundational questions, defining RF-01 through RF-10, RN-01 through RN-12, and explicit scope exclusions.
- **Suggested Owner:** Ujjawal Agrawal
- **Dependencies:** S1-02, S1-03
- **Deliverable:** `PROJECT_SPEC.md`, `docs/PROJECT_CHARTER.md`, `docs/product/PRODUCT_REQUIREMENTS.md`.
- **Acceptance Criteria:** Precise priority, acceptance criteria, and status for all functional and non-functional requirements.
- **Verification Method:** Git commit `75a06b5` verified in commit history.
- **Status:** **Done**

### Task S1-07: Document Core User Flow and Themes
- **Description:** Document the 5-stage canonical user journey, 10 error/edge states, and WCAG AA design tokens (Light default, Dark secondary).
- **Suggested Owner:** Tanishka
- **Dependencies:** S1-06
- **Deliverable:** `docs/ux/CORE_USER_FLOW.md`, `docs/ux/THEME_SPEC.md`.
- **Acceptance Criteria:** Includes Mermaid flow diagram; defines TH-01 through TH-08; specifies localStorage persistence; documents prototype absence blocker for live UI patch.
- **Verification Method:** Git commit `b15ba7f` verified in commit history.
- **Status:** **Done** (Theme implementation deferred to Sprint 2 scaffolding per architectural blocker).

### Task S1-08: Prepare Architecture Decision Records
- **Description:** Author comprehensive System Overview and 10 ADRs covering monorepo structure, frameworks, evidence storage, hybrid search, Neo4j criteria, AI boundaries, GitHub App, BullMQ, MCP, and cost controls.
- **Suggested Owner:** Ujjawal Agrawal / Tanishk Sharma / Ayush Kushwaha
- **Dependencies:** S1-06
- **Deliverable:** `docs/architecture/SYSTEM_OVERVIEW.md`, `docs/architecture/ADRs/` (ADR-001 through ADR-010).
- **Acceptance Criteria:** Every ADR details Context, Options, Decision, Consequences, Trade-offs, Security, and Revisit conditions.
- **Verification Method:** Git commit `dfbb470` verified in commit history.
- **Status:** **Done**

### Task S1-09: Document Security Threats
- **Description:** Formulate comprehensive 4-category threat model (Repository Security, Prompt Injection, Evidence Integrity, API Abuse).
- **Suggested Owner:** Tanishk Sharma / Ayush Kushwaha
- **Dependencies:** S1-08
- **Deliverable:** `docs/security/THREAT_MODEL.md`.
- **Acceptance Criteria:** 15 threat scenarios detailed with Likelihood, Impact, Proposed Mitigation, Verification Method, and Owner; mitigations marked as planned.
- **Verification Method:** Git commit `39d669f` verified in commit history.
- **Status:** **Done**

### Task S1-10: Define Evaluation Strategy
- **Description:** Create benchmark evaluation plan with 10 case archetypes, quantitative metrics ($R@K$, $CVR$, $CAA$, $AQ$, $UAR$), mathematical calculation formulas, and benchmark template.
- **Suggested Owner:** Tannu Kumari / Ayush Kushwaha
- **Dependencies:** S1-06, S1-08
- **Deliverable:** `docs/evaluation/EVALUATION_PLAN.md`, `docs/evaluation/evaluation-case-template.csv`.
- **Acceptance Criteria:** Mathematical formulas documented with denominators; case template contains all required headers.
- **Verification Method:** Git commit `1fbe0b8` verified in commit history.
- **Status:** **Done** (Benchmark execution scheduled for Sprints 4 & 5).

### Task S1-11: Create Nine-Sprint Roadmap
- **Description:** Define the delivery roadmap covering the full defined V1 scope across nine sprints.
- **Suggested Owner:** Ujjawal Agrawal
- **Dependencies:** S1-01 through S1-10
- **Deliverable:** `docs/SPRINT_ROADMAP.md`.
- **Acceptance Criteria:** Sprints 1 through 9 defined with Objective, Dependencies, Work items, Owners, Deliverables, Acceptance criteria, Tests, Risks, and Exit conditions.
- **Verification Method:** Git commit `a36a210` verified in commit history.
- **Status:** **Done**

### Task S1-12: Review Documentation Consistency & Onboarding
- **Description:** Audit all created documents for cross-referencing integrity, ensure root README provides onboarding, and check that no contradictory specifications exist.
- **Suggested Owner:** Ujjawal Agrawal
- **Dependencies:** S1-01 through S1-11
- **Deliverable:** Root `README.md`, consistency audit report.
- **Acceptance Criteria:** All links clickable and valid; light theme default consistently reflected across all docs; roadmap and backlog align.
- **Verification Method:** Automated file verification and final consistency review.
- **Status:** **In Progress** (Active task).
