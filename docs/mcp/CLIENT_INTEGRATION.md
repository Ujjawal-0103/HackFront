# Traceback MCP Client Integration & Configuration Guide

> **Protocol Version:** `2024-11-05`  
> **Official SDK:** `@modelcontextprotocol/sdk` v1.32.1  
> **Package:** `@traceback/mcp-server`  
> **Transport:** `stdio` (local subprocess) and HTTP/JSON-RPC (remote)

---

## 1. Overview

Traceback provides a Model Context Protocol (MCP) server that empowers AI coding assistants (such as Claude Desktop, Cursor, and VS Code) to directly access historical engineering rationale, verify explanations against ground-truth repository history, and run advisory checks against recorded architecture decisions (ADRs) and regressions.

### Architectural Principle

The MCP server acts as a bounded, read-only protocol layer that delegates to existing, authenticated Traceback backend services. It does not introduce a secondary verification engine or independent storage.

```
MCP CLIENT (Claude Desktop / Cursor / VS Code)
     │
     │ JSON-RPC over stdio (stderr for logs)
     ▼
TRACEBACK MCP SERVER (@traceback/mcp-server)
     │
     │ Authenticated REST / Bearer Token & Workspace Validation
     ▼
TRACEBACK API (NestJS Backend)
     ├── EvidenceSearchService (PostgreSQL full-text + pgvector + graph)
     ├── VerificationSessionService (claim extraction + assessment)
     └── AdvisoryService (ADR & regression constraint evaluation)
```

---

## 2. Tools Reference

The server registers three official tools conforming to the MCP specification:

### 1. `verify_explanation`

Submits an external AI-generated explanation of code for evidence-grounded verification.

- **Input Schema:**
  - `workspaceId` (string, required): Authorized workspace ID.
  - `repositoryId` (string, required): Repository ID within the workspace.
  - `explanation` (string, required, 5–10,000 chars): Explanation text to verify.
  - `codeSnippet` (string, optional, max 20,000 chars): Code snippet being explained.
  - `targetFilePath` (string, optional): Relevant file path in the repository.
  - `targetSymbol` (string, optional): Function or class name.
  - `maxClaims` (number, optional, 1–10, default 5): Maximum atomic claims to verify.
- **Output:** Bounded JSON containing `status` (`SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`, `MIXED`), confidence score, atomic claims with rationale, validated citations (`referenceKey`, `url`, `sourceType`), and abstention notices.

### 2. `find_historical_context`

Searches historical repository records (commits, PRs, issues, ADRs) without requiring the web UI.

- **Input Schema:**
  - `workspaceId` (string, required): Authorized workspace ID.
  - `repositoryId` (string, required): Repository ID within the workspace.
  - `query` (string, required, 1–500 chars): Natural-language query or technical concept.
  - `filePath` (string, optional): Focus search on a particular file path.
  - `sourceTypes` (string[], optional): Filter by `COMMIT`, `PULL_REQUEST`, `ISSUE`, `ADR`.
  - `limit` (number, optional, 1–20, default 5): Maximum sources to return.
  - `includeGraph` (boolean, optional, default true): Include graph relationships (falls back to PostgreSQL if Neo4j is offline).
- **Output:** Bounded list of canonical sources with excerpts (max 500 characters), verified URLs, author, timestamp, and match explanations.

### 3. `check_change_against_decisions`

Evaluates a proposed code diff or change description against historical engineering constraints, recorded ADRs, and past bug fixes.

- **Input Schema:**
  - `workspaceId` (string, required): Authorized workspace ID.
  - `repositoryId` (string, required): Repository ID within the workspace.
  - `diff` (string, optional, max 20,000 chars): Proposed patch or unified diff.
  - `changeDescription` (string, optional, max 5,000 chars): Summary of the change.
  - `targetFilePaths` (string[], optional): Modified file paths.
  - `pullRequestId` (string, optional): Pull request identifier.
- **Output:** Advisory report with `advisoryStatus` (`NO_CONFLICT_DETECTED`, `POTENTIAL_RISK`, `CONFLICT_DETECTED`, `INSUFFICIENT_EVIDENCE`), identified conflicts with severity (`HIGH`, `MEDIUM`, `LOW`), supporting evidence citations, and recommended actions.
- **SAFETY INVARIANT:** Advisory only. Traceback never modifies source code, commits changes, or blocks merges automatically.

> **Security Rule (Sprint 8):** Tool input schemas do NOT accept bearer tokens or credentials. Models cannot supply or override API credentials through tool parameters. Credentials must be configured exclusively in the MCP server process environment (`TRACEBACK_API_TOKEN`).

- **Input Schema:**
  - `workspaceId` (string, required): Authorized workspace ID.
  - `repositoryId` (string, required): Repository ID within the workspace.
  - `diff` (string, optional, max 20,000 chars): Proposed patch or unified diff.
  - `changeDescription` (string, optional, max 5,000 chars): Summary of the change.
  - `targetFilePaths` (string[], optional): Modified file paths.
  - `pullRequestId` (string, optional): Pull request identifier.
- **Output:** Advisory report with `advisoryStatus` (`NO_CONFLICT_DETECTED`, `POTENTIAL_RISK`, `CONFLICT_DETECTED`, `INSUFFICIENT_EVIDENCE`), identified conflicts with severity (`HIGH`, `MEDIUM`, `LOW`), supporting evidence citations, and recommended actions.
- **SAFETY INVARIANT:** Advisory only. Traceback never modifies source code, commits changes, or blocks merges automatically.

---

## 3. Client Configuration

### 3.1 Claude Desktop

Add the server to your `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "traceback": {
      "command": "node",
      "args": ["C:\\Users\\Ujjaw\\HackFront\\packages\\mcp-server\\dist\\bin\\cli.js"],
      "env": {
        "TRACEBACK_API_URL": "http://localhost:3001/api",
        "TRACEBACK_API_TOKEN": "tb_token_usr_verified_123_prod",
        "TRACEBACK_WORKSPACE_ID": "ws_alpha"
      }
    }
  }
}
```

> **Security Tip:** Never commit `claude_desktop_config.json` with live production tokens into public repositories. Use local environment variables or credential managers.

### 3.2 Cursor

In Cursor, open Settings -> Features -> MCP Servers -> Add New MCP Server:

- **Name:** `traceback`
- **Type:** `command`
- **Command:** `node C:\Users\Ujjaw\HackFront\packages\mcp-server\dist\bin\cli.js`

Or in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "traceback": {
      "command": "node",
      "args": ["packages/mcp-server/dist/bin/cli.js"],
      "env": {
        "TRACEBACK_API_URL": "http://localhost:3001/api",
        "TRACEBACK_API_TOKEN": "tb_token_usr_verified_123_prod"
      }
    }
  }
}
```

### 3.3 VS Code (Roo Code / Continue)

In your extension configuration (`mcpSettings.json`):

```json
{
  "mcpServers": {
    "traceback": {
      "command": "node",
      "args": ["${workspaceFolder}/packages/mcp-server/dist/bin/cli.js"],
      "env": {
        "TRACEBACK_API_URL": "http://localhost:3001/api",
        "TRACEBACK_API_TOKEN": "${env:TRACEBACK_API_TOKEN}"
      }
    }
  }
}
```

---

## 4. Environment Variables

| Variable                       | Required    | Default                     | Description                                     |
| ------------------------------ | ----------- | --------------------------- | ----------------------------------------------- |
| `TRACEBACK_API_URL`            | No          | `http://localhost:3001/api` | Target Traceback REST API base endpoint         |
| `TRACEBACK_API_TOKEN`          | Recommended | `undefined`                 | User session token for workspace authentication |
| `TRACEBACK_WORKSPACE_ID`       | No          | `undefined`                 | Default workspace context                       |
| `TRACEBACK_REQUEST_TIMEOUT_MS` | No          | `15000`                     | HTTP request timeout in milliseconds            |

---

## 5. Security & Prompt-Injection Safeguards

1. **Strict Stdio Separation:** In `stdio` transport mode, `stdout` is reserved exclusively for clean JSON-RPC protocol frames. All diagnostic logs and error notices are written to `stderr` to prevent protocol framing corruption.
2. **Untrusted Evidence Isolation:** Repository content (commit messages, issue bodies, ADR text, and diffs) is treated as untrusted data. Diffs are stripped of API secrets via regex redactor and enclosed within `<untrusted_diff>` delimiter tags.
3. **No Execution Capability:** The MCP server is strictly read-only and provides no shell, evaluation, or write tools to LLMs.
4. **Server-Side Authorization:** Every tool call enforces `AuthGuard` (valid session token) and `WorkspaceGuard` (membership verification). Cross-workspace access attempts immediately return HTTP 403 Forbidden.
5. **Bounded Outputs:** Results are truncated to bounded sizes (max 500 chars per source excerpt, max 20 sources, max 20,000 char diffs) to prevent context exhaustion attacks.

---

## 6. Troubleshooting

- **Server fails to start or client reports parse error:**
  Verify that no console logging is writing to `stdout`. Test directly with:

  ```bash
  node packages/mcp-server/dist/bin/cli.js
  ```

  Only stderr lines should be visible; stdout should produce nothing until a JSON-RPC message is sent to stdin.

- **Authentication Error (`UNAUTHENTICATED` / 401):**
  Ensure `TRACEBACK_API_TOKEN` is set in your client's environment, or pass `apiToken` explicitly in the tool arguments.

- **Cross-Workspace Access Denied (`FORBIDDEN` / 403):**
  Ensure the authenticated user has membership in the requested `workspaceId`.
