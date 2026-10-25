import {
  WorkspaceSummary,
  RepositoryDetailsDto,
  RepositoryActivityDto,
  CreateRepositoryDto,
  GitHubAuthorizedRepositoryDto,
  GitHubIntegrationStatusDto,
  GitHubInstallationSummaryDto,
  ConnectInstallationDto,
  RepositorySyncStatusResponse,
  TriggerSyncResponse,
  EvidenceSearchQuery,
  EvidenceSearchResponse,
  SourceRecordDto,
  ReadinessResponse,
  LoginRequest,
  LoginResponse,
  AuthSessionResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyExplanationRequest,
  VerificationSession,
  SubmitHumanVerdictRequest,
  HumanVerdictHistoryItem,
  VerificationHistoryResponse,
  TracebackReportExport,
  CheckChangeAgainstDecisionsRequest,
  CheckChangeAgainstDecisionsResponse,
  ImportRepositoryByUrlDto,
  ImportRepositoryByUrlResponse,
} from "@traceback/shared-types";

// Ensure the API base URL targets the /api global prefix used by NestJS
const rawBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, "")}/api`;
const DEFAULT_WORKSPACE_ID = "ws_alpha";

let currentAuthToken: string | null = null;
let currentActiveWorkspaceId: string | null = null;

export function setApiAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function setApiActiveWorkspaceId(workspaceId: string | null) {
  currentActiveWorkspaceId = workspaceId;
}

export function getApiActiveWorkspaceId(): string {
  if (currentActiveWorkspaceId) return currentActiveWorkspaceId;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("traceback_active_workspace");
    if (stored) return stored;
  }
  return DEFAULT_WORKSPACE_ID;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = cleanEndpoint.startsWith("/api/")
    ? `${API_BASE_URL.replace(/\/api$/, "")}${cleanEndpoint}`
    : `${API_BASE_URL}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Token resolution
  const token =
    currentAuthToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("traceback_auth_token")
      : null);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Workspace header for contextual metadata
  const activeWsId = getApiActiveWorkspaceId();
  if (!headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", activeWsId);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      let details: unknown = undefined;
      try {
        const errorJson = await res.json();
        const extracted =
          errorJson.error?.message ||
          errorJson.message ||
          (typeof errorJson.error === "string" ? errorJson.error : null);
        if (extracted) {
          errorMsg = Array.isArray(extracted)
            ? extracted.join(", ")
            : extracted;
        }
        details = errorJson;
      } catch {
        // ignore parse error
      }
      throw new ApiError(errorMsg, res.status, details);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError(`Network error connecting to API: ${message}`);
  }
}

export const api = {
  // Authentication & Session
  async register(payload: RegisterRequest): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginRequest = {}): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getSession(): Promise<AuthSessionResponse> {
    return request<AuthSessionResponse>("/auth/session");
  },

  async logout(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>("/auth/logout", {
      method: "POST",
    });
  },

  async forgotPassword(
    payload: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return request<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async resetPassword(
    payload: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    return request<ResetPasswordResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Workspaces
  async getWorkspaces(): Promise<WorkspaceSummary[]> {
    return request<WorkspaceSummary[]>("/workspaces");
  },

  async getWorkspace(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<WorkspaceSummary> {
    return request<WorkspaceSummary>(`/workspaces/${workspaceId}`);
  },

  // Repositories
  async getRepositories(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<RepositoryDetailsDto[]> {
    return request<RepositoryDetailsDto[]>(
      `/workspaces/${workspaceId}/repositories`,
    );
  },

  async getRepository(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<RepositoryDetailsDto> {
    return request<RepositoryDetailsDto>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}`,
    );
  },

  async getGitHubStatus(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<GitHubIntegrationStatusDto> {
    return request<GitHubIntegrationStatusDto>(
      `/workspaces/${workspaceId}/github/status`,
    );
  },

  async getGitHubInstallUrl(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<{ installUrl: string | null; state: string }> {
    return request<{ installUrl: string | null; state: string }>(
      `/workspaces/${workspaceId}/github/install-url`,
    );
  },

  async connectGitHubInstallation(
    workspaceId: string = getApiActiveWorkspaceId(),
    payload: ConnectInstallationDto,
  ): Promise<GitHubInstallationSummaryDto> {
    return request<GitHubInstallationSummaryDto>(
      `/workspaces/${workspaceId}/github/installation`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async disconnectGitHubInstallation(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(
      `/workspaces/${workspaceId}/github/installation`,
      {
        method: "DELETE",
      },
    );
  },

  async getAuthorizedGitHubRepositories(
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<GitHubAuthorizedRepositoryDto[]> {
    return request<GitHubAuthorizedRepositoryDto[]>(
      `/workspaces/${workspaceId}/github/repositories`,
    );
  },

  async createRepository(
    payload: CreateRepositoryDto,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<RepositoryDetailsDto> {
    return request<RepositoryDetailsDto>(
      `/workspaces/${workspaceId}/repositories`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async importRepositoryByUrl(
    payload: ImportRepositoryByUrlDto,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<ImportRepositoryByUrlResponse> {
    return request<ImportRepositoryByUrlResponse>(
      `/workspaces/${workspaceId}/repositories/import-url`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async deleteRepository(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}`,
      {
        method: "DELETE",
      },
    );
  },

  async getRepositoryActivity(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<RepositoryActivityDto> {
    return request<RepositoryActivityDto>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/activity`,
    );
  },

  // Ingestion & Sync
  async getSyncStatus(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<RepositorySyncStatusResponse> {
    return request<RepositorySyncStatusResponse>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/sync`,
    );
  },

  async triggerSync(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<TriggerSyncResponse> {
    return request<TriggerSyncResponse>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/sync`,
      {
        method: "POST",
      },
    );
  },

  // Evidence Retrieval & Projection
  async searchEvidence(
    repositoryId: string,
    query: EvidenceSearchQuery,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<EvidenceSearchResponse> {
    return request<EvidenceSearchResponse>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/evidence/search`,
      {
        method: "POST",
        body: JSON.stringify(query),
      },
    );
  },

  async getSourceRecord(
    repositoryId: string,
    sourceRecordId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<SourceRecordDto> {
    return request<SourceRecordDto>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/evidence/${sourceRecordId}`,
    );
  },

  async projectEvidence(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<{
    repositoryId: string;
    commitsProjected: number;
    pullRequestsProjected: number;
    issuesProjected: number;
    totalProjected: number;
  }> {
    return request<{
      repositoryId: string;
      commitsProjected: number;
      pullRequestsProjected: number;
      issuesProjected: number;
      totalProjected: number;
    }>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/evidence/project`,
      {
        method: "POST",
      },
    );
  },

  // Verification & Human Review (Sprint 5 & 6)
  async verifyExplanation(
    repositoryId: string,
    payload: VerifyExplanationRequest,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async getVerificationSession(
    repositoryId: string,
    sessionId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify/${sessionId}`,
    );
  },

  async recordVerdict(
    repositoryId: string,
    sessionId: string,
    claimId: string,
    payload: SubmitHumanVerdictRequest,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify/${sessionId}/claims/${claimId}/verdict`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async getClaimVerdicts(
    repositoryId: string,
    sessionId: string,
    claimId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<HumanVerdictHistoryItem[]> {
    return request<HumanVerdictHistoryItem[]>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify/${sessionId}/claims/${claimId}/verdicts`,
    );
  },

  async updateClaim(
    repositoryId: string,
    sessionId: string,
    claimId: string,
    text: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify/${sessionId}/claims/${claimId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ text }),
      },
    );
  },

  // Workspace History & Reports
  async getWorkspaceHistory(
    workspaceId: string = getApiActiveWorkspaceId(),
    page: number = 1,
    limit: number = 20,
    repositoryId?: string,
  ): Promise<VerificationHistoryResponse> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (repositoryId) {
      params.set("repositoryId", repositoryId);
    }
    return request<VerificationHistoryResponse>(
      `/workspaces/${workspaceId}/history?${params.toString()}`,
    );
  },

  async getHistoricalSession(
    sessionId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(`/workspaces/${workspaceId}/history/${sessionId}`);
  },

  async exportReport(
    repositoryId: string,
    sessionId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<TracebackReportExport> {
    return request<TracebackReportExport>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/verify/${sessionId}/export`,
    );
  },

  // Advisory Change Checks (Sprint 7)
  async checkChangeAgainstDecisions(
    repositoryId: string,
    payload: CheckChangeAgainstDecisionsRequest,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<CheckChangeAgainstDecisionsResponse> {
    return request<CheckChangeAgainstDecisionsResponse>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/advisory/check-change`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  // Health & Readiness
  async getReadiness(): Promise<ReadinessResponse> {
    return request<ReadinessResponse>("/health/readiness");
  },

  // ============================================================================
  // Sprint 10: Engineering Decision Memory
  // ============================================================================

  async getDecisions(
    repositoryId: string,
    status?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<any[]>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions${qs}`,
    );
  },

  async getDecision(
    repositoryId: string,
    id: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}`,
    );
  },

  async createDecision(
    repositoryId: string,
    payload: any,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async updateDecision(
    repositoryId: string,
    id: string,
    payload: any,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  async acceptDecision(
    repositoryId: string,
    id: string,
    reviewNotes?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}/accept`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNotes }),
      },
    );
  },

  async rejectDecision(
    repositoryId: string,
    id: string,
    reviewNotes?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNotes }),
      },
    );
  },

  async disputeDecision(
    repositoryId: string,
    id: string,
    reviewNotes?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}/dispute`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNotes }),
      },
    );
  },

  async supersedeDecision(
    repositoryId: string,
    id: string,
    supersedesId: string,
    notes?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/${id}/supersede`,
      {
        method: "POST",
        body: JSON.stringify({ supersedesId, notes }),
      },
    );
  },

  async proposeDecisionFromClaim(
    repositoryId: string,
    claimId: string,
    title?: string,
    severity?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/decisions/propose-from-claim`,
      {
        method: "POST",
        body: JSON.stringify({ claimId, title, severity }),
      },
    );
  },

  // ============================================================================
  // Sprint 10: Historical Intent Checks
  // ============================================================================

  async runIntentCheck(
    repositoryId: string,
    payload: { diff: string; filePath?: string; changeDescription?: string },
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/advisory/intent-check`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async getIntentChecks(
    repositoryId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any[]> {
    return request<any[]>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/advisory/intent-checks`,
    );
  },

  async getIntentCheck(
    repositoryId: string,
    sessionId: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/advisory/intent-checks/${sessionId}`,
    );
  },

  async recordIntentDisposition(
    repositoryId: string,
    sessionId: string,
    disposition: string,
    notes?: string,
    workspaceId: string = getApiActiveWorkspaceId(),
  ): Promise<any> {
    return request<any>(
      `/workspaces/${workspaceId}/repositories/${repositoryId}/advisory/intent-checks/${sessionId}/disposition`,
      {
        method: "POST",
        body: JSON.stringify({ disposition, notes }),
      },
    );
  },
};

