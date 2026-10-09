# ADR-009: MCP Integration Strategy

- **Identifier:** ADR-009
- **Title:** Phased Model Context Protocol (MCP) Server Integration for Compatible Clients
- **Status:** Planned (Sprint 7)
- **Date:** 2026-10-09

## Context
Developers work primarily inside AI-enabled code editors (Cursor, VS Code, Claude Code, Antigravity). The Model Context Protocol (MCP) allows external tools to expose specialized prompts and resources to compliant AI clients. However, premature MCP development before the core verification engine is proven risks wasted effort.

## Options Considered
1. **MCP-First Architecture:** Build Traceback exclusively as an MCP server with no web frontend.
2. **Web-First Architecture:** Build exclusively as a web application.
3. **Phased Hybrid (Selected):** Build and validate the core verification pipeline and web app in Sprints 1–6; implement a read-only MCP tool suite in Sprint 7.

## Decision Criteria
- Rapid user workflow validation via dedicated web UI.
- Long-term interoperability with modern IDEs and agents without vendor lock-in.

## Decision & Consequences
Phase MCP integration to Sprint 7.
- **MCP Tool Suite Specifications (Read-Only):**
  - `traceback_query_rationale`: Queries repository evidence for a given code symbol or claim.
  - `traceback_verify_explanation`: Decomposes an explanation and returns preliminary evidence matches.
  - `traceback_get_adrs`: Fetches recorded architectural decisions.

## Trade-offs
- In-editor users must wait until Sprint 7 to access direct MCP integration.

## Security Implications
- MCP server must enforce strict token authentication and read-only isolation; local MCP process cannot execute shell commands or write to disk.

## Revisit Conditions
- May be prioritized earlier if human interview findings indicate overwhelming developer demand for in-editor tools over web workflows.
