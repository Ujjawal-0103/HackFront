import {
  GitHubRepoDetails,
  GitHubCommitSummary,
  GitHubCommitDetail,
  GitHubPullRequestSummary,
  GitHubPullRequestDetail,
  GitHubReview,
  GitHubIssueSummary,
  GitHubComment,
  GitHubTreeResult,
  GitHubFileContent,
  GitHubRateLimitInfo,
  GitHubRequestOptions,
  GitHubPaginationOptions,
  PaginatedResult,
} from "./github-ingestion.types";

export const GITHUB_INGESTION_ADAPTER_TOKEN = "IGitHubIngestionAdapter";
export const GITHUB_BASE_URL_TOKEN = "GITHUB_BASE_URL_TOKEN";

export interface IGitHubIngestionAdapter {
  getRepository(
    owner: string,
    repo: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubRepoDetails>;

  getCommits(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { since?: string; until?: string },
  ): Promise<PaginatedResult<GitHubCommitSummary>>;

  getCommitsFromContinuationUrl(
    owner: string,
    repo: string,
    continuationUrl: string,
    options?: GitHubRequestOptions,
  ): Promise<PaginatedResult<GitHubCommitSummary>>;

  validateContinuationUrl(
    urlStr: string,
    expectedOwner: string,
    expectedRepo: string,
    expectedEndpoint?: string,
  ): string;

  getCommit(
    owner: string,
    repo: string,
    sha: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubCommitDetail>;

  getPullRequests(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubPullRequestSummary>>;

  getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubRequestOptions,
  ): Promise<GitHubPullRequestDetail>;

  getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubReview>>;

  getPullRequestComments(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>>;

  getIssues(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubIssueSummary>>;

  getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>>;

  getTree(
    owner: string,
    repo: string,
    treeSha?: string,
    options?: GitHubRequestOptions & { recursive?: boolean },
  ): Promise<GitHubTreeResult>;

  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent>;

  getReadme(
    owner: string,
    repo: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent>;

  getRateLimit(options?: GitHubRequestOptions): Promise<GitHubRateLimitInfo>;
}
