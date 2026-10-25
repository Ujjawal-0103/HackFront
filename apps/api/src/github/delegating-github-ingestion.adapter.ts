import { Injectable, Logger } from "@nestjs/common";
import { IGitHubIngestionAdapter } from "./github-adapter.interface";
import { GitHubService } from "./github.service";
import { GitHubIngestionAdapter } from "./github-ingestion.adapter";
import { MockGitHubIngestionAdapter } from "./mock-github-ingestion.adapter";
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

/**
 * Delegating adapter that guarantees:
 * 1. Mock sandbox mode and mock fixtures (e.g. installation 1001, acme-corp) ALWAYS route
 *    to MockGitHubIngestionAdapter without ever contacting api.github.com.
 * 2. Live configured GitHub App operations with valid installation IDs route to GitHubIngestionAdapter.
 */
@Injectable()
export class DelegatingGitHubIngestionAdapter implements IGitHubIngestionAdapter {
  private readonly logger = new Logger(DelegatingGitHubIngestionAdapter.name);

  constructor(
    private readonly gitHubService: GitHubService,
    private readonly liveAdapter: GitHubIngestionAdapter,
    private readonly mockAdapter: MockGitHubIngestionAdapter,
  ) {}

  private resolveAdapter(
    owner?: string,
    options?: { installationId?: number },
  ): IGitHubIngestionAdapter {
    const isMockService =
      this.gitHubService.isMock() || !this.gitHubService.isConfigured();
    const isMockInstallation = options?.installationId === 1001;
    const isMockOwner = owner?.toLowerCase() === "acme-corp";

    if (isMockService || isMockInstallation || isMockOwner) {
      return this.mockAdapter;
    }
    return this.liveAdapter;
  }

  getRepository(
    owner: string,
    repo: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubRepoDetails> {
    return this.resolveAdapter(owner, options).getRepository(
      owner,
      repo,
      options,
    );
  }

  getCommits(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { since?: string; until?: string },
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    return this.resolveAdapter(owner, options).getCommits(owner, repo, options);
  }

  getCommitsFromContinuationUrl(
    owner: string,
    repo: string,
    continuationUrl: string,
    options?: GitHubRequestOptions,
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    return this.resolveAdapter(owner, options).getCommitsFromContinuationUrl(
      owner,
      repo,
      continuationUrl,
      options,
    );
  }

  validateContinuationUrl(
    urlStr: string,
    expectedOwner: string,
    expectedRepo: string,
    expectedEndpoint?: string,
  ): string {
    return this.resolveAdapter(expectedOwner).validateContinuationUrl(
      urlStr,
      expectedOwner,
      expectedRepo,
      expectedEndpoint,
    );
  }

  getCommit(
    owner: string,
    repo: string,
    sha: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubCommitDetail> {
    return this.resolveAdapter(owner, options).getCommit(
      owner,
      repo,
      sha,
      options,
    );
  }

  getPullRequests(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubPullRequestSummary>> {
    return this.resolveAdapter(owner, options).getPullRequests(
      owner,
      repo,
      options,
    );
  }

  getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubRequestOptions,
  ): Promise<GitHubPullRequestDetail> {
    return this.resolveAdapter(owner, options).getPullRequest(
      owner,
      repo,
      pullNumber,
      options,
    );
  }

  getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubReview>> {
    return this.resolveAdapter(owner, options).getPullRequestReviews(
      owner,
      repo,
      pullNumber,
      options,
    );
  }

  getPullRequestComments(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>> {
    return this.resolveAdapter(owner, options).getPullRequestComments(
      owner,
      repo,
      pullNumber,
      options,
    );
  }

  getIssues(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubIssueSummary>> {
    return this.resolveAdapter(owner, options).getIssues(owner, repo, options);
  }

  getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>> {
    return this.resolveAdapter(owner, options).getIssueComments(
      owner,
      repo,
      issueNumber,
      options,
    );
  }

  getTree(
    owner: string,
    repo: string,
    treeSha?: string,
    options?: GitHubRequestOptions & { recursive?: boolean },
  ): Promise<GitHubTreeResult> {
    return this.resolveAdapter(owner, options).getTree(
      owner,
      repo,
      treeSha,
      options,
    );
  }

  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent> {
    return this.resolveAdapter(owner, options).getFileContent(
      owner,
      repo,
      path,
      ref,
      options,
    );
  }

  getReadme(
    owner: string,
    repo: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent> {
    return this.resolveAdapter(owner, options).getReadme(
      owner,
      repo,
      ref,
      options,
    );
  }

  getRateLimit(options?: GitHubRequestOptions): Promise<GitHubRateLimitInfo> {
    return this.resolveAdapter(undefined, options).getRateLimit(options);
  }

  clearRateLimitState(): void {
    if (typeof (this.liveAdapter as any).clearRateLimitState === "function") {
      (this.liveAdapter as any).clearRateLimitState();
    }
  }
}
