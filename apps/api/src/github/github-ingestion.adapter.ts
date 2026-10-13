import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IGitHubIngestionAdapter,
  GITHUB_BASE_URL_TOKEN,
} from "./github-adapter.interface";
import { GitHubAppAuthService } from "./github-app-auth.service";
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
import {
  GitHubAdapterError,
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubInvalidResponseError,
  GitHubPayloadTooLargeError,
  GitHubValidationError,
  GitHubApiError,
} from "./github.errors";

const DEFAULT_BASE_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_PER_PAGE = 100;
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB default bound
export const RATE_LIMIT_LOW_QUOTA_THRESHOLD = 100;

@Injectable()
export class GitHubIngestionAdapter implements IGitHubIngestionAdapter {
  private readonly logger = new Logger(GitHubIngestionAdapter.name);
  private readonly baseUrl: string;
  private lastKnownRateLimit?: GitHubRateLimitInfo;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(GITHUB_BASE_URL_TOKEN) customBaseUrl?: string,
    @Optional() private readonly authService?: GitHubAppAuthService,
  ) {
    this.baseUrl =
      customBaseUrl ||
      this.configService?.get<string>("GITHUB_API_BASE_URL") ||
      this.configService?.get<string>("github.baseUrl") ||
      DEFAULT_BASE_URL;
  }

  clearRateLimitState(): void {
    this.lastKnownRateLimit = undefined;
  }

  // --- 1. Repository Metadata ---
  async getRepository(
    owner: string,
    repo: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubRepoDetails> {
    this.validateOwnerRepo(owner, repo);
    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      options,
    );

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login || owner,
      description: data.description || undefined,
      defaultBranch: data.default_branch || "main",
      isPrivate: Boolean(data.private),
      isFork: Boolean(data.fork),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      sizeKb: data.size || 0,
    };
  }

  // --- 2. Commits & Diff Hunks ---
  async getCommits(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { since?: string; until?: string },
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (options?.since) params.append("since", options.since);
    if (options?.until) params.append("until", options.until);

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected commit array from GitHub API",
      );
    }

    const items: GitHubCommitSummary[] = data.map((item) => ({
      sha: item.sha,
      message: item.commit?.message || "",
      author: {
        name: item.commit?.author?.name || "Unknown",
        email: item.commit?.author?.email,
        date: item.commit?.author?.date || new Date().toISOString(),
        login: item.author?.login,
      },
      committer: {
        name: item.commit?.committer?.name || "Unknown",
        email: item.commit?.committer?.email,
        date: item.commit?.committer?.date || new Date().toISOString(),
        login: item.committer?.login,
      },
      url:
        item.html_url ||
        `https://github.com/${owner}/${repo}/commit/${item.sha}`,
      parentShas: Array.isArray(item.parents)
        ? item.parents.map((p: any) => p.sha)
        : [],
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);

    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  async getCommitsFromContinuationUrl(
    owner: string,
    repo: string,
    continuationUrl: string,
    options?: GitHubRequestOptions,
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    this.validateOwnerRepo(owner, repo);
    this.validateContinuationUrl(continuationUrl, owner, repo, "commits");

    const parsed = new URL(continuationUrl);
    const endpointWithQuery = `${parsed.pathname}${parsed.search}`;

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(endpointWithQuery, options);

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected commit array from GitHub API",
      );
    }

    const items: GitHubCommitSummary[] = data.map((item) => ({
      sha: item.sha,
      message: item.commit?.message || "",
      author: {
        name: item.commit?.author?.name || "Unknown",
        email: item.commit?.author?.email,
        date: item.commit?.author?.date || new Date().toISOString(),
        login: item.author?.login,
      },
      committer: {
        name: item.commit?.committer?.name || "Unknown",
        email: item.commit?.committer?.email,
        date: item.commit?.committer?.date || new Date().toISOString(),
        login: item.committer?.login,
      },
      url:
        item.html_url ||
        `https://github.com/${owner}/${repo}/commit/${item.sha}`,
      parentShas: Array.isArray(item.parents)
        ? item.parents.map((p: any) => p.sha)
        : [],
    }));

    const nextUrl = this.extractNextUrl(headers);
    const perPage = parsed.searchParams.get("per_page")
      ? parseInt(parsed.searchParams.get("per_page")!, 10)
      : 30;
    const page = parsed.searchParams.get("page")
      ? parseInt(parsed.searchParams.get("page")!, 10)
      : 1;
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);

    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  async getCommit(
    owner: string,
    repo: string,
    sha: string,
    options?: GitHubRequestOptions,
  ): Promise<GitHubCommitDetail> {
    this.validateOwnerRepo(owner, repo);
    this.validateSha(sha);

    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
      options,
    );

    return {
      sha: data.sha,
      message: data.commit?.message || "",
      author: {
        name: data.commit?.author?.name || "Unknown",
        email: data.commit?.author?.email,
        date: data.commit?.author?.date || new Date().toISOString(),
        login: data.author?.login,
      },
      committer: {
        name: data.commit?.committer?.name || "Unknown",
        email: data.commit?.committer?.email,
        date: data.commit?.committer?.date || new Date().toISOString(),
        login: data.committer?.login,
      },
      url:
        data.html_url ||
        `https://github.com/${owner}/${repo}/commit/${data.sha}`,
      parentShas: Array.isArray(data.parents)
        ? data.parents.map((p: any) => p.sha)
        : [],
      stats: {
        additions: data.stats?.additions || 0,
        deletions: data.stats?.deletions || 0,
        total: data.stats?.total || 0,
      },
      files: Array.isArray(data.files)
        ? data.files.map((f: any) => ({
            filename: f.filename,
            status: f.status || "modified",
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            changes: f.changes || 0,
            patch: f.patch,
          }))
        : [],
    };
  }

  // --- 3. Pull Requests & Reviews ---
  async getPullRequests(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubPullRequestSummary>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      state: options?.state || "all",
    });

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${params.toString()}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected pull request array from GitHub API",
      );
    }

    const items: GitHubPullRequestSummary[] = data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || undefined,
      state: pr.state === "closed" ? "closed" : "open",
      author: pr.user?.login || "Unknown",
      isDraft: Boolean(pr.draft),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at || undefined,
      mergedAt: pr.merged_at || undefined,
      mergeCommitSha: pr.merge_commit_sha || undefined,
      url:
        pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);
    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubRequestOptions,
  ): Promise<GitHubPullRequestDetail> {
    this.validateOwnerRepo(owner, repo);
    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`,
      options,
    );

    return {
      number: data.number,
      title: data.title,
      body: data.body || undefined,
      state: data.state === "closed" ? "closed" : "open",
      author: data.user?.login || "Unknown",
      isDraft: Boolean(data.draft),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at || undefined,
      mergedAt: data.merged_at || undefined,
      mergeCommitSha: data.merge_commit_sha || undefined,
      url:
        data.html_url ||
        `https://github.com/${owner}/${repo}/pull/${data.number}`,
      additions: data.additions || 0,
      deletions: data.deletions || 0,
      changedFiles: data.changed_files || 0,
      baseRef: data.base?.ref || "main",
      headRef: data.head?.ref || "",
      headSha: data.head?.sha || "",
    };
  }

  async getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubReview>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/reviews?page=${page}&per_page=${perPage}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected reviews array from GitHub API",
      );
    }

    const items: GitHubReview[] = data.map((rev) => ({
      id: rev.id,
      user: rev.user?.login || "Unknown",
      body: rev.body || undefined,
      state: rev.state || "COMMENTED",
      submittedAt: rev.submitted_at || undefined,
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);
    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  async getPullRequestComments(
    owner: string,
    repo: string,
    pullNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/comments?page=${page}&per_page=${perPage}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected PR review comments array from GitHub API",
      );
    }

    const items: GitHubComment[] = data.map((c) => ({
      id: String(c.id),
      author: c.user?.login || "Unknown",
      body: c.body || "",
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      url: c.html_url || "",
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);
    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  // --- 4. Issues & Comments ---
  async getIssues(
    owner: string,
    repo: string,
    options?: GitHubPaginationOptions & { state?: "open" | "closed" | "all" },
  ): Promise<PaginatedResult<GitHubIssueSummary>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      state: options?.state || "all",
    });

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params.toString()}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected issue array from GitHub API",
      );
    }

    const items: GitHubIssueSummary[] = data.map((iss) => ({
      number: iss.number,
      title: iss.title,
      body: iss.body || undefined,
      state: iss.state === "closed" ? "closed" : "open",
      author: iss.user?.login || "Unknown",
      isPullRequest: Boolean(iss.pull_request),
      commentsCount: iss.comments || 0,
      createdAt: iss.created_at,
      updatedAt: iss.updated_at,
      closedAt: iss.closed_at || undefined,
      url:
        iss.html_url ||
        `https://github.com/${owner}/${repo}/issues/${iss.number}`,
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);
    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubComment>> {
    this.validateOwnerRepo(owner, repo);
    const page = Math.max(1, options?.page || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options?.perPage || 30));

    const { data, headers, rateLimit } = await this.executeRequestWithHeaders<
      any[]
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?page=${page}&per_page=${perPage}`,
      options,
    );

    if (!Array.isArray(data)) {
      throw new GitHubInvalidResponseError(
        "Expected issue comments array from GitHub API",
      );
    }

    const items: GitHubComment[] = data.map((c) => ({
      id: String(c.id),
      author: c.user?.login || "Unknown",
      body: c.body || "",
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      url: c.html_url || "",
    }));

    const nextUrl = this.extractNextUrl(headers);
    const hasMore =
      nextUrl !== undefined ||
      this.checkHasMore(items.length, perPage, headers);
    return { items, page, perPage, hasMore, nextUrl, rateLimit };
  }

  // --- 5. File Trees & Content ---
  async getTree(
    owner: string,
    repo: string,
    treeSha = "HEAD",
    options?: GitHubRequestOptions & { recursive?: boolean },
  ): Promise<GitHubTreeResult> {
    this.validateOwnerRepo(owner, repo);
    this.validateSha(treeSha);

    const query = options?.recursive ? "?recursive=1" : "";
    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}${query}`,
      options,
    );

    return {
      sha: data.sha,
      truncated: Boolean(data.truncated),
      tree: Array.isArray(data.tree)
        ? data.tree.map((t: any) => ({
            path: t.path,
            mode: t.mode,
            type: t.type,
            sha: t.sha,
            size: t.size,
          }))
        : [],
    };
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent> {
    this.validateOwnerRepo(owner, repo);
    this.validatePath(path);

    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURI(path)}${query}`,
      options,
    );

    if (data.type !== "file") {
      throw new GitHubNotFoundError(
        `Path "${path}" is a directory or symlink, not a file`,
      );
    }

    const maxBytes = options?.maxSizeBytes || MAX_FILE_SIZE_BYTES;
    if (data.size > maxBytes) {
      throw new GitHubPayloadTooLargeError(data.size, maxBytes);
    }

    let decodedContent = "";
    if (data.encoding === "base64" && data.content) {
      decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
    } else if (typeof data.content === "string") {
      decodedContent = data.content;
    }

    return {
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: decodedContent,
      encoding: "utf-8",
    };
  }

  async getReadme(
    owner: string,
    repo: string,
    ref?: string,
    options?: GitHubRequestOptions & { maxSizeBytes?: number },
  ): Promise<GitHubFileContent> {
    this.validateOwnerRepo(owner, repo);
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await this.executeRequest<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme${query}`,
      options,
    );

    const maxBytes = options?.maxSizeBytes || MAX_FILE_SIZE_BYTES;
    if (data.size > maxBytes) {
      throw new GitHubPayloadTooLargeError(data.size, maxBytes);
    }

    let decodedContent = "";
    if (data.encoding === "base64" && data.content) {
      decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
    } else if (typeof data.content === "string") {
      decodedContent = data.content;
    }

    return {
      path: data.path || "README.md",
      sha: data.sha,
      size: data.size,
      content: decodedContent,
      encoding: "utf-8",
    };
  }

  // --- 6. Rate Limit Status ---
  async getRateLimit(
    options?: GitHubRequestOptions,
  ): Promise<GitHubRateLimitInfo> {
    const data = await this.executeRequest<any>("/rate_limit", options);
    const core = data?.resources?.core || data?.rate;

    return {
      limit: core?.limit || 60,
      remaining: core?.remaining || 0,
      resetAt: new Date(
        (core?.reset || Math.floor(Date.now() / 1000) + 3600) * 1000,
      ),
      used: core?.used || 0,
    };
  }

  // --- HTTP Execution Engine with Bounded Retries & Error Mapping ---
  private async executeRequest<T>(
    endpoint: string,
    options?: GitHubRequestOptions,
  ): Promise<T> {
    const { data } = await this.executeRequestWithHeaders<T>(endpoint, options);
    return data;
  }

  private async executeRequestWithHeaders<T>(
    endpoint: string,
    options?: GitHubRequestOptions,
  ): Promise<{ data: T; headers: Headers; rateLimit?: GitHubRateLimitInfo }> {
    // Proactively defer subsequent requests if last known quota is below threshold and reset time is in the future
    if (
      !endpoint.startsWith("/rate_limit") &&
      this.lastKnownRateLimit &&
      this.lastKnownRateLimit.remaining > 0 &&
      this.lastKnownRateLimit.remaining < RATE_LIMIT_LOW_QUOTA_THRESHOLD &&
      Date.now() < this.lastKnownRateLimit.resetAt.getTime()
    ) {
      const nowMs = Date.now();
      const resetMs = this.lastKnownRateLimit.resetAt.getTime();
      const retryAfterSeconds = Math.max(
        1,
        Math.min(Math.ceil((resetMs - nowMs) / 1000), 3600),
      );

      this.logger.warn(
        `GitHub API remaining rate limit quota (${this.lastKnownRateLimit.remaining}) is below safety threshold (${RATE_LIMIT_LOW_QUOTA_THRESHOLD}). Deferring subsequent requests until reset at ${this.lastKnownRateLimit.resetAt.toISOString()} (~${retryAfterSeconds}s).`,
      );

      throw new GitHubRateLimitError(
        `GitHub rate limit low quota safety threshold active: ${this.lastKnownRateLimit.remaining} remaining (< ${RATE_LIMIT_LOW_QUOTA_THRESHOLD}) until ${this.lastKnownRateLimit.resetAt.toISOString()}`,
        {
          limit: this.lastKnownRateLimit.limit,
          remaining: this.lastKnownRateLimit.remaining,
          resetAt: this.lastKnownRateLimit.resetAt,
          retryAfterSeconds,
          endpoint,
        },
      );
    }

    if (options?.signal?.aborted) {
      throw new GitHubTransientError(
        "GitHub request cancelled by caller",
        undefined,
        true,
        endpoint,
      );
    }

    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (options?.signal?.aborted) {
        throw new GitHubTransientError(
          "GitHub request cancelled by caller",
          undefined,
          true,
          endpoint,
        );
      }

      attempt++;
      const controller = new AbortController();
      const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Combine caller's signal if present
      if (options?.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener("abort", () => controller.abort(), {
            once: true,
          });
        }
      }

      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Traceback-Ingestion-Adapter/1.0",
          ...options?.headers,
        };

        let authToken = options?.token;
        if (!authToken && options?.installationId && this.authService) {
          authToken = await this.authService.getInstallationAccessToken(
            options.installationId,
          );
        }

        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const rateLimit = this.parseRateLimitHeaders(response.headers);
        if (rateLimit) {
          this.lastKnownRateLimit = rateLimit;
        }

        // Proactive Low-Quota Threshold check (< 100 remaining)
        if (
          !endpoint.startsWith("/rate_limit") &&
          rateLimit &&
          rateLimit.remaining > 0 &&
          rateLimit.remaining < RATE_LIMIT_LOW_QUOTA_THRESHOLD
        ) {
          const nowMs = Date.now();
          const resetMs = rateLimit.resetAt.getTime();
          const retryAfterSeconds = Math.max(
            1,
            Math.min(Math.ceil((resetMs - nowMs) / 1000), 3600),
          );

          this.logger.warn(
            `GitHub API remaining rate limit quota (${rateLimit.remaining}) fell below safety threshold (${RATE_LIMIT_LOW_QUOTA_THRESHOLD}). Deferring subsequent requests until reset at ${rateLimit.resetAt.toISOString()} (~${retryAfterSeconds}s).`,
          );

          throw new GitHubRateLimitError(
            `GitHub rate limit low quota safety threshold reached: ${rateLimit.remaining} remaining (< ${RATE_LIMIT_LOW_QUOTA_THRESHOLD})`,
            {
              limit: rateLimit.limit,
              remaining: rateLimit.remaining,
              resetAt: rateLimit.resetAt,
              retryAfterSeconds,
              endpoint,
            },
          );
        }

        // 1. Success (200 - 299)
        if (response.ok) {
          try {
            const data = (await response.json()) as T;
            return { data, headers: response.headers, rateLimit };
          } catch (jsonErr) {
            throw new GitHubInvalidResponseError(
              `Malformed JSON response from ${endpoint}: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
              endpoint,
            );
          }
        }

        // 2. Error handling by status code
        const status = response.status;
        let responseBody: any = null;
        try {
          responseBody = await response.json();
        } catch {
          // Response body was not JSON
        }
        const message =
          responseBody?.message || response.statusText || `HTTP ${status}`;

        // Rate Limit Detection (403 or 429 with depleted quota or Retry-After)
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : undefined;
        const isRateLimit =
          status === 429 ||
          status === 430 ||
          (status === 403 &&
            (rateLimit?.remaining === 0 ||
              /rate limit|secondary rate/i.test(message)));

        if (isRateLimit) {
          throw new GitHubRateLimitError(
            `GitHub rate limit exceeded: ${message}`,
            {
              limit: rateLimit?.limit,
              remaining: rateLimit?.remaining,
              resetAt: rateLimit?.resetAt,
              retryAfterSeconds,
              endpoint,
            },
          );
        }

        // Authentication & Permissions (Non-retryable)
        if (status === 401) {
          throw new GitHubAuthError(
            `GitHub authentication error: ${message}`,
            endpoint,
          );
        }
        if (status === 403) {
          throw new GitHubForbiddenError(
            `GitHub access forbidden: ${message}`,
            endpoint,
          );
        }
        if (status === 404) {
          throw new GitHubNotFoundError(
            `GitHub resource not found at ${endpoint}: ${message}`,
            endpoint,
          );
        }

        // Transient Server Errors (500, 502, 503, 504) -> Retry with exponential backoff
        if ([500, 502, 503, 504].includes(status)) {
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(100 * Math.pow(2, attempt), 2000);
            this.logger.warn(
              `GitHub transient error HTTP ${status} on ${endpoint}. Retrying attempt ${attempt}/${maxRetries} after ${backoffMs}ms...`,
            );
            await this.delay(backoffMs);
            continue;
          }
          throw new GitHubTransientError(
            `GitHub transient server error HTTP ${status} exhausted retries on ${endpoint}: ${message}`,
            status,
            false,
            endpoint,
          );
        }

        // Other client errors (400, 422, etc.)
        throw new GitHubApiError(
          `GitHub API error HTTP ${status}: ${message}`,
          status,
          endpoint,
        );
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (options?.signal?.aborted) {
          throw new GitHubTransientError(
            "GitHub request cancelled by caller",
            undefined,
            true,
            endpoint,
          );
        }

        // Abort / Timeout handling
        if (err.name === "AbortError") {
          const isCallerAborted = Boolean(options?.signal?.aborted);
          if (isCallerAborted) {
            throw new GitHubTransientError(
              "GitHub request cancelled by caller",
              undefined,
              true,
              endpoint,
            );
          }
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(150 * Math.pow(2, attempt), 2000);
            await this.delay(backoffMs);
            continue;
          }
          throw new GitHubTransientError(
            `GitHub request timed out after ${timeoutMs}ms on ${endpoint}`,
            undefined,
            true,
            endpoint,
          );
        }

        // If it's already an instance of GitHubAdapterError, rethrow immediately
        if (err instanceof GitHubAdapterError) {
          throw err;
        }

        // Network / Socket errors
        if (attempt <= maxRetries) {
          const backoffMs = Math.min(100 * Math.pow(2, attempt), 2000);
          await this.delay(backoffMs);
          continue;
        }

        throw new GitHubTransientError(
          `GitHub network request failed on ${endpoint}: ${err.message}`,
          undefined,
          false,
          endpoint,
        );
      }
    }

    throw new GitHubTransientError(
      `GitHub request exhausted ${maxRetries} retries on ${endpoint}`,
    );
  }

  // --- Helper Methods ---
  private parseRateLimitHeaders(
    headers: Headers,
  ): GitHubRateLimitInfo | undefined {
    const limitHeader = headers.get("x-ratelimit-limit");
    const remainingHeader = headers.get("x-ratelimit-remaining");
    const resetHeader = headers.get("x-ratelimit-reset");
    const usedHeader = headers.get("x-ratelimit-used");

    if (!remainingHeader) {
      return undefined;
    }

    const remaining = parseInt(remainingHeader, 10);
    if (isNaN(remaining)) {
      return undefined;
    }

    const limit = limitHeader ? parseInt(limitHeader, 10) : 60;
    const parsedLimit = isNaN(limit) ? 60 : limit;

    let resetAt: Date;
    const resetSec = resetHeader ? parseInt(resetHeader, 10) : NaN;
    const nowSec = Math.floor(Date.now() / 1000);

    // Validate reset timestamp: must be positive integer resulting in a valid Date
    if (!isNaN(resetSec) && resetSec > 0) {
      resetAt = new Date(resetSec * 1000);
      if (isNaN(resetAt.getTime())) {
        resetAt = new Date((nowSec + 3600) * 1000);
      }
    } else {
      // Safe fallback: 1 hour from now if reset is missing or invalid
      resetAt = new Date((nowSec + 3600) * 1000);
    }

    const used = usedHeader
      ? parseInt(usedHeader, 10)
      : parsedLimit - remaining;

    return {
      limit: parsedLimit,
      remaining,
      resetAt,
      used: isNaN(used) ? 0 : used,
    };
  }

  extractNextUrl(headers: Headers): string | undefined {
    const linkHeader = headers.get("link");
    if (!linkHeader) return undefined;
    const entries = linkHeader.split(",");
    for (const entry of entries) {
      const match = entry.match(/<([^>]+)>;\s*rel=["']?next["']?/i);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  validateContinuationUrl(
    urlStr: string,
    expectedOwner: string,
    expectedRepo: string,
    expectedEndpoint = "commits",
  ): string {
    if (!urlStr || typeof urlStr !== "string") {
      throw new GitHubValidationError(
        "Continuation URL must be a non-empty string",
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new GitHubValidationError(
        `Invalid continuation URL: malformed URL string "${urlStr}"`,
      );
    }

    if (parsed.protocol !== "https:") {
      throw new GitHubValidationError(
        `Invalid continuation URL: protocol must be https, got "${parsed.protocol}"`,
      );
    }

    let allowedHost: string;
    try {
      allowedHost = new URL(this.baseUrl).hostname.toLowerCase();
    } catch {
      allowedHost = "api.github.com";
    }

    if (
      parsed.hostname.toLowerCase() !== allowedHost &&
      parsed.hostname.toLowerCase() !== "api.github.com"
    ) {
      throw new GitHubValidationError(
        `Invalid continuation URL: hostname "${parsed.hostname}" does not match allowed host "${allowedHost}"`,
      );
    }

    const expectedPrefix = `/repos/${expectedOwner.toLowerCase()}/${expectedRepo.toLowerCase()}/${expectedEndpoint.toLowerCase()}`;
    const actualPath = parsed.pathname.toLowerCase();
    const isOwnerRepoPrefix =
      actualPath === expectedPrefix ||
      actualPath.startsWith(expectedPrefix + "/");
    const isRepoIdPrefix = new RegExp(
      `^/repositories/\\d+/${expectedEndpoint.toLowerCase()}(/|$)`,
    ).test(actualPath);

    if (!isOwnerRepoPrefix && !isRepoIdPrefix) {
      throw new GitHubValidationError(
        `Invalid continuation URL: pathname "${parsed.pathname}" does not match expected prefix "${expectedPrefix}" or repository endpoint`,
      );
    }

    return urlStr;
  }

  private checkHasMore(
    itemCount: number,
    perPage: number,
    headers: Headers,
  ): boolean {
    if (itemCount < perPage) {
      return false;
    }
    const linkHeader = headers.get("link");
    if (linkHeader) {
      return linkHeader.includes('rel="next"');
    }
    return itemCount === perPage;
  }

  private validateOwnerRepo(owner: string, repo: string): void {
    if (!owner || !repo) {
      throw new GitHubValidationError(
        "Repository owner and repo must be non-empty strings",
      );
    }
    const validIdentifier = /^[a-zA-Z0-9_.-]+$/;
    if (!validIdentifier.test(owner) || !validIdentifier.test(repo)) {
      throw new GitHubValidationError(
        `Invalid owner or repository name identifier: "${owner}/${repo}"`,
      );
    }
  }

  private validateSha(sha: string): void {
    if (!sha || !/^[a-zA-Z0-9._-]+$/.test(sha)) {
      throw new GitHubValidationError(
        `Invalid commit/tree SHA reference: "${sha}"`,
      );
    }
  }

  private validatePath(path: string): void {
    if (!path || path.includes("..")) {
      throw new GitHubValidationError(
        `Invalid repository file path: "${path}"`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
