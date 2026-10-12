import { Injectable } from "@nestjs/common";
import { IGitHubIngestionAdapter } from "./github-adapter.interface";
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
import { GitHubNotFoundError } from "./github.errors";

@Injectable()
export class MockGitHubIngestionAdapter implements IGitHubIngestionAdapter {
  private repoDetails: GitHubRepoDetails = {
    id: 98765,
    name: "HackFront",
    fullName: "Ujjawal-0103/HackFront",
    owner: "Ujjawal-0103",
    description:
      "Human-supervised verification system for AI-generated code explanations",
    defaultBranch: "main",
    isPrivate: false,
    isFork: false,
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
    sizeKb: 1024,
  };

  private commits: GitHubCommitDetail[] = [
    {
      sha: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
      message:
        "feat: add table memoization to prevent re-renders when rows > 500",
      author: {
        name: "Alex Maintainer",
        email: "alex@company.com",
        date: "2025-04-12T10:00:00Z",
        login: "alex-m",
      },
      committer: {
        name: "Alex Maintainer",
        email: "alex@company.com",
        date: "2025-04-12T10:00:00Z",
        login: "alex-m",
      },
      url: "https://github.com/Ujjawal-0103/HackFront/commit/7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
      parentShas: ["1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"],
      stats: { additions: 15, deletions: 2, total: 17 },
      files: [
        {
          filename: "src/components/Table.tsx",
          status: "modified",
          additions: 15,
          deletions: 2,
          changes: 17,
          patch:
            "@@ -10,2 +10,15 @@\n+ const memoizedRows = useMemo(() => {\n+   return compute(data);\n+ }, [data]);",
        },
      ],
    },
  ];

  private pullRequests: GitHubPullRequestDetail[] = [
    {
      number: 42,
      title: "Optimise streaming table rendering for large payloads",
      body: "Resolves performance regression on dataset sizes > 500 records.",
      state: "closed",
      author: "alex-m",
      isDraft: false,
      createdAt: "2025-04-10T09:00:00Z",
      updatedAt: "2025-04-12T10:30:00Z",
      closedAt: "2025-04-12T10:30:00Z",
      mergedAt: "2025-04-12T10:30:00Z",
      mergeCommitSha: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
      url: "https://github.com/Ujjawal-0103/HackFront/pull/42",
      additions: 15,
      deletions: 2,
      changedFiles: 1,
      baseRef: "main",
      headRef: "feat/streaming-memo",
      headSha: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
    },
  ];

  private issues: GitHubIssueSummary[] = [
    {
      number: 10,
      title: "Table UI drops frames during streaming table updates",
      body: "UI locks up when more than 500 rows are streaming simultaneously.",
      state: "closed",
      author: "qa-lead",
      isPullRequest: false,
      commentsCount: 2,
      createdAt: "2025-04-05T12:00:00Z",
      updatedAt: "2025-04-12T11:00:00Z",
      closedAt: "2025-04-12T11:00:00Z",
      url: "https://github.com/Ujjawal-0103/HackFront/issues/10",
    },
  ];

  async getRepository(owner: string, repo: string): Promise<GitHubRepoDetails> {
    if (
      owner.toLowerCase() !== "ujjawal-0103" &&
      owner.toLowerCase() !== "acme-corp"
    ) {
      throw new GitHubNotFoundError(
        `Repository ${owner}/${repo} not found in mock store`,
      );
    }
    return {
      ...this.repoDetails,
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
    };
  }

  async getCommits(
    _owner: string,
    _repo: string,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    const page = options?.page || 1;
    const perPage = options?.perPage || 30;
    const items = this.commits.map(
      ({ stats: _s, files: _f, ...summary }) => summary,
    );
    return {
      items,
      page,
      perPage,
      hasMore: false,
      rateLimit: await this.getRateLimit(),
    };
  }

  async getCommitsFromContinuationUrl(
    owner: string,
    repo: string,
    _continuationUrl: string,
    options?: GitHubRequestOptions,
  ): Promise<PaginatedResult<GitHubCommitSummary>> {
    return this.getCommits(owner, repo, options);
  }

  validateContinuationUrl(
    urlStr: string,
    _expectedOwner: string,
    _expectedRepo: string,
    _expectedEndpoint = "commits",
  ): string {
    return urlStr;
  }

  async getCommit(
    _owner: string,
    _repo: string,
    sha: string,
  ): Promise<GitHubCommitDetail> {
    const matched = this.commits.find(
      (c) => c.sha.startsWith(sha) || sha.startsWith(c.sha),
    );
    if (!matched) {
      throw new GitHubNotFoundError(`Commit ${sha} not found`);
    }
    return matched;
  }

  async getPullRequests(
    _owner: string,
    _repo: string,
    options?: GitHubPaginationOptions,
  ): Promise<PaginatedResult<GitHubPullRequestSummary>> {
    const page = options?.page || 1;
    const perPage = options?.perPage || 30;
    const items = this.pullRequests.map(
      ({ additions: _a, deletions: _d, changedFiles: _cf, ...s }) => s,
    );
    return {
      items,
      page,
      perPage,
      hasMore: false,
      rateLimit: await this.getRateLimit(),
    };
  }

  async getPullRequest(
    _owner: string,
    _repo: string,
    pullNumber: number,
  ): Promise<GitHubPullRequestDetail> {
    const matched = this.pullRequests.find((pr) => pr.number === pullNumber);
    if (!matched) {
      throw new GitHubNotFoundError(`Pull request #${pullNumber} not found`);
    }
    return matched;
  }

  async getPullRequestReviews(): Promise<PaginatedResult<GitHubReview>> {
    return {
      items: [
        {
          id: 501,
          user: "tech-lead",
          body: "LGTM! Verified benchmark avoids re-render locks.",
          state: "APPROVED",
          submittedAt: "2025-04-12T10:15:00Z",
        },
      ],
      page: 1,
      perPage: 30,
      hasMore: false,
    };
  }

  async getPullRequestComments(): Promise<PaginatedResult<GitHubComment>> {
    return {
      items: [
        {
          id: "9001",
          author: "reviewer-1",
          body: "Does the 500-row limit handle virtualized tables?",
          createdAt: "2025-04-11T14:00:00Z",
          updatedAt: "2025-04-11T14:00:00Z",
          url: "https://github.com/Ujjawal-0103/HackFront/pull/42#issuecomment-9001",
        },
      ],
      page: 1,
      perPage: 30,
      hasMore: false,
    };
  }

  async getIssues(): Promise<PaginatedResult<GitHubIssueSummary>> {
    return {
      items: this.issues,
      page: 1,
      perPage: 30,
      hasMore: false,
      rateLimit: await this.getRateLimit(),
    };
  }

  async getIssueComments(): Promise<PaginatedResult<GitHubComment>> {
    return {
      items: [
        {
          id: "9002",
          author: "alex-m",
          body: "Identified memory leak caused by unmemoized row mapper.",
          createdAt: "2025-04-06T09:00:00Z",
          updatedAt: "2025-04-06T09:00:00Z",
          url: "https://github.com/Ujjawal-0103/HackFront/issues/10#issuecomment-9002",
        },
      ],
      page: 1,
      perPage: 30,
      hasMore: false,
    };
  }

  async getTree(): Promise<GitHubTreeResult> {
    return {
      sha: "tree-sha-head",
      truncated: false,
      tree: [
        {
          path: "README.md",
          mode: "100644",
          type: "blob",
          sha: "blob-sha-1",
          size: 1200,
        },
        { path: "src", mode: "040000", type: "tree", sha: "tree-sha-src" },
        {
          path: "src/index.ts",
          mode: "100644",
          type: "blob",
          sha: "blob-sha-2",
          size: 2400,
        },
      ],
    };
  }

  async getFileContent(
    _owner: string,
    _repo: string,
    path: string,
  ): Promise<GitHubFileContent> {
    return {
      path,
      sha: "blob-sha-test",
      size: 512,
      content: "# Sample Document\nVerified content for unit testing.",
      encoding: "utf-8",
    };
  }

  async getReadme(): Promise<GitHubFileContent> {
    return {
      path: "README.md",
      sha: "blob-sha-readme",
      size: 1024,
      content: "# Traceback\nHuman-supervised code rationale verification.",
      encoding: "utf-8",
    };
  }

  async getRateLimit(): Promise<GitHubRateLimitInfo> {
    return {
      limit: 5000,
      remaining: 4999,
      resetAt: new Date(Date.now() + 3600 * 1000),
      used: 1,
    };
  }
}
