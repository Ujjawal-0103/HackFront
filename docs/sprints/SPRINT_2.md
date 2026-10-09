# Sprint 2 Backlog & Delivery Ledger: Project Foundation and Secure Access

> **Sprint Objective:** Scaffold a reproducible Turborepo monorepo, runnable Next.js frontend, runnable NestJS backend, shared TypeScript types, PostgreSQL and Prisma foundation, secure GitHub integration boundary, multi-tenant workspace isolation, CI pipeline, and a functional light-first theme system.  
> **Status:** **Completed** | Last Updated: 2026-10-09

---

## 1. Sprint 2 Task Delivery Matrix

| Task ID   | Task Description                             | Owner (Provisional) | Deliverables                                                              | Verification Method                                                                                                               | Status   |
| :-------- | :------------------------------------------- | :------------------ | :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- | :------- |
| **S2-01** | Turborepo Workspace Configuration            | Ujjawal Agrawal     | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | `pnpm install`, Turborepo task pipeline execution                                                                                 | **Done** |
| **S2-02** | Shared Domain Contracts                      | Ayush Kushwaha      | `packages/shared-types` (`src/index.ts`, `tsconfig.json`)                 | `pnpm --filter @traceback/shared-types build`                                                                                     | **Done** |
| **S2-03** | NestJS Backend Service Scaffolding           | Tanishk Sharma      | `apps/api` (`main.ts`, `app.module.ts`, `config/`, `health/`)             | Unit tests in `health.controller.spec.ts`                                                                                         | **Done** |
| **S2-04** | Readiness Checks & Safe Error Handling       | Tanishk Sharma      | `GET /api/ready`, `ReadinessService`, `HttpExceptionFilter`               | Unit tests in `readiness.service.spec.ts`, `http-exception.filter.spec.ts`                                                        | **Done** |
| **S2-05** | Next.js Frontend Scaffolding                 | Tanishka            | `apps/web` (`layout.tsx`, `page.tsx`, `next.config.js`)                   | Next.js production build (`next build`)                                                                                           | **Done** |
| **S2-06** | Light-First Theme System & Tokens            | Tanishka            | `globals.css`, `ThemeContext.tsx`, `ThemeToggle.tsx`                      | Unit tests in `ThemeContext.spec.tsx` (6/6 passed)                                                                                | **Done** |
| **S2-07** | PostgreSQL & Prisma Foundation               | Tanishk Sharma      | `apps/api/prisma/schema.prisma`, `docker-compose.yml`, `PrismaService`    | Migration `20261009184048_init` applied to live PostgreSQL port 5434; live integration test `prisma.service.spec.ts` (4/4 passed) | **Done** |
| **S2-08** | Multi-Tenant Workspace & Identity Boundaries | Tanishk Sharma      | `AuthGuard`, `WorkspaceGuard`, `WorkspacesController`                     | Unit tests in `workspace.guard.spec.ts`, `auth.guard.spec.ts` (5/5 passed, prod header rejected)                                  | **Done** |
| **S2-09** | Read-Only GitHub App Integration Boundary    | Ayush Kushwaha      | `IGitHubClient`, `MockGitHubClient`, `GitHubService`, `GitHubController`  | Unit tests in `github.service.spec.ts`                                                                                            | **Done** |
| **S2-10** | CI Pipeline & Quality Automation             | Ujjawal Agrawal     | `.github/workflows/ci.yml`, `.prettierignore`                             | Local execution of format, typecheck, test, and build                                                                             | **Done** |
| **S2-11** | Developer Onboarding & Documentation         | Ujjawal Agrawal     | Updated `README.md`, `docs/sprints/SPRINT_2.md`                           | Documentation review & setup reproduction                                                                                         | **Done** |

---

## 2. Technical Decisions & Verified Environment

- **PostgreSQL Host Port 5434:** Configured `docker-compose.yml` to bind PostgreSQL container port 5432 to host port `127.0.0.1:5434`. This eliminates socket bind errors on developer systems where local PostgreSQL instances occupy 5432 and virtualization daemons occupy 5433.
- **Prisma Migration History:** Applied migration `20261009184048_init` against PostgreSQL 16 on port 5434. Confirmed all 9 tables (`users`, `workspaces`, `workspace_members`, `github_installations`, `repositories`, `verification_sessions`, `claims`, `evidence_records`, `_prisma_migrations`) are created and healthy.
- **Consistent Prisma CLI Scripts:** Standardized `prisma:generate`, `prisma:validate`, `prisma:migrate:dev`, and `prisma:migrate:status` across `apps/api` and root `package.json`.
- **Live Database Readiness:** Verified via `prisma.service.spec.ts` that live database connection, safe query execution, and secret masking operate as expected.
- **Production Identity Protection:** Hardened `AuthGuard` to reject development identity headers (`x-user-id`) in production environments.
- **Light-First Default Theme:** Verified with tests that first visits default to light theme even if the operating system reports `prefers-color-scheme: dark`.

---

## 3. Technical Boundaries & Deferred Work

- **Live GitHub App Registration:** Development operates in mock sandbox mode by default (`MockGitHubClient`). Live App registration and webhook configuration are scheduled for team setup in Sprint 3. Manual registration steps are documented in `README.md`.
- **Full Ingestion Pipeline:** Syncing historical commits, unified diff hunks, PR discussions, and issue trees will be implemented in Sprint 3 using BullMQ and Redis.
- **Hybrid Retrieval & Vector Indexing:** BM25 full-text indexing and `pgvector` dense embeddings will be built in Sprint 4.
