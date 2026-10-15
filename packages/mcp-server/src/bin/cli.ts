#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTracebackMcpServer } from "../server";
import { loadConfig } from "../config";

// Route all standard logs to stderr so stdout remains exclusively clean JSON-RPC for MCP clients
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  console.error("[traceback-mcp]", ...args);
};

async function main() {
  const config = loadConfig();

  // Diagnostics to stderr
  console.error("[traceback-mcp] Starting Traceback MCP server v0.1.0...");
  console.error(`[traceback-mcp] Backend target API: ${config.apiUrl}`);
  if (config.apiToken) {
    console.error("[traceback-mcp] Authentication token configured (present in environment).");
  } else {
    console.error("[traceback-mcp] Warning: TRACEBACK_API_TOKEN is not set. Tools will require explicit apiToken argument.");
  }

  const server = createTracebackMcpServer({ config });
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    console.error("[traceback-mcp] Received SIGINT, shutting down...");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("[traceback-mcp] Received SIGTERM, shutting down...");
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error("[traceback-mcp] Server successfully connected to stdio transport and ready for requests.");
}

main().catch((err) => {
  console.error("[traceback-mcp] Fatal server startup error:", err);
  process.exit(1);
});
