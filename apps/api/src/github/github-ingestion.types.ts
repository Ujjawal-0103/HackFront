/**
 * Strongly Typed Data Models for Read-Only GitHub Ingestion (Sprint 3 Part 3)
 */

export interface GitHubRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  used: number;
}

export interface GitHubRequestOptions {
  token?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface GitHubPaginationOptions extends GitHubRequestOptions {
  page?: number;
  perPage?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  perPage: number;
  hasMore: boolean;
  nextUrl?: string;
  rateLimit?: GitHubRateLimitInfo;
}

// 1. Repository
export interface GitHubRepoDetails {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  defaultBranch: string;
  isPrivate: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt?: string;
  sizeKb: number;
}

// 2. Commits & Diff Hunks
export interface GitHubCommitAuthor {
  name: string;
  email?: string;
  date: string;
  login?: string;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  author: GitHubCommitAuthor;
  committer: GitHubCommitAuthor;
  url: string;
  parentShas: string[];
}

export interface GitHubCommitFile {
  filename: string;
  status: string; // "added" | "modified" | "removed" | "renamed"
  additions: number;
  deletions: number;
  changes: number;
  patch?: string; // Unified diff chunk
}

export interface GitHubCommitDetail extends GitHubCommitSummary {
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: GitHubCommitFile[];
}

// 3. Pull Requests & Reviews
export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  author: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  mergedAt?: string;
  mergeCommitSha?: string;
  url: string;
}

export interface GitHubPullRequestDetail extends GitHubPullRequestSummary {
  additions: number;
  deletions: number;
  changedFiles: number;
  baseRef: string;
  headRef: string;
  headSha: string;
}

export interface GitHubReview {
  id: number;
  user: string;
  body?: string;
  state: string; // "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED"
  submittedAt?: string;
}

// 4. Issues & Comments
export interface GitHubIssueSummary {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  author: string;
  isPullRequest: boolean;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  url: string;
}

export interface GitHubComment {
  id: string; // Serialized string to avoid 32-bit overflow
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

// 5. File Trees & Content Metadata
export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface GitHubTreeResult {
  sha: string;
  truncated: boolean;
  tree: GitHubTreeItem[];
}

export interface GitHubFileContent {
  path: string;
  sha: string;
  size: number;
  content: string; // UTF-8 text string
  encoding: string;
}
