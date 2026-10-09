# ADR-001: Repository and Workspace Structure

- **Identifier:** ADR-001
- **Title:** Adoption of Turborepo Monorepo Structure
- **Status:** Accepted (Provisional)
- **Date:** 2026-10-09

## Context

Traceback requires a frontend interface for claim review, a backend service for repository ingestion and retrieval, shared domain models (types for claims, evidence records, verdicts), and a planned MCP server tool. We need a repository organisation that promotes code sharing while maintaining clear separation of concerns.

## Options Considered

1. **Multi-Repo Architecture:** Separate git repositories for frontend, backend, and MCP server.
2. **Polyrepo / Single Monolithic Service:** Single Node.js application serving both HTML and API endpoints (similar to starter prototype).
3. **Monorepo with Turborepo:** Unified repository containing `apps/web`, `apps/api`, `packages/shared-types`, and `packages/mcp-server`.

## Decision Criteria

- Ability to share TypeScript types for verification reports and claims without private NPM packages.
- Build caching and fast CI/CD execution.
- Maintainability for a small engineering team (5 members).

## Decision & Consequences

Adopt a Turborepo monorepo structure.

- **Consequences:** Team members can work across frontend and backend in a unified workspace. Shared types enforce consistency across verification report schemas.

## Trade-offs

- Slight tooling overhead for workspace configuration (pnpm/turborepo).

## Security Implications

- Must ensure workspace boundaries do not allow server-only environment variables or private API tokens to leak into client bundles.

## Revisit Conditions

- Revisit if package build times exceed 5 minutes in CI or if team decides to deploy services across decoupled teams.
