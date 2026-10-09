# ADR-007: GitHub Access and Minimum Permissions

- **Identifier:** ADR-007
- **Title:** GitHub App Integration with Minimum Read-Only Scopes
- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Traceback needs to ingest commit history, pull request discussions, and issue comments from user repositories. Access must be granted securely while maintaining least privilege.

## Options Considered

1. **Personal Access Tokens (PAT):** User pastes a personal token into Traceback.
2. **OAuth App:** User authorizes an OAuth application with broad user/repo scopes.
3. **GitHub App (Selected):** Organization or user installs a scoped GitHub App with granular repository permissions.

## Decision Criteria

- Principle of least privilege.
- Enterprise security compliance and token management.
- Granular permission boundaries (read-only, repo-specific).

## Decision & Consequences

Adopt a GitHub App integration.

- **Requested Scopes (Strictly Read-Only):**
  - `Repository contents`: Read-only (to read commits, diffs, file trees).
  - `Pull requests`: Read-only (to read PR discussions and review comments).
  - `Issues`: Read-only (to read issue descriptions and comments).
  - `Metadata`: Read-only (default).
- **Prohibited Scopes:** Zero write permissions. No administration, workflow, or webhook execution permissions.

## Trade-offs

- Setting up a GitHub App requires slightly more configuration than a simple PAT input, but offers vastly superior security and auditing.

## Security Implications

- Tokens are ephemeral installation tokens (valid for 1 hour); private keys are secured in environment secrets and never committed.

## Revisit Conditions

- None expected for V1.
