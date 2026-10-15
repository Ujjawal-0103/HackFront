import { z } from "zod";
import { TracebackApiClient } from "../client";
import {
  HistoricalContextMcpResponse,
  HistoricalContextMcpItem,
} from "@traceback/shared-types";

export const findHistoricalContextSchema = {
  workspaceId: z.string().min(1).describe("Authorized workspace ID"),
  repositoryId: z.string().min(1).describe("Authorized repository ID"),
  query: z
    .string()
    .min(1, "Search query cannot be empty")
    .max(500, "Search query exceeds 500 character maximum")
    .describe("Natural language query or code concept to find historical context for"),
  filePath: z
    .string()
    .max(500)
    .optional()
    .describe("Optional repository file path to constrain search"),
  sourceTypes: z
    .array(z.string())
    .optional()
    .describe("Optional source type filter: COMMIT, PULL_REQUEST, ISSUE, ADR"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Maximum number of records to return (default: 5, max: 20)"),
  includeGraph: z
    .boolean()
    .optional()
    .describe("Whether to include graph expansion relationships (falls back to PostgreSQL if unavailable)"),
};

export async function handleFindHistoricalContext(
  args: z.infer<z.ZodObject<typeof findHistoricalContextSchema>>,
  client: TracebackApiClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const searchResponse = await client.searchEvidence({
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      query: args.query,
      filePath: args.filePath,
      sourceTypes: args.sourceTypes,
      limit: args.limit ?? 5,
      includeGraph: args.includeGraph ?? true,
    });

    const sources: HistoricalContextMcpItem[] = (searchResponse.items || []).map((item) => {
      const source = item.source;
      const snippet = (source.snippet || "").trim();
      const boundedSnippet =
        snippet.length > 500 ? snippet.substring(0, 497) + "..." : snippet;

      return {
        sourceId: source.id,
        sourceType: source.sourceType,
        referenceKey: source.referenceKey,
        title: source.title || "Untitled Record",
        author: source.author || "Unknown",
        timestamp: source.recordedAt || new Date().toISOString(),
        url: source.url || "",
        excerpt: boundedSnippet,
        relevanceScore: item.score ?? 0,
        matchReasons: item.matchReasons || [],
      };
    });

    const responsePayload: HistoricalContextMcpResponse = {
      repositoryId: args.repositoryId,
      query: args.query,
      totalMatches: searchResponse.totalCount ?? sources.length,
      sources,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(responsePayload, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const errorPayload = {
      error: true,
      message: error.message || "Failed to find historical context",
      code: error.code || "SEARCH_ERROR",
      statusCode: error.statusCode || 500,
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorPayload, null, 2),
        },
      ],
    };
  }
}
