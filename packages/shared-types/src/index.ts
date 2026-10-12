/**
 * Traceback Shared Domain Contracts
 * Single source of truth for cross-boundary types between frontend and backend.
 */

// 1. Core Verification & Epistemological Enums
export type HumanVerdict = "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED";

export type AIAssessmentConfidence =
  "HIGH_SUPPORT" | "PARTIAL_SUPPORT" | "SPARSE_EVIDENCE" | "CONTRADICTED";

export type EvidenceSourceType =
  "COMMIT" | "PULL_REQUEST" | "ISSUE" | "DOCUMENTATION" | "ADR";

// 2. Evidence & Provenance Contracts
export interface EvidenceReference {
  id: string;
  sourceType: EvidenceSourceType;
  referenceKey: string; // Commit SHA (e.g. 7f8a9b), PR # (e.g. #42), Issue #, or path
  title: string;
  author: string;
  timestamp: string; // ISO 8601 string
  url: string; // Verified clickable URL (e.g. https://github.com/org/repo/commit/...)
  snippet?: string; // Unified diff snippet or discussion excerpt
  filePath?: string;
  lineRange?: {
    start: number;
    end: number;
  };
}

export interface ClaimItem {
  id: string;
  text: string;
  targetSymbol?: string;
  preliminaryConfidence: AIAssessmentConfidence;
  humanVerdict?: HumanVerdict;
  reviewNotes?: string;
  evidence: EvidenceReference[];
}

export interface VerificationSession {
  id: string;
  workspaceId: string;
  repositoryId: string;
  explanation: string;
  codeSnippet?: string;
  targetFilePath?: string;
  claims: ClaimItem[];
  status: "PENDING" | "ANALYZING" | "REVIEWING" | "COMPLETED" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

// 3. API Envelopes & Health Contracts
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface DependencyCheck {
  ready: boolean;
  message?: string;
  latencyMs?: number;
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  service: string;
  timestamp: string;
  checks: {
    database: DependencyCheck;
    config: DependencyCheck;
    [key: string]: DependencyCheck;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// 4. Workspace & Identity Boundaries
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface UserIdentity {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface RepositorySummary {
  id: string;
  workspaceId: string;
  fullName: string; // e.g. "org/repo"
  defaultBranch: string;
  isPrivate: boolean;
  indexedAt?: string;
}

// 5. Ingestion & Repository Sync Contracts
export type SyncStatus = "PENDING" | "SYNCING" | "COMPLETED" | "FAILED";
export type SyncTrigger = "MANUAL" | "WEBHOOK";

export interface SyncProgressCounts {
  commits: number;
  pullRequests: number;
  issues: number;
}

export interface RepositorySyncSummary {
  id: string;
  repositoryId: string;
  status: SyncStatus;
  trigger: SyncTrigger;
  counts: SyncProgressCounts;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface SyncProgress {
  jobId: string;
  repositoryId: string;
  status: SyncStatus;
  commitsCount: number;
  pullRequestsCount: number;
  issuesCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface TriggerSyncRequest {
  trigger?: SyncTrigger;
}

export interface TriggerSyncResponse {
  jobId: string;
  repositoryId: string;
  status: SyncStatus;
  message: string;
}

export interface RepositorySyncStatusResponse {
  repositoryId: string;
  lastIndexedAt?: string;
  activeJob?: RepositorySyncSummary;
  recentJobs: RepositorySyncSummary[];
}
