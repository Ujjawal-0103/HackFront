# Traceback Dependency Management & Vulnerability Handling Policy

> **Sprint:** Sprint 9 — Production Readiness & Release Hardening  
> **Status:** Active Engineering Policy  
> **Last Audited:** 2026-10-18

---

## 1. Objectives & Principles

Traceback is a verification system that analyzes code and engineering evidence. Its integrity depends directly on:

1. **Supply Chain Security:** Strictly vetting third-party dependencies across all monorepo workspaces (`apps/*`, `packages/*`).
2. **Deterministic & Minimal Upgrades:** Preferring the smallest compatible semantic patches rather than blindly applying destructive major upgrades (`npm audit fix --force`).
3. **Attack Surface Reachability:** Evaluating vulnerabilities according to whether vulnerable functions are actually reachable in Traceback's execution model.
4. **Radical Honesty:** Never suppressing findings merely to show a zero count without resolving or justifying the underlying risk.

---

## 2. Audit Procedures

### 2.1 Standard Automated Audits

To inspect repository-wide dependencies for vulnerabilities, execute from the repository root:

```bash
# Baseline check (warns on high and critical vulnerabilities)
npm audit --audit-level=high

# Full severity scan across all packages
npm audit

# Structured JSON export for CI ingestion and tooling
npm audit --json > audit_report.json
```

### 2.2 Workspace-Level Audits

Individual workspaces can be audited directly when isolating package boundaries:

```bash
# API Backend workspace audit
npm audit --workspace=@traceback/api

# Web Frontend workspace audit
npm audit --workspace=@traceback/web

# MCP Server package audit
npm audit --workspace=@traceback/mcp-server
```

---

## 3. Vulnerability Evaluation & Reachability Framework

When a dependency vulnerability is reported, engineers evaluate it against four criteria:

| Evaluation Dimension         | Questions to Answer                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **1. Dependency Path**       | Is the package a direct runtime dependency, a transitive runtime dependency, or a build-time/test-only `devDependency`?       |
| **2. Reachability**          | Does Traceback invoke or expose the vulnerable method or codepath with untrusted user input?                                  |
| **3. Mitigation Boundary**   | Do existing input validation (e.g. Zod schemas, class-validator pipes, diff sanitization) prevent exploit triggering?         |
| **4. Upgrade Compatibility** | Does an official patch exist within the current major semver range, or does upgrading require breaking major version changes? |

---

## 4. Current Audit Findings & Remediation Analysis (Sprint 9 Audit)

Execution of `npm audit --audit-level=high` identified **68 vulnerabilities** (1 critical, 46 high, 17 moderate, 4 low). The table below details every affected package, its dependency path, reachability evaluation, and status:

| Package                           | Affected Range     | Path / Workspace                        | Direct / Transitive  | Severity        | Reachable in Traceback? | Remediation & Technical Justification                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ------------------ | --------------------------------------- | -------------------- | --------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **next**                          | `9.3.4 - 16.3.0`   | `apps/web`                              | **Direct**           | Critical / High | **NO** (Mitigated)      | Next.js advisories (GHSA-9g9p-9gw9-jx7f, GHSA-2xp9-vwfh-vxw4, etc.) target Image Optimization with untrusted remote patterns and Server Actions on custom servers. Traceback uses standard App Router static generation and deterministic API client calls without remote image optimization or untrusted Server Action payloads. Updating to `next@16.4.2` is a major breaking change requiring React 19 and deep routing refactors. Maintained on latest stable `14.2.35`. |
| **multer**                        | `<=2.2.0`          | `@nestjs/platform-express` (`apps/api`) | **Transitive**       | High            | **NO**                  | Multer DoS advisories (GHSA-v52c-386h-88mc, GHSA-5528-5vmv-3xc2, etc.) involve multipart file upload processing. Traceback API endpoints accept exclusively JSON payloads (`application/json`) with strict body size limits. No multipart file upload endpoints exist. Upgrading requires `@nestjs/platform-express@12`, a major breaking upgrade across all `@nestjs/*` v10 packages.                                                                                       |
| **picomatch**                     | `4.0.0 - 4.0.3`    | `@nestjs/cli` -> build tools            | **Transitive (Dev)** | High            | **NO**                  | ReDoS in extglob quantifiers. Used solely during local TypeScript compilation / build-time file watching by Nest CLI. Never executes in production runtime or handles user input.                                                                                                                                                                                                                                                                                            |
| **postcss**                       | `<=8.5.22`         | `next` -> CSS compilation               | **Transitive (Dev)** | High            | **NO**                  | Source map path traversal and style injection during CSS compilation. Traceback uses vanilla CSS and App Router CSS modules without attacker-controlled source maps. Build-time only.                                                                                                                                                                                                                                                                                        |
| **tmp**                           | `<=0.2.5`          | `@nestjs/cli` -> `inquirer`             | **Transitive (Dev)** | High            | **NO**                  | Path traversal in temporary file prefix/postfix. Used solely in interactive CLI scaffolding prompts during code generation. Never present in runtime server.                                                                                                                                                                                                                                                                                                                 |
| **webpack**                       | `5.49.0 - 5.104.0` | `@nestjs/cli` -> build pipeline         | **Transitive (Dev)** | Low             | **NO**                  | `buildHttp` URL userinfo SSRF bypass. Traceback does not use Webpack `buildHttp` plugin to fetch remote modules at build time. Build-time only.                                                                                                                                                                                                                                                                                                                              |
| **expect / micromatch / braces**  | `*`                | `jest` (Root / Dev)                     | **Transitive (Dev)** | High            | **NO**                  | Regular expression DoS in glob matching within test runner. Executed exclusively inside local and CI test environments. Never deployed to production.                                                                                                                                                                                                                                                                                                                        |
| **sprintf-js / js-yaml**          | `*`                | `@istanbuljs/load-nyc-config` (Dev)     | **Transitive (Dev)** | Moderate        | **NO**                  | DoS in test coverage reporter config parser. Development/test tool only.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **lodash**                        | `<=4.17.23`        | `@nestjs/config` (`apps/api`)           | **Transitive**       | High            | **NO** (Mitigated)      | Prototype pollution in `_.template`, `_.unset`, `_.omit`. Traceback uses `@nestjs/config` exclusively with typed environment variables and never exposes lodash methods to user input.                                                                                                                                                                                                                                                                                       |
| **qs**                            | `2.2.5 - 6.15.3`   | Express query parser                    | **Transitive**       | Moderate        | **NO**                  | DoS on null/undefined entries in comma format arrays. Express query parser is bypassed by NestJS strict DTO validation pipes with `forbidNonWhitelisted: true`.                                                                                                                                                                                                                                                                                                              |
| **@prisma/config / deepmerge-ts** | `*`                | `prisma` CLI (Dev)                      | **Transitive (Dev)** | High            | **NO**                  | Prototype pollution in config deep merger during schema validation. Tooling only.                                                                                                                                                                                                                                                                                                                                                                                            |

---

## 5. Dependency Upgrade Policy

1. **Patch Updates:** Non-breaking semver patch updates (`~x.y.z`) are tested in CI and merged when all quality gates pass.
2. **Minor Updates:** Minor updates (`^x.y.0`) are tested across all workspaces to verify absence of regressions in shared types, API controllers, and frontend routes.
3. **Major Updates:** Major version bumps (e.g., NestJS 10 -> 12, Next.js 14 -> 16, React 18 -> 19) require:
   - Architectural justification and sprint milestone allocation.
   - Comprehensive end-to-end regression validation.
   - Verification that no breaking API changes affect MCP server or web consumers.
4. **Never Force:** `npm audit fix --force` must never be run blindly in CI or automated hooks.

---

## 6. Unresolved Findings & Waiver Procedure

If a vulnerability cannot safely be remediated without breaking application stability:

1. The finding is documented in this registry with its CVE/GHSA reference.
2. The reachability analysis is verified against code paths.
3. Compensating security controls (input validation, sanitizers, non-root containers) are confirmed.
4. An engineering waiver is logged in the sprint completion report.
