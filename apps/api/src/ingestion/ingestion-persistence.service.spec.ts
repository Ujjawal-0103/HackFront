import { Test, TestingModule } from "@nestjs/testing";
import { IngestionPersistenceService } from "./ingestion-persistence.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  GitHubRepoDetails,
  GitHubCommitDetail,
  GitHubPullRequestDetail,
  GitHubIssueSummary,
  GitHubComment,
  GitHubReview,
} from "../github/github-ingestion.types";

describe("IngestionPersistenceService (Sprint 3 Part 4)", () => {
  let service: IngestionPersistenceService;
  let mockPrisma: any;

  const mockRepoId = "repo-uuid-1111-2222";

  beforeEach(async () => {
    mockPrisma = {
      repository: {
        update: jest.fn(),
      },
      gitCommit: {
        upsert: jest.fn(),
      },
      commitDiff: {
        upsert: jest.fn(),
      },
      pullRequest: {
        upsert: jest.fn(),
      },
      pullRequestComment: {
        upsert: jest.fn(),
      },
      issue: {
        upsert: jest.fn(),
      },
      issueComment: {
        upsert: jest.fn(),
      },
      repositorySyncJob: {
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionPersistenceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<IngestionPersistenceService>(
      IngestionPersistenceService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("upsertRepositoryMetadata", () => {
    it("should update repository with normalized GitHub metadata and indexedAt", async () => {
      const rawMetadata: GitHubRepoDetails = {
        id: 12345,
        name: "HackFront",
        fullName: "Ujjawal-0103/HackFront",
        owner: "Ujjawal-0103",
        defaultBranch: "main",
        isPrivate: true,
        isFork: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
        sizeKb: 1024,
      };

      mockPrisma.repository.update.mockResolvedValue({
        id: mockRepoId,
        githubRepoId: 12345,
        defaultBranch: "main",
        isPrivate: true,
        indexedAt: new Date(),
      });

      const result = await service.upsertRepositoryMetadata(
        mockRepoId,
        rawMetadata,
      );

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: mockRepoId },
        data: {
          githubRepoId: 12345,
          defaultBranch: "main",
          isPrivate: true,
          indexedAt: expect.any(Date),
        },
      });
      expect(result.id).toBe(mockRepoId);
    });

    it("should omit indexedAt when updateIndexedAt is false", async () => {
      const rawMetadata: GitHubRepoDetails = {
        id: 12345,
        name: "HackFront",
        fullName: "Ujjawal-0103/HackFront",
        owner: "Ujjawal-0103",
        defaultBranch: "main",
        isPrivate: true,
        isFork: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
        sizeKb: 1024,
      };

      mockPrisma.repository.update.mockResolvedValue({
        id: mockRepoId,
        githubRepoId: 12345,
        defaultBranch: "main",
        isPrivate: true,
      });

      await service.upsertRepositoryMetadata(mockRepoId, rawMetadata, false);

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: mockRepoId },
        data: {
          githubRepoId: 12345,
          defaultBranch: "main",
          isPrivate: true,
        },
      });
    });
  });

  describe("updateRepositoryIndexedAt", () => {
    it("should update repository indexedAt checkpoint to current or provided date", async () => {
      const targetDate = new Date("2026-03-01T12:00:00Z");
      mockPrisma.repository.update.mockResolvedValue({
        id: mockRepoId,
        indexedAt: targetDate,
      });

      await service.updateRepositoryIndexedAt(mockRepoId, targetDate);

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: mockRepoId },
        data: { indexedAt: targetDate },
      });
    });
  });

  describe("persistCommit & persistCommits", () => {
    const rawCommit: GitHubCommitDetail = {
      sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      message: "feat: add table memoization",
      author: {
        name: "Alex",
        email: "alex@company.com",
        date: "2025-04-12T10:00:00Z",
      },
      committer: {
        name: "Alex",
        email: "alex@company.com",
        date: "2025-04-12T10:00:00Z",
      },
      url: "https://github.com/org/repo/commit/a1b2",
      parentShas: ["parent-sha-0001"],
      stats: { additions: 15, deletions: 2, total: 17 },
      files: [
        {
          filename: "src/table.ts",
          status: "modified",
          additions: 15,
          deletions: 2,
          changes: 17,
          patch: "@@ -1,5 +1,18 @@\n+export ...",
        },
      ],
    };

    it("should idempotently upsert commit and child diff within a transaction", async () => {
      mockPrisma.gitCommit.upsert.mockResolvedValue({
        id: "commit-record-uuid-1",
        repositoryId: mockRepoId,
        sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      });

      mockPrisma.commitDiff.upsert.mockResolvedValue({
        id: "diff-record-uuid-1",
        commitId: "commit-record-uuid-1",
        filePath: "src/table.ts",
      });

      const res = await service.persistCommit(mockRepoId, rawCommit);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.gitCommit.upsert).toHaveBeenCalledWith({
        where: {
          repositoryId_sha: {
            repositoryId: mockRepoId,
            sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          },
        },
        create: {
          repositoryId: mockRepoId,
          sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          message: "feat: add table memoization",
          authorName: "Alex",
          authorEmail: "alex@company.com",
          committedAt: new Date("2025-04-12T10:00:00Z"),
          url: "https://github.com/org/repo/commit/a1b2",
        },
        update: {
          message: "feat: add table memoization",
          authorName: "Alex",
          authorEmail: "alex@company.com",
          committedAt: new Date("2025-04-12T10:00:00Z"),
          url: "https://github.com/org/repo/commit/a1b2",
        },
      });

      expect(mockPrisma.commitDiff.upsert).toHaveBeenCalledWith({
        where: {
          commitId_filePath: {
            commitId: "commit-record-uuid-1",
            filePath: "src/table.ts",
          },
        },
        create: {
          commitId: "commit-record-uuid-1",
          filePath: "src/table.ts",
          status: "modified",
          additions: 15,
          deletions: 2,
          diffHunk: "@@ -1,5 +1,18 @@\n+export ...",
          isBinary: false,
        },
        update: {
          status: "modified",
          additions: 15,
          deletions: 2,
          diffHunk: "@@ -1,5 +1,18 @@\n+export ...",
          isBinary: false,
        },
      });

      expect(res).toEqual({ commitId: "commit-record-uuid-1", diffsCount: 1 });
    });

    it("should handle duplicate ingestion idempotently without duplicate records", async () => {
      mockPrisma.gitCommit.upsert.mockResolvedValue({
        id: "commit-record-uuid-1",
        repositoryId: mockRepoId,
        sha: rawCommit.sha,
      });
      mockPrisma.commitDiff.upsert.mockResolvedValue({
        id: "diff-record-uuid-1",
      });

      // Ingest once
      await service.persistCommit(mockRepoId, rawCommit);
      // Ingest second time
      await service.persistCommit(mockRepoId, rawCommit);

      // Upsert was called twice with identical compound unique constraints
      expect(mockPrisma.gitCommit.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.commitDiff.upsert).toHaveBeenCalledTimes(2);
    });

    it("should persist a batch of commits and aggregate counts", async () => {
      mockPrisma.gitCommit.upsert.mockResolvedValue({ id: "c1" });
      mockPrisma.commitDiff.upsert.mockResolvedValue({ id: "d1" });

      const batchResult = await service.persistCommits(mockRepoId, [rawCommit]);
      expect(batchResult).toEqual({ commitsCount: 1, diffsCount: 1 });
    });
  });

  describe("persistPullRequest & persistPullRequests", () => {
    const rawPr: GitHubPullRequestDetail = {
      number: 42,
      title: "feat: add virtualized rows",
      body: "Solves memory leak on 10k rows.",
      author: "contributor-1",
      state: "closed",
      isDraft: false,
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-02T00:00:00Z",
      mergedAt: "2025-03-02T12:00:00Z",
      closedAt: "2025-03-02T12:00:00Z",
      url: "https://github.com/org/repo/pull/42",
      additions: 100,
      deletions: 20,
      changedFiles: 3,
      baseRef: "main",
      headRef: "feat/virtual-rows",
      headSha: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    };

    const mockComments: GitHubComment[] = [
      {
        id: "pr-comment-1",
        author: "reviewer-1",
        body: "Looks good!",
        createdAt: "2025-03-01T10:00:00Z",
        updatedAt: "2025-03-01T10:00:00Z",
        url: "https://github.com/org/repo/pull/42#comment-1",
      },
    ];

    const mockReviews: GitHubReview[] = [
      {
        id: 9988,
        user: "lead-dev",
        body: "LGTM approved",
        state: "APPROVED",
        submittedAt: "2025-03-01T11:00:00Z",
      },
    ];

    it("should idempotently upsert pull request, comments, and merged review comments", async () => {
      mockPrisma.pullRequest.upsert.mockResolvedValue({
        id: "pr-record-uuid-42",
        repositoryId: mockRepoId,
        number: 42,
      });
      mockPrisma.pullRequestComment.upsert.mockResolvedValue({
        id: "pr-comment-uuid-1",
      });

      const res = await service.persistPullRequest(
        mockRepoId,
        rawPr,
        mockComments,
        mockReviews,
      );

      expect(mockPrisma.pullRequest.upsert).toHaveBeenCalledWith({
        where: {
          repositoryId_number: {
            repositoryId: mockRepoId,
            number: 42,
          },
        },
        create: {
          repositoryId: mockRepoId,
          number: 42,
          title: "feat: add virtualized rows",
          body: "Solves memory leak on 10k rows.",
          author: "contributor-1",
          state: "merged",
          isMerged: true,
          mergedAt: new Date("2025-03-02T12:00:00Z"),
          closedAt: new Date("2025-03-02T12:00:00Z"),
          url: "https://github.com/org/repo/pull/42",
        },
        update: {
          title: "feat: add virtualized rows",
          body: "Solves memory leak on 10k rows.",
          author: "contributor-1",
          state: "merged",
          isMerged: true,
          mergedAt: new Date("2025-03-02T12:00:00Z"),
          closedAt: new Date("2025-03-02T12:00:00Z"),
          url: "https://github.com/org/repo/pull/42",
        },
      });

      // 1 standard comment + 1 review comment
      expect(mockPrisma.pullRequestComment.upsert).toHaveBeenCalledTimes(2);
      expect(res).toEqual({
        pullRequestId: "pr-record-uuid-42",
        commentsCount: 2,
      });
    });

    it("should persist a batch of pull requests using comments and reviews map", async () => {
      mockPrisma.pullRequest.upsert.mockResolvedValue({ id: "pr-1" });
      mockPrisma.pullRequestComment.upsert.mockResolvedValue({ id: "c-1" });

      const commentsMap = new Map<number, GitHubComment[]>([
        [42, mockComments],
      ]);
      const reviewsMap = new Map<number, GitHubReview[]>([[42, mockReviews]]);

      const batchResult = await service.persistPullRequests(
        mockRepoId,
        [rawPr],
        commentsMap,
        reviewsMap,
      );

      expect(batchResult).toEqual({ prsCount: 1, commentsCount: 2 });
    });
  });

  describe("persistIssue & persistIssues", () => {
    const rawIssue: GitHubIssueSummary = {
      number: 101,
      title: "Bug: Row count overflow",
      body: "Integer overflow in pagination query",
      state: "open",
      author: "qa-engineer",
      isPullRequest: false,
      commentsCount: 1,
      createdAt: "2025-03-10T00:00:00Z",
      updatedAt: "2025-03-11T00:00:00Z",
      url: "https://github.com/org/repo/issues/101",
    };

    const mockIssueComments: GitHubComment[] = [
      {
        id: "issue-comment-1",
        author: "developer",
        body: "Reproduced and working on a patch.",
        createdAt: "2025-03-10T12:00:00Z",
        updatedAt: "2025-03-10T12:00:00Z",
        url: "https://github.com/org/repo/issues/101#c1",
      },
    ];

    it("should idempotently upsert issue and comments", async () => {
      mockPrisma.issue.upsert.mockResolvedValue({
        id: "issue-record-uuid-101",
        repositoryId: mockRepoId,
        number: 101,
      });
      mockPrisma.issueComment.upsert.mockResolvedValue({
        id: "issue-comment-record-1",
      });

      const res = await service.persistIssue(
        mockRepoId,
        rawIssue,
        mockIssueComments,
      );

      expect(mockPrisma.issue.upsert).toHaveBeenCalledWith({
        where: {
          repositoryId_number: {
            repositoryId: mockRepoId,
            number: 101,
          },
        },
        create: {
          repositoryId: mockRepoId,
          number: 101,
          title: "Bug: Row count overflow",
          body: "Integer overflow in pagination query",
          author: "qa-engineer",
          state: "open",
          closedAt: null,
          url: "https://github.com/org/repo/issues/101",
        },
        update: {
          title: "Bug: Row count overflow",
          body: "Integer overflow in pagination query",
          author: "qa-engineer",
          state: "open",
          closedAt: null,
          url: "https://github.com/org/repo/issues/101",
        },
      });

      expect(mockPrisma.issueComment.upsert).toHaveBeenCalledTimes(1);
      expect(res).toEqual({
        issueId: "issue-record-uuid-101",
        commentsCount: 1,
      });
    });

    it("should skip issues that are pull requests to prevent duplicates", async () => {
      const prAsIssue: GitHubIssueSummary = {
        ...rawIssue,
        number: 102,
        isPullRequest: true,
      };

      const res = await service.persistIssue(mockRepoId, prAsIssue);

      expect(res).toBeNull();
      expect(mockPrisma.issue.upsert).not.toHaveBeenCalled();
    });

    it("should persist a batch of issues and skip PR items", async () => {
      mockPrisma.issue.upsert.mockResolvedValue({ id: "issue-1" });
      mockPrisma.issueComment.upsert.mockResolvedValue({ id: "ic-1" });

      const prAsIssue: GitHubIssueSummary = {
        ...rawIssue,
        number: 999,
        isPullRequest: true,
      };

      const batchResult = await service.persistIssues(mockRepoId, [
        rawIssue,
        prAsIssue,
      ]);
      expect(batchResult).toEqual({ issuesCount: 1, commentsCount: 0 });
    });
  });

  describe("updateSyncJob", () => {
    it("should update sync job progress and status", async () => {
      mockPrisma.repositorySyncJob.update.mockResolvedValue({
        id: "sync-job-uuid-1",
        status: "COMPLETED",
        commitsCount: 50,
        pullRequestsCount: 10,
        issuesCount: 5,
      });

      const updated = await service.updateSyncJob("sync-job-uuid-1", {
        status: "COMPLETED",
        commitsCount: 50,
        pullRequestsCount: 10,
        issuesCount: 5,
        completedAt: new Date("2026-03-01T12:00:00Z"),
      });

      expect(mockPrisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "sync-job-uuid-1" },
        data: {
          status: "COMPLETED",
          commitsCount: 50,
          pullRequestsCount: 10,
          issuesCount: 5,
          completedAt: new Date("2026-03-01T12:00:00Z"),
        },
      });
      expect(updated.status).toBe("COMPLETED");
    });
  });

  describe("Persistence error handling", () => {
    it("should propagate database errors and not silently discard them", async () => {
      const rawCommit: GitHubCommitDetail = {
        sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        message: "feat: broken commit",
        author: { name: "Alex", date: "2025-01-01" },
        committer: { name: "Alex", date: "2025-01-01" },
        url: "",
        parentShas: [],
        stats: { additions: 0, deletions: 0, total: 0 },
        files: [],
      };

      mockPrisma.gitCommit.upsert.mockRejectedValue(
        new Error("Database unique constraint violation / connection failed"),
      );

      await expect(
        service.persistCommit(mockRepoId, rawCommit),
      ).rejects.toThrow(
        "Database unique constraint violation / connection failed",
      );
    });
  });
});
