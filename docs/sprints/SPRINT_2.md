# Sprint 2 Backlog & Delivery Ledger: Project Foundation and Secure Access

> **Sprint Objective:** Scaffold a reproducible Turborepo monorepo, runnable Next.js frontend, runnable NestJS backend, shared TypeScript types, PostgreSQL and Prisma foundation, secure GitHub integration boundary, multi-tenant workspace isolation, CI pipeline, and a functional light-first theme system.  
> **Status:** **Completed** | Last Updated: 2026-10-09

---

## 1. Sprint 2 Task Delivery Matrix

| Task ID   | Task Description                             | Owner (Provisional) | Deliverables                                                              | Verification Method                                                        | Status   |
| :-------- | :------------------------------------------- | :------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------------- | :------- |
| **S2-01** | Turborepo Workspace Configuration            | Ujjawal Agrawal     | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | `pnpm install`, Turborepo task pipeline execution                          | **Done** |
| **S2-02** | Shared Domain Contracts                      | Ayush Kushwaha      | `packages/shared-types` (`src/index.ts`, `tsconfig.json`)                 | `pnpm --filter @traceback/shared-types build`                              | **Done** |
| **S2-03** | NestJS Backend Service Scaffolding           | Tanishk Sharma      | `apps/api` (`main.ts`, `app.module.ts`, `config/`, `health/`)             | Unit tests in `health.controller.spec.ts`                                  | **Done** |
| **S2-04** | Readiness Checks & Safe Error Handling       | Tanishk Sharma      | `GET /api/ready`, `ReadinessService`, `HttpExceptionFilter`               | Unit tests in `readiness.service.spec.ts`, `http-exception.filter.spec.ts` | **Done** |
| **S2-05** | Next.js Frontend Scaffolding                 | Tanishka            | `apps/web` (`layout.tsx`, `page.tsx`, `next.config.js`)                   | Next.js production build (`next build`)                                    | **Done** |
| **S2-06** | Light-First Theme System & Tokens            | Tanishka            | `globals.css`, `ThemeContext.tsx`, `ThemeToggle.tsx`                      | Unit tests in `ThemeContext.spec.tsx` (5/5 passed)                         | **Done** |
| **S2-07** | PostgreSQL & Prisma Foundation               | Tanishk Sharma      | `apps/api/prisma/schema.prisma`, `docker-compose.yml`, `PrismaService`    | `prisma generate`, `prisma validate` with schema check                     | **Done** |
| **S2-08** | Multi-Tenant Workspace & Identity Boundaries | Tanishk Sharma      | `AuthGuard`, `WorkspaceGuard`, `WorkspacesController`                     | Unit tests in `workspace.guard.spec.ts`, `auth.guard.spec.ts`              | **Done** |
| **S2-09** | Read-Only GitHub App Integration Boundary    | Ayush Kushwaha      | `IGitHubClient`, `MockGitHubClient`, `GitHubService`, `GitHubController`  | Unit tests in `github.service.spec.ts`                                     | **Done** |
| **S2-10** | CI Pipeline & Quality Automation             | Ujjawal Agrawal     | `.github/workflows/ci.yml`, `.prettierignore`                             | Local execution of format, typecheck, test, and build                      | **Done** |
| **S2-11** | Developer Onboarding & Documentation         | Ujjawal Agrawal     | Updated `README.md`, `docs/sprints/SPRINT_2.md`                           | Documentation review & setup reproduction                                  | **Done** |

---

## 2. Technical Boundaries & Deferred Work

- **Live GitHub App Registration:** Development operates in mock sandbox mode by default (`MockGitHubClient`). Live App registration and webhook configuration are scheduled for team setup in Sprint 3.
- **Full Ingestion Pipeline:** Syncing historical commits, unified diff hunks, PR discussions, and issue trees will be implemented in Sprint 3 using BullMQ and Redis.
- **Hybrid Retrieval & Vector Indexing:** BM25 full-text indexing and `pgvector` dense embeddings will be built in Sprint 4.
