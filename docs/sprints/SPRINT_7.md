# Sprint 7: MCP Interoperability & Advisory Change Checks — Completion Report

> **Sprint:** Sprint 7 — MCP Interoperability & Advisory Change Checks  
> **Status:** Completed & Verified  
> **Branch:** `feat/authentication-authorization`  
> **Date:** 2026-10-15  

---

## 1. Executive Summary

Sprint 7 delivers standard Model Context Protocol (MCP) interoperability for Traceback, enabling AI coding assistants (Claude Desktop, Cursor, VS Code) to interact with Traceback as a verification authority.

Rather than building an isolated secondary engine, the MCP server (`@traceback/mcp-server`) integrates cleanly with existing backend services (`EvidenceSearchService`, `VerificationSessionService`, and the newly created `AdvisoryService`), ensuring unified authentication, workspace isolation, epistemological integrity, and bounded outputs.

### Key Capabilities Delivered:

1. **Official MCP SDK Server (`@modelcontextprotocol/sdk` v1.32.1):** Complies with the `2024-11-05` protocol specification, supporting both local `stdio` subprocess transport and in-memory test harnesses.
2. **`verify_explanation` Tool:** Submits AI explanations for evidence-grounded verification, decomposes claims, matches canonical repository records, and returns structured grounding assessments (`SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`, `MIXED`) with verified citations.
3. **`find_historical_context` Tool:** Performs hybrid evidence retrieval (PostgreSQL full-text + pgvector + graph expansion) over commits, PRs, issues, and ADRs without needing the web UI.
4. **`check_change_against_decisions` Tool:** Evaluates proposed unified diffs or change descriptions against recorded historical decisions, ADRs, and past regressions.
5. **Strict Advisory Safety Boundary:** Enforces read-only behavior; the MCP server cannot approve/reject PRs, modify source files, execute code, commit, or merge branches.
6. **Prompt-Injection Protections:** Sanitizes untrusted repository text and diffs, redacts API tokens, and wraps diffs in `<untrusted_diff>` delimiter blocks.
7. **Client Configuration Guide:** Created comprehensive setup documentation for Claude Desktop, Cursor, and VS Code.

---

## 2. Architecture & Subsystem Organization

```
MCP CLIENT (Claude Desktop / Cursor / VS Code)
     │
     │ JSON-RPC (stdio transport; stderr for diagnostics)
     ▼
@traceback/mcp-server
     │
     ├── tools/verify-explanation.ts
     ├── tools/find-historical-context.ts
     └── tools/check-change-against-decisions.ts
     │
     │ TracebackApiClient (HTTP Bearer token, x-workspace-id header)
     ▼
@traceback/api (NestJS Backend)
     ├── AuthGuard & WorkspaceGuard (RBAC & multi-tenant isolation)
     ├── AdvisoryService & AdvisoryController (Sprint 7 engine)
     ├── VerificationSessionService & ClaimExtractorService
     └── EvidenceSearchService (hybrid PostgreSQL + Neo4j fallback)
```

---

## 3. Tool Specifications & Contracts

### 3.1 `verify_explanation`
- **Purpose:** Verifies AI-generated explanations of code against ingested engineering records.
- **Contract:** Input schema validated via Zod (`workspaceId`, `repositoryId`, `explanation`, optional `codeSnippet`, `targetFilePath`, `targetSymbol`, `maxClaims`).
- **Grounding Epistemology:**
  - `SUPPORTED`: High-confidence historical evidence corroborates the explanation.
  - `CONTRADICTED`: Historical commits/ADRs directly refute the explanation.
  - `INSUFFICIENT_EVIDENCE`: No matching records found (clearly annotated with abstention notice; absence of evidence != falsehood).
  - `MIXED`: Partial corroboration with some unverified or refuted claims.

### 3.2 `find_historical_context`
- **Purpose:** Fast contextual retrieval of historical engineering records for coding assistants.
- **Contract:** Input schema validated via Zod (`workspaceId`, `repositoryId`, `query`, optional `filePath`, `sourceTypes`, `limit`, `includeGraph`).
- **Resilience:** If Neo4j graph cluster is unreachable, automatically falls back to PostgreSQL full-text retrieval without failing the request (ADR-005). Excerpts bounded to 500 characters.

### 3.3 `check_change_against_decisions`
- **Purpose:** Advisory evaluation of proposed diffs against past engineering decisions.
- **Contract:** Evaluates mutex removals (concurrency hazards), disabled auth guards (security regressions), re-introduced reverted code, and architectural constraints documented in ADRs.
- **Safety Invariant:** Read-only advisory findings with documented severity bases (`HIGH`, `MEDIUM`, `LOW`).

---

## 4. Security & Safety Evaluation

| Control | Implementation | Verification |
|---|---|---|
| **Stdio Channel Separation** | `stdout` reserved strictly for JSON-RPC; `console.log` redirected to `stderr`. | Verified with child_process stdio pipe tests. |
| **Authentication & RBAC** | `AuthGuard` verifies session tokens; `WorkspaceGuard` enforces workspace membership. | Tested 401 unauthenticated and 403 cross-workspace rejection. |
| **Prompt Injection Protection** | Diffs and repo text wrapped in `<untrusted_diff>`, secret credentials redacted, instruction directives neutralized. | Adversarial test suite passed with injected overrides. |
| **Read-Only Invariant** | No tool has write capability. No git mutation, PR approval, or file update tools exist. | Verified statically and dynamically across all tool schemas. |
| **Input/Output Bounding** | Diffs capped at 20,000 chars, explanations at 10,000 chars, excerpts at 500 chars, queries at 500 chars. | Zod boundary validation tests passed. |

---

## 5. Test Execution & Quality Gate Results

### 5.1 MCP Protocol & Integration Tests (`@traceback/mcp-server`)
```
PASS src/__tests__/mcp-protocol.spec.ts
  Traceback MCP Protocol Integration
    Tool Discovery
      √ should discover all three official Traceback MCP tools with input schemas (25 ms)
    verify_explanation Tool
      √ should successfully verify explanation and return grounded citations (5 ms)
      √ should return abstention notice when evidence is insufficient (4 ms)
      √ should return structured error when client is unauthenticated (2 ms)
      √ should return structured error when workspace access is forbidden (4 ms)
      √ should reject input when explanation is too short (3 ms)
    find_historical_context Tool
      √ should retrieve historical sources with bounded excerpts and canonical URLs (3 ms)
      √ should handle empty search results gracefully (4 ms)
      √ should reject queries exceeding character limits (2 ms)
    check_change_against_decisions Tool
      √ should identify conflicts with historical decisions and return advisory response (4 ms)
      √ should return NO_CONFLICT_DETECTED when change aligns with history (2 ms)
      √ should reject diff exceeding character limit (2 ms)
      √ should return error when neither diff nor changeDescription is supplied (2 ms)
    Prompt Injection and Adversarial Resistance
      √ should safely evaluate diffs containing prompt injection instructions without executing them (3 ms)

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### 5.2 Real Stdio CLI Protocol Interoperability Test
- **Command:** `node packages/mcp-server/dist/bin/cli.js`
- **Transport:** Standard I/O (stdin/stdout)
- **JSON-RPC Handshake:** Initialized with protocol version `2024-11-05`, returned `serverInfo: { name: "traceback-mcp", version: "0.1.0" }`.
- **Tool Listing:** `tools/list` returned all 3 tools on clean stdout while logs remained on stderr.

### 5.3 Backend Advisory Engine Tests (`apps/api`)
```
PASS src/advisory/advisory.service.spec.ts (6 tests passed)
PASS src/advisory/advisory.controller.spec.ts (3 tests passed)
All API Test Suites: 40 passed, 40 total (334 passed, 334 total)
```

### 5.4 Frontend Web Test Suite (`apps/web`)
```
All Web Test Suites: 10 passed, 10 total (36 passed, 36 total)
```

### 5.5 Production Builds
- `@traceback/shared-types`: Clean build (`tsc -b`)
- `@traceback/mcp-server`: Clean build (`tsc -b`)
- `@traceback/api`: Clean build (`nest build`)
- `@traceback/web`: Clean production build (`next build`)

---

## 6. Acceptance Checklist

- [x] MCP server starts using official SDK and `stdio` transport.
- [x] Tool discovery works through JSON-RPC protocol (`tools/list`).
- [x] `verify_explanation` invokes existing Traceback verification services.
- [x] `find_historical_context` invokes existing evidence search with graph fallback.
- [x] `check_change_against_decisions` returns evidence-backed advisory evaluations.
- [x] Inputs and outputs are strictly validated, sanitized, and bounded.
- [x] Authentication and workspace authorization are enforced server-side.
- [x] Cross-workspace access is denied with 403 Forbidden.
- [x] Prompt-injection cases are handled safely without instruction execution.
- [x] No MCP tool can write to repositories or approve pull requests.
- [x] Optional Neo4j failure falls back to PostgreSQL baseline.
- [x] Existing Sprint 1–6 functionality remains intact and verified.
- [x] Documentation for Claude Desktop, Cursor, and VS Code completed.
- [x] Small conventional commits prepared without remote push.
