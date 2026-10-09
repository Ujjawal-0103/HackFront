# Traceback — Human-Supervised Code Rationale Verification

[![Theme: Light Default](https://img.shields.io/badge/Theme-Light%20Default-blue.svg)](docs/ux/THEME_SPEC.md)
[![Status: Sprint 1 Complete](https://img.shields.io/badge/Sprint%201-Product%20Foundation%20Complete-green.svg)](docs/sprints/SPRINT_1.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-slate.svg)](#)

> **Official Problem Statement:** T1.1 — Why The Code Is Like This  
> **Innovation Theme:** AI and Developer Tools  
> **Team Lead:** Ujjawal Agrawal | **Contributors:** Tanishka, Tanishk Sharma, Tannu Kumari, Ayush Kushwaha

---

## 1. What is Traceback?
Traceback is a proposed human-supervised verification system for AI-generated code explanations. When developers ask an AI coding assistant (such as GitHub Copilot, Cursor, or Claude Code) why a non-obvious function or workaround exists in a legacy codebase, the generated response often sounds convincing while lacking connection to actual repository history.

Traceback bridges this gap by:
1. Decomposing the AI explanation into atomic, verifiable claims.
2. Searching authorized repository history (Git commits, diffs, pull requests, issues, ADRs).
3. Presenting retrieved evidence with immutable provenance links (commit SHAs, PR numbers, file lines).
4. Providing an AI-grounded preliminary assessment while clearly separating it from human review.
5. Enabling engineers to adjudicate claims as **Supported**, **Contradicted**, or **Unverified**.
6. Exporting auditable verification reports in JSON and Markdown.

---

## 2. Core Principles
1. **Keyword similarity is not proof of correctness.**
2. **Missing evidence does not prove a claim is false (Absence $\ne$ Contradiction).**
3. **Tests reflect current behavior, not historical intent.**
4. **AI assessments and human verdicts must strictly remain distinguishable.**
5. **Never invent source references, commit SHAs, PR numbers, or quotes.**
6. **Explicit abstention:** Say *"Insufficient Evidence"* instead of hallucinating.
7. **Repository content is untrusted data:** Code comments are data to inspect, never instructions.
8. **Advisory by design:** No automatic code modifications, commits, or PR approvals in V1.
9. **Zero credential leakage:** No tokens in logs, frontend bundles, or committed files.
10. **Light theme is the default theme:** Initial loads render in light mode (`#F8FAFC`); dark mode is optional secondary.

---

## 3. Current Implementation Status vs. Planned Production V1

### What Was Audited & Found in Workspace
- **Initial Workspace State:** Workspace initialized with a fresh Git repository on branch `main`.
- **Starter Prototype Audit Finding:** The starter prototype (`server.js`, `package.json`, etc.) was **absent** from the workspace. Per project safety rules, nonexistent code was not fabricated and no artificial test runs against phantom files were claimed.

### What is Completed (Sprint 1: Product Foundation)
- [x] **Project Conventions:** `.gitignore`, `.editorconfig`, and persistent [`AGENTS.md`](./AGENTS.md) operating principles.
- [x] **Authoritative Product Specification:** [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) answering the 8 foundational questions, defining RF-01 through RF-10, RN-01 through RN-12, and explicit scope exclusions.
- [x] **Project Charter & Requirements:** [`docs/PROJECT_CHARTER.md`](./docs/PROJECT_CHARTER.md) and [`docs/product/PRODUCT_REQUIREMENTS.md`](./docs/product/PRODUCT_REQUIREMENTS.md).
- [x] **Problem Definition & ICP:** [`docs/product/ICP_AND_PROBLEM.md`](./docs/product/ICP_AND_PROBLEM.md).
- [x] **Competitor Research & Evidence Ledger:** [`docs/research/COMPETITOR_RESEARCH.md`](./docs/research/COMPETITOR_RESEARCH.md) and [`docs/research/EVIDENCE_LEDGER.md`](./docs/research/EVIDENCE_LEDGER.md) with verified October 2026 sources.
- [x] **Developer Research Kit:** [`docs/research/INTERVIEW_GUIDE.md`](./docs/research/INTERVIEW_GUIDE.md) and [`docs/research/INTERVIEW_NOTES_TEMPLATE.md`](./docs/research/INTERVIEW_NOTES_TEMPLATE.md) (Field execution marked **Pending Human Research**).
- [x] **Core UX Flow & Theming:** [`docs/ux/CORE_USER_FLOW.md`](./docs/ux/CORE_USER_FLOW.md) and [`docs/ux/THEME_SPEC.md`](./docs/ux/THEME_SPEC.md) defining WCAG AA design tokens (Light default, Dark secondary).
- [x] **Architecture Decision Records:** [`docs/architecture/SYSTEM_OVERVIEW.md`](./docs/architecture/SYSTEM_OVERVIEW.md) and 10 detailed ADRs ([`ADR-001`](./docs/architecture/ADRs/ADR-001-repository-structure.md) to [`ADR-010`](./docs/architecture/ADRs/ADR-010-deployment-cost-controls.md)).
- [x] **Security Threat Model:** [`docs/security/THREAT_MODEL.md`](./docs/security/THREAT_MODEL.md) covering 15 threat scenarios across 4 categories.
- [x] **Evaluation Benchmark Plan:** [`docs/evaluation/EVALUATION_PLAN.md`](./docs/evaluation/EVALUATION_PLAN.md) and [`docs/evaluation/evaluation-case-template.csv`](./docs/evaluation/evaluation-case-template.csv).
- [x] **Delivery Roadmap:** [`docs/SPRINT_ROADMAP.md`](./docs/SPRINT_ROADMAP.md) detailing all nine sprints.
- [x] **Sprint 1 Backlog:** [`docs/sprints/SPRINT_1.md`](./docs/sprints/SPRINT_1.md) tracking tasks S1-01 through S1-12.

### What Remains Planned for Sprints 2–9
- Monorepo scaffolding, database migrations, and GitHub App authentication (Sprint 2).
- Commit, diff, and PR ingestion pipelines with BullMQ and rate limiting (Sprint 3).
- Hybrid search engine combining BM25 and `pgvector` with RRF ranking (Sprint 4).
- Claim extraction LLM adapter and citation validation engine (Sprint 5).
- Web application interface and interactive review board (Sprint 6).
- Read-only Model Context Protocol (MCP) server for IDEs (Sprint 7).
- Adversarial security testing and benchmark evaluation (Sprint 8).
- Production deployment, automated backups, and runbooks (Sprint 9).

---

## 4. Nine-Sprint Roadmap Overview

| Sprint | Focus Area | Deliverables |
| :--- | :--- | :--- |
| **Sprint 1** | **Product Foundation** | Problem definition, research kit, UX flow, ADRs, threat model, evaluation plan |
| **Sprint 2** | **Project Foundation & Access** | Turborepo monorepo, CI/CD, Prisma schema, GitHub App auth, theme tokens |
| **Sprint 3** | **Repository Ingestion** | Git & GitHub API ingestion (commits, diffs, PRs, issues), rate limiting, retries |
| **Sprint 4** | **Evidence Store & Retrieval** | PostgreSQL + pgvector hybrid search, provenance records, RRF ranking benchmark |
| **Sprint 5** | **Claim Assessment** | Claim extraction, AI adapter, grounding assessment, source validation, abstention |
| **Sprint 6** | **Web Product** | Full web UI, repository selection, claim adjudication board, report export |
| **Sprint 7** | **Interoperability** | Read-only MCP server tools for Cursor, Claude Code, Antigravity |
| **Sprint 8** | **Quality & Validation** | Penetration testing, adversarial tests, benchmark evaluation run, user interviews |
| **Sprint 9** | **Deployment & Handoff** | Production Docker deployment, runbooks, monitoring, automated backup drills |

---

## 5. Local Setup & Configuration Guide

### Prerequisites
- Node.js $\ge 20.x$
- pnpm $\ge 9.x$ or npm $\ge 10.x$
- Docker & Docker Compose (for PostgreSQL and Redis in Sprint 2+)

### Setup Commands
```bash
# 1. Clone the repository
git clone <repo-url>
cd HackFront

# 2. Inspect environment variables
cp .env.example .env.local

# 3. Verify documentation and git tree
git log --oneline
```

### Planned Test Execution (from Sprint 2 onward)
```bash
# Run unit and integration test suites
pnpm test

# Run documentation integrity check
pnpm lint:docs

# Run retrieval evaluation benchmark (Sprint 4+)
pnpm eval:retrieval
```

---

## 6. Theming & Interface Specification
Traceback adheres to strict accessibility standards:
- **Default Theme:** **Light Mode** (`#F8FAFC` page background, `#FFFFFF` surfaces, `#0F172A` text).
- **Secondary Theme:** **Dark Mode** (`#0B1220` page background, `#111827` surfaces, `#F8FAFC` text).
- **Behavior:** First-time visits render in light mode regardless of OS settings. Manual selection persists via `localStorage` under `traceback-theme-preference`.
- **Details:** See [`docs/ux/THEME_SPEC.md`](./docs/ux/THEME_SPEC.md).

---

## 7. Known Limitations & Research Status
- **Pending Human Interviews:** The developer interview kit is prepared, but field interviews remain pending. Product validation will be revisited once empirical interview transcripts are synthesized.
- **Starter Prototype Absence:** In-place UI theme patching was blocked by the absence of a starter prototype in the initial repository; comprehensive theme specifications and CSS variables have been created for immediate application during Sprint 2 scaffolding.
- **External API Dependencies:** Production functionality depends on GitHub API access and LLM provider endpoints.

---

## 8. Documentation Quick Links
- [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) — Authoritative Product Specification
- [`AGENTS.md`](./AGENTS.md) — Persistent Instructions for AI Assistants
- [`docs/PROJECT_CHARTER.md`](./docs/PROJECT_CHARTER.md) — Vision, Team & Strategic Alignment
- [`docs/SPRINT_ROADMAP.md`](./docs/SPRINT_ROADMAP.md) — Complete 9-Sprint Delivery Roadmap
- [`docs/architecture/SYSTEM_OVERVIEW.md`](./docs/architecture/SYSTEM_OVERVIEW.md) — System Architecture & ADR Index
- [`docs/security/THREAT_MODEL.md`](./docs/security/THREAT_MODEL.md) — Security & Threat Matrix
- [`docs/evaluation/EVALUATION_PLAN.md`](./docs/evaluation/EVALUATION_PLAN.md) — Benchmark Strategy & Metrics
- [`docs/ux/THEME_SPEC.md`](./docs/ux/THEME_SPEC.md) — Design Tokens & Theming Rules
- [`docs/sprints/SPRINT_1.md`](./docs/sprints/SPRINT_1.md) — Sprint 1 Task Backlog & Tracking
