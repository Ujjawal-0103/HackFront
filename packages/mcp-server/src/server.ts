import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TracebackApiClient } from "./client";
import { McpServerConfig, loadConfig } from "./config";
import {
  verifyExplanationSchema,
  handleVerifyExplanation,
} from "./tools/verify-explanation";
import {
  findHistoricalContextSchema,
  handleFindHistoricalContext,
} from "./tools/find-historical-context";
import {
  checkChangeAgainstDecisionsSchema,
  handleCheckChangeAgainstDecisions,
} from "./tools/check-change-against-decisions";

export interface CreateMcpServerOptions {
  client?: TracebackApiClient;
  config?: Partial<McpServerConfig>;
}

export function createTracebackMcpServer(options: CreateMcpServerOptions = {}): McpServer {
  const config = loadConfig(options.config);
  const client = options.client || new TracebackApiClient(config);

  const server = new McpServer(
    {
      name: "traceback-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // 1. Tool: verify_explanation
  server.tool(
    "verify_explanation",
    "Submit an AI-generated code explanation for evidence-grounded verification against repository engineering history (commits, PRs, issues, ADRs).",
    verifyExplanationSchema,
    async (args) => handleVerifyExplanation(args, client),
  );

  // 2. Tool: find_historical_context
  server.tool(
    "find_historical_context",
    "Search historical repository evidence (commits, PRs, issues, ADRs, test records) to understand why existing code was built in a certain way.",
    findHistoricalContextSchema,
    async (args) => handleFindHistoricalContext(args, client),
  );

  // 3. Tool: check_change_against_decisions
  server.tool(
    "check_change_against_decisions",
    "Advisory check of a proposed code diff or change description against historical engineering decisions, ADRs, past reverts, and tests.",
    checkChangeAgainstDecisionsSchema,
    async (args) => handleCheckChangeAgainstDecisions(args, client),
  );

  return server;
}
