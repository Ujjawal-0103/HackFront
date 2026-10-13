import {
  WorkspaceSummary,
  RepositoryDetailsDto,
  RepositoryActivityDto,
  CreateRepositoryDto,
  GitHubAuthorizedRepositoryDto,
  RepositorySyncStatusResponse,
  TriggerSyncResponse,
  EvidenceSearchQuery,
  EvidenceSearchResponse,
  SourceRecordDto,
  ReadinessResponse,
  LoginRequest,
  LoginResponse,
  AuthSessionResponse,
} from "@traceback/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DEFAULT_WORKSPACE_ID = "ws_alpha";
const DEFAULT_USER_ID = "user_1";

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
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

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

  // Workspace and user headers for contextual metadata
  const activeWsId = getApiActiveWorkspaceId();
  if (!headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", activeWsId);
  }

  if (!headers.has("x-user-id")) {
    const userId =
      (typeof window !== "undefined"
        ? localStorage.getItem("traceback_user_id")
        : null) || DEFAULT_USER_ID;
    headers.set("x-user-id", userId);
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
        if (errorJson.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(", ")
            : errorJson.message;
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

  // Health & Readiness
  async getReadiness(): Promise<ReadinessResponse> {
    return request<ReadinessResponse>("/health/readiness");
  },
};
