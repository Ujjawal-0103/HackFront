# Traceback — Human-Supervised Code Rationale Verification

[![Theme: Light Default](https://img.shields.io/badge/Theme-Light%20Default-blue.svg)](docs/ux/THEME_SPEC.md)
[![Status: Sprint 2 Complete](https://img.shields.io/badge/Sprint%202-Project%20Foundation%20Complete-green.svg)](docs/sprints/SPRINT_2.md)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-purple.svg)](turbo.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-slate.svg)](#)

> **Official Problem Statement:** T1.1 — Why The Code Is Like This  
> **Innovation Theme:** AI and Developer Tools  
> **Team Lead:** Ujjawal Agrawal | **Contributors:** Tanishka, Tanishk Sharma, Tannu Kumari, Ayush Kushwaha

---

## 1. What is Traceback?
Traceback is a human-supervised verification system for AI-generated code explanations. When developers ask an AI coding assistant (such as GitHub Copilot, Cursor, or Claude Code) why a non-obvious function, workaround, or architectural choice exists in a codebase, the generated response often sounds convincing while lacking verifiable ground truth.

Traceback bridges this gap by:
1. Decomposing the explanation into atomic, verifiable claims.
2. Searching authorized repository history (Git commits, diffs, pull requests, issues, ADRs).
3. Presenting retrieved evidence with immutable provenance links (commit SHAs, PR numbers, file lines).
4. Providing an AI-grounded preliminary assessment while clearly demarcating it from human review.
5. Enabling engineers to adjudicate claims as **Supported**, **Contradicted**, or **Unverified**.
6. Exporting auditable verification reports in JSON and Markdown.

---

## 2. Monorepo Architecture Overview

Traceback is organized as a Turborepo monorepo:

```text
traceback/
├── apps/
│   ├── web/                    # Next.js 14 App Router frontend (React, TypeScript)
│   └── api/                    # NestJS backend service (REST API, Prisma, Guards)
├── packages/
│   └── shared-types/           # Shared domain contracts (claims, verdicts, envelopes)
├── docs/                       # Project specifications, ADRs, UX flows, threat model
├── .github/
│   └── workflows/ci.yml        # Automated CI workflow (lint, test, typecheck, build)
├── docker-compose.yml          # Local PostgreSQL & Redis container definitions
├── package.json                # Monorepo root scripts
├── pnpm-workspace.yaml         # Workspace package configuration
└── turbo.json                  # Turborepo task pipeline
```

---

## 3. Local Development Quickstart

### Prerequisites
- **Node.js:** $\ge 20.x$ (Tested on Node v22.17.0)
- **pnpm:** $\ge 9.x$ (`npm install -g pnpm@9`)
- **Docker & Docker Compose:** Optional for local PostgreSQL & Redis services.

### Installation & Build
```bash
# 1. Install all dependencies across monorepo workspaces
pnpm install

# 2. Generate Prisma Client
pnpm --filter @traceback/api prisma:generate

# 3. Typecheck all workspaces
pnpm typecheck

# 4. Run automated test suites (27 tests across web and api)
pnpm test

# 5. Build all packages and applications
pnpm build
```

### Running Locally
```bash
# Start all applications concurrently in development mode
pnpm dev

# Or start individual applications:
pnpm --filter @traceback/api dev    # NestJS API running on http://localhost:3001/api
pnpm --filter @traceback/web dev    # Next.js Web running on http://localhost:3000
```

### Starting Local Database Services (Optional)
```bash
# Start PostgreSQL 16 and Redis containers
docker compose up -d

# Check service health
docker compose ps
```

---

## 4. Backend API Endpoints & Health Boundaries

The NestJS backend runs with global prefix `/api`:

| Method | Endpoint | Description | Access Boundary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Process liveness probe (`status: "ok"`, uptime, version) | Public |
| `GET` | `/api/ready` | Dependency readiness probe (PostgreSQL & config check) | Public (Returns 200 or 503) |
| `GET` | `/api/workspaces` | Lists authorized workspaces for authenticated user | Protected (`AuthGuard`) |
| `GET` | `/api/workspaces/:workspaceId` | Workspace details with multi-tenant isolation | Protected (`WorkspaceGuard`) |
| `GET` | `/api/workspaces/:workspaceId/github/repositories` | Lists accessible repositories in installation | Protected (`WorkspaceGuard`) |
| `GET` | `/api/workspaces/:workspaceId/github/verify` | Verifies read-only repository permissions | Protected (`WorkspaceGuard`) |

---

## 5. Theming & Accessibility System

Traceback enforces strict accessibility and contrast standards:
- **Default Theme:** **Light Mode** (`#F8FAFC` background, `#FFFFFF` surfaces, `#0F172A` text).
- **Secondary Theme:** **Dark Mode** (`#0B1220` background, `#111827` surfaces, `#F8FAFC` text).
- **Behavior:** First-time visits start in light mode regardless of operating system preferences.
- **Persistence:** Manual theme preference persists in `localStorage` under `traceback-theme-preference`.
- **Anti-Flash:** Inlined head script sets `data-theme` immediately before DOM render to prevent flashing.
- **Accessibility:** Accessible `ThemeToggle` with `aria-pressed`, keyboard support, and visible focus rings.

---

## 6. GitHub App Integration Boundary (ADR-007)

Traceback adheres strictly to the principle of least privilege:
- **Requested Scopes:** Read-only access to repository contents, pull requests, and issues.
- **Zero Write Access:** The system never performs automated source-code commits, edits, or PR merges.
- **Credential Protection:** GitHub App private keys remain strictly on the backend and are never returned to clients or logged.
- **Mock Sandbox:** When live GitHub App credentials are not provided in environment variables, the system operates seamlessly in sandbox mode using `MockGitHubClient` for testing and evaluation.

---

## 7. Delivery Status & Roadmap

| Sprint | Focus Area | Status | Deliverables |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | **Product Foundation** | **Completed** | Specifications, ADRs, UX flow, threat model, evaluation plan |
| **Sprint 2** | **Project Foundation & Access** | **Completed** | Turborepo, Next.js, NestJS, Prisma schema, theme system, CI |
| **Sprint 3** | **Repository Ingestion** | **Next (Ready)** | BullMQ worker, rate-limit handler, commit & diff fetchers |
| **Sprint 4** | **Evidence Store & Retrieval** | Planned | PostgreSQL + pgvector hybrid search, RRF ranker |
| **Sprint 5** | **Claim Assessment Engine** | Planned | LLM claim extraction, grounding assessment, abstention |
| **Sprint 6** | **Web Product Experience** | Planned | Adjudication board, human verdict tagging, report export |
| **Sprint 7** | **Interoperability & MCP** | Planned | Read-only MCP server tools for Cursor, Claude Code |
| **Sprint 8** | **Quality & Validation** | Planned | Adversarial tests, benchmark evaluation run, developer interviews |
| **Sprint 9** | **Deployment & Handoff** | Planned | Production Docker deployment, runbooks, monitoring |

---

## 8. Documentation Quick Links
- [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) — Authoritative Product Specification
- [`AGENTS.md`](./AGENTS.md) — Persistent Instructions for AI Assistants
- [`docs/sprints/SPRINT_2.md`](./docs/sprints/SPRINT_2.md) — Sprint 2 Backlog & Delivery Ledger
- [`docs/sprints/SPRINT_1.md`](./docs/sprints/SPRINT_1.md) — Sprint 1 Backlog & Delivery Ledger
- [`docs/architecture/SYSTEM_OVERVIEW.md`](./docs/architecture/SYSTEM_OVERVIEW.md) — System Architecture & ADR Index
- [`docs/security/THREAT_MODEL.md`](./docs/security/THREAT_MODEL.md) — Security & Threat Matrix
- [`docs/evaluation/EVALUATION_PLAN.md`](./docs/evaluation/EVALUATION_PLAN.md) — Benchmark Strategy & Metrics
- [`docs/ux/THEME_SPEC.md`](./docs/ux/THEME_SPEC.md) — Design Tokens & Theming Rules
