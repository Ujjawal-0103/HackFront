import {
  VerificationSessionResult,
  EvidenceSearchResponse,
  CheckChangeAgainstDecisionsResponse,
  CheckChangeAgainstDecisionsRequest,
} from "@traceback/shared-types";
import { McpServerConfig, loadConfig } from "./config";

export class McpClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
  ) {
    // Sanitize any potential token from error message
    const sanitizedMessage = message
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
      .replace(/(?:tb_token_|traceback_token_)[a-zA-Z0-9_\-\.]+/gi, "[REDACTED_TOKEN]");
    super(sanitizedMessage);
    this.name = "McpClientError";
  }
}

export class TracebackApiClient {
  private config: McpServerConfig;

  constructor(configOverrides?: Partial<McpServerConfig>) {
    this.config = loadConfig(configOverrides);
  }

  public setToken(token: string): void {
    this.config.apiToken = token;
  }

  private resolveToken(): string {
    const token = this.config.apiToken;
    if (!token) {
      throw new McpClientError(
        "Authentication required: TRACEBACK_API_TOKEN is not configured on the MCP server. " +
          "Configure TRACEBACK_API_TOKEN in the server environment or client launcher configuration.",
        401,
        "UNAUTHENTICATED",
      );
    }
    return token;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      workspaceId?: string;
    } = {},
  ): Promise<T> {
    const token = this.resolveToken();
    const url = `${this.config.apiUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    if (options.workspaceId) {
      headers["x-workspace-id"] = options.workspaceId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetail = "";
        try {
          const json = await response.json();
          errorDetail = json.message || json.error || "";
        } catch {
          errorDetail = await response.text().catch(() => "");
        }

        // Sanitize error detail to prevent any internal credential leakage
        errorDetail = errorDetail
          .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
          .replace(/(?:tb_token_|traceback_token_)[a-zA-Z0-9_\-\.]+/gi, "[REDACTED_TOKEN]");

        if (response.status === 401) {
          throw new McpClientError(
            `Authentication failed: ${errorDetail || "Invalid or expired session token"}`,
            401,
            "UNAUTHORIZED",
          );
        }

        if (response.status === 403) {
          throw new McpClientError(
            `Access denied: ${errorDetail || "You do not have permission to access this workspace or repository"}`,
            403,
            "FORBIDDEN",
          );
        }

        if (response.status === 404) {
          throw new McpClientError(
            `Resource not found: ${errorDetail || "The requested repository, session, or workspace does not exist"}`,
            404,
            "NOT_FOUND",
          );
        }

        throw new McpClientError(
          `Traceback API error (${response.status}): ${errorDetail || response.statusText}`,
          response.status,
          "API_ERROR",
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof McpClientError) {
        throw err;
      }
      if (err.name === "AbortError") {
        throw new McpClientError(
          `Request to Traceback API timed out after ${this.config.requestTimeoutMs}ms`,
          504,
          "GATEWAY_TIMEOUT",
        );
      }
      throw new McpClientError(
        `Failed to communicate with Traceback API at ${this.config.apiUrl}: ${err.message || String(err)}`,
        503,
        "SERVICE_UNAVAILABLE",
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verify an AI-generated code explanation against repository evidence.
   */
  async verifyExplanation(params: {
    workspaceId: string;
    repositoryId: string;
    explanation: string;
    codeSnippet?: string;
    targetFilePath?: string;
    targetSymbol?: string;
    maxClaims?: number;
  }): Promise<VerificationSessionResult> {
    return this.request<VerificationSessionResult>(
      `workspaces/${encodeURIComponent(params.workspaceId)}/repositories/${encodeURIComponent(params.repositoryId)}/verify`,
      {
        method: "POST",
        workspaceId: params.workspaceId,
        body: {
          explanation: params.explanation,
          codeSnippet: params.codeSnippet,
          targetFilePath: params.targetFilePath,
          targetSymbol: params.targetSymbol,
          maxClaims: params.maxClaims,
        },
      },
    );
  }

  /**
   * Search historical repository evidence (commits, PRs, issues, ADRs, test records).
   */
  async searchEvidence(params: {
    workspaceId: string;
    repositoryId: string;
    query: string;
    filePath?: string;
    sourceTypes?: string[];
    limit?: number;
    offset?: number;
    includeGraph?: boolean;
  }): Promise<EvidenceSearchResponse> {
    return this.request<EvidenceSearchResponse>(
      `workspaces/${encodeURIComponent(params.workspaceId)}/repositories/${encodeURIComponent(params.repositoryId)}/evidence/search`,
      {
        method: "POST",
        workspaceId: params.workspaceId,
        body: {
          query: params.query,
          filePath: params.filePath,
          sourceTypes: params.sourceTypes,
          limit: params.limit,
          offset: params.offset,
          includeGraph: params.includeGraph ?? true,
        },
      },
    );
  }

  /**
   * Check a proposed code change or diff against historical engineering decisions (ADRs, reverts, tests).
   */
  async checkChangeAgainstDecisions(params: {
    workspaceId: string;
    repositoryId: string;
    diff?: string;
    changeDescription?: string;
    targetFilePaths?: string[];
    pullRequestId?: string;
  }): Promise<CheckChangeAgainstDecisionsResponse> {
    const payload: CheckChangeAgainstDecisionsRequest = {
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      diff: params.diff,
      changeDescription: params.changeDescription,
      targetFilePaths: params.targetFilePaths,
      pullRequestId: params.pullRequestId,
    };

    return this.request<CheckChangeAgainstDecisionsResponse>(
      `workspaces/${encodeURIComponent(params.workspaceId)}/repositories/${encodeURIComponent(params.repositoryId)}/advisory/check-change`,
      {
        method: "POST",
        workspaceId: params.workspaceId,
        body: payload,
      },
    );
  }

  /**
   * Retrieve engineering decisions for a repository.
   */
  async getEngineeringDecisions(params: {
    workspaceId: string;
    repositoryId: string;
    status?: any;
  }): Promise<any[]> {
    const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.request<any[]>(
      `workspaces/${encodeURIComponent(params.workspaceId)}/repositories/${encodeURIComponent(params.repositoryId)}/decisions${qs}`,
      {
        method: "GET",
        workspaceId: params.workspaceId,
      },
    );
  }

  /**
   * Propose a candidate engineering decision.
   */
  async proposeEngineeringDecision(params: {
    workspaceId: string;
    repositoryId: string;
    title: string;
    summary: string;
    decision: string;
    rationale: string;
    targetFilePath?: string;
    targetSymbol?: string;
    severity?: string;
    supportingEvidence?: any[];
  }): Promise<any> {
    return this.request<any>(
      `workspaces/${encodeURIComponent(params.workspaceId)}/repositories/${encodeURIComponent(params.repositoryId)}/decisions`,
      {
        method: "POST",
        workspaceId: params.workspaceId,
        body: {
          title: params.title,
          summary: params.summary,
          decision: params.decision,
          rationale: params.rationale,
          targetFilePath: params.targetFilePath,
          targetSymbol: params.targetSymbol,
          severity: params.severity || "MEDIUM",
          status: "CANDIDATE",
          supportingEvidence: params.supportingEvidence || [],
        },
      },
    );
  }
}

