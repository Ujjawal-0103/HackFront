# Nine-Sprint Delivery Roadmap — Traceback V1

> **Status:** Authoritative V1 Roadmap  
> **Classification:** Sprint 1 Active | Sprints 2–9 Planned  
> **Last Updated:** 2026-10-09

---

## Roadmap Executive Summary
The Traceback V1 roadmap spans nine focused, sequentially dependent sprints designed to transform the product hypothesis into a secure, validated, and deployed human-supervised verification system.

| Sprint | Focus Area | Primary Milestone Deliverable | Suggested Lead | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Sprint 1** | Product Foundation | Problem definition, research kit, UX flow, ADRs, threat model, evaluation plan | Ujjawal Agrawal | **Active (Sprint 1)** |
| **Sprint 2** | Project Foundation & Access | Next.js/NestJS monorepo, CI/CD, Prisma schema, GitHub App auth, theme tokens | Tanishk Sharma | Planned |
| **Sprint 3** | Repository Ingestion | Robust Git & GitHub API ingestion (commits, diffs, PRs, issues) with rate-limiting | Tanishk Sharma | Planned |
| **Sprint 4** | Evidence Store & Retrieval | PostgreSQL + pgvector hybrid search, provenance records, RRF ranking benchmark | Ayush Kushwaha | Planned |
| **Sprint 5** | Claim Assessment Engine | Claim extraction, grounding verification adapter, citation validator, abstention | Ayush Kushwaha | Planned |
| **Sprint 6** | Web Product Experience | Web UI with light/dark theme, review board, human verdict tagging, export reports | Tanishka | Planned |
| **Sprint 7** | Interoperability & MCP | Read-only MCP server tools for IDE clients (Cursor, Claude Code, Antigravity) | Ayush Kushwaha | Planned |
| **Sprint 8** | Quality & Validation | Adversarial security tests, benchmark evaluation run, end-to-end integration tests | Tannu Kumari | Planned |
| **Sprint 9** | Deployment & Handoff | Production Docker/Cloud deployment, runbooks, monitoring, automated backups | Ujjawal Agrawal | Planned |

---

## Detailed Sprint Specifications (1 through 9)

### Sprint 1: Product Foundation
- **Objective:** Establish clear product specifications, research kits, architecture decisions, security threat models, and delivery roadmaps.
- **Dependencies:** Initial repository creation.
- **Work Items:**
  - Audit repository and establish project conventions (`.gitignore`, `.editorconfig`, `AGENTS.md`).
  - Draft `PROJECT_CHARTER.md` and authoritative `PROJECT_SPEC.md`.
  - Prepare behavioral interview guide and notes template.
  - Compile verified competitor research and epistemological evidence ledger.
  - Specify 5-stage core user journey and design tokens (Light default, Dark secondary).
  - Author 10 Architecture Decision Records (ADRs).
  - Develop comprehensive 4-category threat model and evaluation plan.
- **Suggested Owners:** Ujjawal Agrawal (Lead), Tannu Kumari (Research), Tanishka (UX), Ayush Kushwaha (AI), Tanishk Sharma (Backend).
- **Deliverables:** `PROJECT_SPEC.md`, `docs/` repository architecture, interview templates, threat model, evaluation suite.
- **Acceptance Criteria:** All documentation consistent; theme tokens defined with light-first default; zero fabricated interview data.
- **Tests:** Documentation link integrity checks, Git workflow validation, markdown linting.
- **Risks:** Unvalidated user demand prior to developer interviews.
- **Exit Conditions:** Sprint 1 backlog completed; technical preparation approved for Sprint 2.

---

### Sprint 2: Project Foundation and Secure Access
- **Objective:** Scaffolding the production application monorepo, continuous integration, database schemas, and least-privilege GitHub App access.
- **Dependencies:** Sprint 1 approval.
- **Work Items:**
  - Initialize Turborepo monorepo (`apps/web`, `apps/api`, `packages/shared-types`).
  - Configure GitHub Actions CI workflow (linting, type-checking, automated test runs).
  - Scaffold NestJS backend with Prisma ORM and initial PostgreSQL schema migrations.
  - Configure Next.js frontend with shared CSS theme tokens (default light mode, toggleable dark mode).
  - Implement GitHub App authentication flow with read-only scopes.
- **Suggested Owners:** Tanishk Sharma (Lead Backend), Tanishka (Frontend Scaffolding).
- **Deliverables:** Working monorepo with passing CI, database migrations, and authenticated GitHub App handshake.
- **Acceptance Criteria:** Local development spins up with single command; GitHub App issues ephemeral installation tokens; light theme renders on initial visit.
- **Tests:** Prisma migration tests, GitHub App OAuth unit tests, theme toggle unit tests.
- **Risks:** Delays in GitHub App organization approval or webhook configuration.
- **Exit Conditions:** CI passes on `main`; authenticated user can link a GitHub repository.

---

### Sprint 3: Repository Ingestion
- **Objective:** Build robust, rate-limit-aware ingestion pipelines for Git commits, diffs, pull requests, and issues.
- **Dependencies:** Sprint 2 (monorepo & database).
- **Work Items:**
  - Implement GitHub REST & GraphQL ingestion workers using BullMQ and Redis.
  - Build paginated fetchers for commit logs, unified diff hunks, PR discussions, and issue comments.
  - Implement rate-limit tracking respecting `X-RateLimit-Reset` and exponential backoff retry policies.
  - Build ingestion sync status tracker with progress metrics.
  - Implement diff sanitizer to filter binary files and secret patterns.
- **Suggested Owners:** Tanishk Sharma (Lead), Ayush Kushwaha.
- **Deliverables:** Background ingestion worker pipeline and sync progress API.
- **Acceptance Criteria:** Ingests 1,000 commits and 100 PRs without rate-limit errors; diffs safely sanitized.
- **Tests:** Ingestion mock unit tests, rate-limit backoff integration tests, diff parser fuzz tests.
- **Risks:** GitHub API secondary rate limits on large repository historical diffs.
- **Exit Conditions:** Target repository history ingested and stored in PostgreSQL with intact provenance.

---

### Sprint 4: Evidence Store and Retrieval
- **Objective:** Establish the hybrid retrieval engine combining lexical search (BM25) and dense embeddings (pgvector).
- **Dependencies:** Sprint 3 (ingested repository data).
- **Work Items:**
  - Implement text chunking and embedding generation worker for commit diffs and discussions.
  - Configure PostgreSQL `pgvector` index (HNSW / IVFFlat).
  - Implement BM25 full-text search index (`tsvector`).
  - Build Reciprocal Rank Fusion (RRF) ranker combining lexical and semantic scores.
  - Benchmark retrieval against the 10 evaluation case archetypes.
  - Evaluate ADR-005 gate: determine if Neo4j graph traversal is justified.
- **Suggested Owners:** Ayush Kushwaha (Lead), Tanishk Sharma.
- **Deliverables:** Hybrid search service with RRF ranking and empirical retrieval benchmark report.
- **Acceptance Criteria:** Retrieval achieves Recall@5 $\ge 0.85$ on benchmark dataset; query latency $<350$ms.
- **Tests:** Retrieval benchmark suite (`eval:retrieval`), vector similarity unit tests.
- **Risks:** Embedding generation costs on very large repositories.
- **Exit Conditions:** Benchmark demonstrates target recall; ADR-005 gate formally concluded.

---

### Sprint 5: Claim Assessment Engine
- **Objective:** Build the AI-grounded claim extraction, preliminary confidence assessment, citation validator, and abstention module.
- **Dependencies:** Sprint 4 (retrieval engine).
- **Work Items:**
  - Build LLM adapter with strict prompt delimiter isolation (`<untrusted_diff>`).
  - Implement atomic claim extraction module from raw explanations.
  - Build preliminary evidence grounding scoring module (`High`, `Partial`, `Sparse`, `Contradicted`).
  - Implement post-generation citation validation ensuring all referenced SHAs/URLs exist in database.
  - Implement strict abstention handler for sparse or missing historical evidence.
- **Suggested Owners:** Ayush Kushwaha (Lead), Tannu Kumari (QA).
- **Deliverables:** Claim assessment pipeline and automated citation validation service.
- **Acceptance Criteria:** Citation validity rate is 100%; abstention quality on missing-evidence cases $\ge 95\%$.
- **Tests:** Adversarial prompt injection tests, citation existence unit tests, abstention benchmark suite.
- **Risks:** LLM provider latency fluctuations or context window overflow.
- **Exit Conditions:** Verified claim assessments generated without citation hallucination.

---

### Sprint 6: Web Product Experience
- **Objective:** Deliver the complete end-to-end web user interface for repository selection, claim review, human adjudication, and report export.
- **Dependencies:** Sprint 2 (frontend setup), Sprint 5 (assessment engine).
- **Work Items:**
  - Build repository selection dashboard and investigation form.
  - Implement real-time progress indicators for decomposition and retrieval.
  - Build interactive claim adjudication board with evidence drawers.
  - Implement human verdict controls (`Supported`, `Contradicted`, `Unverified`) with reviewer notes.
  - Implement report preview and structured export (JSON & Markdown).
  - Bind shared theme tokens: default light mode with accessible dark mode toggle.
- **Suggested Owners:** Tanishka (Lead UX/Frontend), Ujjawal Agrawal.
- **Deliverables:** Full web application supporting the canonical user flow.
- **Acceptance Criteria:** Complete flow executable in $<90$ seconds; passes WCAG 2.1 AA accessibility checks.
- **Tests:** Playwright end-to-end user journey tests, axe-core accessibility audits, theme persistence tests.
- **Risks:** Review fatigue if evidence cards are overly cluttered.
- **Exit Conditions:** End-to-end verification and report download successfully completed in browser.

---

### Sprint 7: Interoperability and MCP
- **Objective:** Expose read-only Model Context Protocol (MCP) server tools to enable verification directly inside modern coding assistants.
- **Dependencies:** Sprint 5 (verification engine), Sprint 6 (core flow validated).
- **Work Items:**
  - Scaffold `@traceback/mcp-server` package using official MCP TypeScript SDK.
  - Expose `traceback_query_rationale` and `traceback_verify_explanation` tools.
  - Implement strict authentication and read-only sandboxing for MCP connections.
  - Test interoperability with Cursor, Claude Code, and Antigravity.
- **Suggested Owners:** Ayush Kushwaha (Lead), Ujjawal Agrawal.
- **Deliverables:** Published MCP server package with integration documentation.
- **Acceptance Criteria:** Compatible MCP clients successfully invoke verification tools and receive structured citations.
- **Tests:** MCP protocol compliance suite, client integration test harness.
- **Risks:** Rapid changes in evolving MCP client specifications.
- **Exit Conditions:** In-editor verification confirmed working in at least two external AI environments.

---

### Sprint 8: Quality and Validation
- **Objective:** Conduct rigorous security penetration testing, adversarial verification audits, and comprehensive user validation testing.
- **Dependencies:** Sprints 6 and 7.
- **Work Items:**
  - Execute automated penetration test suite (indirect prompt injection, cross-tenant isolation, XSS).
  - Run full evaluation benchmark against 100+ multi-archetype test cases.
  - Conduct usability testing and stranger tests with external software engineers.
  - Execute developer interviews prepared in Sprint 1 to compare empirical findings against initial hypotheses.
- **Suggested Owners:** Tannu Kumari (Lead QA), Ujjawal Agrawal.
- **Deliverables:** Quality audit report, security penetration test sign-off, completed evaluation benchmark ledger.
- **Acceptance Criteria:** Zero critical security vulnerabilities; benchmark passes all quality thresholds; interview findings synthesized.
- **Tests:** End-to-end automated regression suite, OWASP security scanners, fuzz test suites.
- **Risks:** Uncovered edge cases requiring model prompt tuning.
- **Exit Conditions:** Quality gate formally approved by Team Lead.

---

### Sprint 9: Deployment and Handoff
- **Objective:** Deploy production infrastructure, automated monitoring, backup verification, and deliver final handoff documentation.
- **Dependencies:** Sprint 8 approval.
- **Work Items:**
  - Configure production Docker container builds and orchestration manifests.
  - Deploy PostgreSQL database with daily automated backups and point-in-time recovery testing.
  - Setup Prometheus/Grafana or Datadog observability dashboards and error alerting (Sentry).
  - Author complete operator runbooks, deployment guides, and API documentation.
  - Produce final project demonstration and release checklist.
- **Suggested Owners:** Ujjawal Agrawal (Lead), Tanishk Sharma.
- **Deliverables:** Live production application, monitoring dashboards, tested backup restoration scripts, documentation handoff package.
- **Acceptance Criteria:** Zero-downtime deployment; automated backup restoration successfully validated in staging; runbooks fully documented.
- **Tests:** Disaster recovery drill, production smoke tests, health check endpoints.
- **Risks:** Cloud infrastructure cost overruns.
- **Exit Conditions:** Traceback V1 live, operational, and handed off with verified runbooks.
