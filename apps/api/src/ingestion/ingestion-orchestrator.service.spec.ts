import { Test, TestingModule } from "@nestjs/testing";
import {
  IngestionOrchestratorService,
  IngestionNonRetryableError,
  isRetryableIngestionError,
} from "./ingestion-orchestrator.service";
import { PrismaService } from "../prisma/prisma.service";
import { IngestionPersistenceService } from "./ingestion-persistence.service";
import { GITHUB_INGESTION_ADAPTER_TOKEN } from "../github/github-adapter.interface";
import { IngestionJobPayload } from "./ingestion.types";
import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubValidationError,
} from "../github/github.errors";
import { IngestionNormalizationError } from "./ingestion.normalizer";

describe("IngestionOrchestratorService (Sprint 3 Part 5)", () => {
  let service: IngestionOrchestratorService;
  let mockPrisma: any;
  let mockPersistence: any;
  let mockAdapter: any;

  const validPayload: IngestionJobPayload = {
    repositoryId: "repo-uuid-111",
    syncJobId: "job-uuid-222",
    installationId: 123456,
    fullName: "Ujjawal-0103/HackFront",
    trigger: "MANUAL",
    enqueuedAt: "2026-10-10T00:00:00Z",
  };

  const mockRepository = {
    id: "repo-uuid-111",
    workspaceId: "ws-uuid-1",
    fullName: "Ujjawal-0103/HackFront",
    defaultBranch: "main",
    isPrivate: true,
    indexedAt: null as Date | null,
  };

  const mockSyncJob = {
    id: "job-uuid-222",
    repositoryId: "repo-uuid-111",
    status: "PENDING",
    commitsCount: 0,
    pullRequestsCount: 0,
    issuesCount: 0,
    repository: mockRepository,
  };

  beforeEach(async () => {
    mockPrisma = {
      repositorySyncJob: {
        findUnique: jest.fn(),
      },
      gitHubInstallation: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inst-1",
          installationId: 123456,
          workspaceId: "ws-uuid-1",
        }),
      },
    };

    mockPersistence = {
      updateSyncJob: jest.fn().mockResolvedValue({}),
      upsertRepositoryMetadata: jest.fn().mockResolvedValue({}),
      updateRepositoryIndexedAt: jest.fn().mockResolvedValue({}),
      persistCommits: jest.fn().mockResolvedValue({ commitsCount: 2, diffsCount: 2 }),
      persistPullRequests: jest.fn().mockResolvedValue({ prsCount: 1, commentsCount: 1 }),
      persistIssues: jest.fn().mockResolvedValue({ issuesCount: 1, commentsCount: 1 }),
    };

    mockAdapter = {
      getRepository: jest.fn().mockResolvedValue({
        id: 998877,
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: true,
        sizeKb: 2048,
      }),
      getCommits: jest.fn().mockResolvedValue({
        items: [
          { sha: "sha-commit-1", message: "first commit" },
          { sha: "sha-commit-2", message: "second commit" },
        ],
        hasMore: false,
      }),
      getCommit: jest.fn().mockImplementation((owner, repo, sha) => ({
        sha,
        message: `commit ${sha}`,
        author: { name: "Alex", date: "2025-01-01" },
        committer: { name: "Alex", date: "2025-01-01" },
        url: `https://github.com/commit/${sha}`,
        parentShas: [],
        stats: { additions: 1, deletions: 0, total: 1 },
        files: [{ filename: "index.ts", status: "added", additions: 1, deletions: 0, changes: 1 }],
      })),
      getPullRequests: jest.fn().mockResolvedValue({
        items: [{ number: 42, title: "PR #42", author: "alex", state: "open" }],
        hasMore: false,
      }),
      getPullRequest: jest.fn().mockResolvedValue({
        number: 42,
        title: "PR #42",
        author: "alex",
        state: "open",
        isDraft: false,
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        baseRef: "main",
        headRef: "branch",
        headSha: "head-sha",
      }),
      getPullRequestComments: jest.fn().mockResolvedValue({
        items: [{ id: "c1", author: "reviewer", body: "looks good", createdAt: "2025-01-01" }],
        hasMore: false,
      }),
      getPullRequestReviews: jest.fn().mockResolvedValue({
        items: [{ id: 101, user: "lead", body: "Approved", state: "APPROVED" }],
        hasMore: false,
      }),
      getIssues: jest.fn().mockResolvedValue({
        items: [
          { number: 10, title: "Issue #10", author: "qa", state: "open", isPullRequest: false, commentsCount: 1 },
          { number: 42, title: "PR #42 in issues", author: "alex", state: "open", isPullRequest: true, commentsCount: 0 },
        ],
        hasMore: false,
      }),
      getIssueComments: jest.fn().mockResolvedValue({
        items: [{ id: "ic1", author: "dev", body: "working on it", createdAt: "2025-01-01" }],
        hasMore: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionOrchestratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IngestionPersistenceService, useValue: mockPersistence },
        { provide: GITHUB_INGESTION_ADAPTER_TOKEN, useValue: mockAdapter },
      ],
    }).compile();

    service = module.get<IngestionOrchestratorService>(IngestionOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Validation & Association Checks", () => {
    it("should throw IngestionNonRetryableError on missing payload fields", async () => {
      await expect(service.orchestrateSync(null as any)).rejects.toThrow(
        IngestionNonRetryableError,
      );

      await expect(
        service.orchestrateSync({ ...validPayload, repositoryId: "" }),
      ).rejects.toThrow(IngestionNonRetryableError);

      await expect(
        service.orchestrateSync({ ...validPayload, syncJobId: "" }),
      ).rejects.toThrow(IngestionNonRetryableError);

      await expect(
        service.orchestrateSync({ ...validPayload, installationId: 0 }),
      ).rejects.toThrow(IngestionNonRetryableError);

      await expect(
        service.orchestrateSync({ ...validPayload, fullName: "" }),
      ).rejects.toThrow(IngestionNonRetryableError);
    });

    it("should throw IngestionNonRetryableError if syncJob record is not found in database", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(null);

      await expect(service.orchestrateSync(validPayload)).rejects.toThrow(
        "Sync job record \"job-uuid-222\" not found in database",
      );
    });

    it("should throw IngestionNonRetryableError if repositoryId does not match syncJob", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue({
        ...mockSyncJob,
        repositoryId: "different-repo-id",
      });

      await expect(service.orchestrateSync(validPayload)).rejects.toThrow(
        "Sync job repository mismatch",
      );
    });

    it("should throw IngestionNonRetryableError if associated repository record is missing", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue({
        ...mockSyncJob,
        repository: null,
      });

      await expect(service.orchestrateSync(validPayload)).rejects.toThrow(
        "Repository record \"repo-uuid-111\" not found in database",
      );
    });
  });

  describe("Idempotency & Duplicate Execution", () => {
    it("should short-circuit and skip processing if syncJob is already COMPLETED", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue({
        ...mockSyncJob,
        status: "COMPLETED",
        commitsCount: 15,
        pullRequestsCount: 5,
        issuesCount: 3,
      });

      const result = await service.orchestrateSync(validPayload);

      expect(result).toEqual({
        status: "SKIPPED",
        commitsCount: 15,
        pullRequestsCount: 5,
        issuesCount: 3,
      });
      expect(mockAdapter.getRepository).not.toHaveBeenCalled();
      expect(mockPersistence.updateSyncJob).not.toHaveBeenCalled();
    });
  });

  describe("Successful Initial & Incremental Sync", () => {
    it("should execute initial sync, persist batches, and mark job COMPLETED", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);

      const result = await service.orchestrateSync(validPayload);

      // Status transitioned to SYNCING
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({ status: "SYNCING" }),
      );

      // Metadata persisted
      expect(mockAdapter.getRepository).toHaveBeenCalledWith("Ujjawal-0103", "HackFront");
      expect(mockPersistence.upsertRepositoryMetadata).toHaveBeenCalled();

      // Commits, PRs, issues persisted
      expect(mockAdapter.getCommits).toHaveBeenCalledWith("Ujjawal-0103", "HackFront", {
        page: 1,
        perPage: 50,
        since: undefined,
      });
      expect(mockPersistence.persistCommits).toHaveBeenCalledTimes(1);
      expect(mockPersistence.persistPullRequests).toHaveBeenCalledTimes(1);
      expect(mockPersistence.persistIssues).toHaveBeenCalledTimes(1);

      // Status transitioned to COMPLETED with counts
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "COMPLETED",
          commitsCount: 2,
          pullRequestsCount: 1,
          issuesCount: 1,
          completedAt: expect.any(Date),
        }),
      );

      expect(mockPersistence.updateRepositoryIndexedAt).toHaveBeenCalledWith("repo-uuid-111");

      expect(result).toEqual({
        status: "COMPLETED",
        isTruncated: false,
        truncatedEntities: [],
        commitsCount: 2,
        pullRequestsCount: 1,
        issuesCount: 1,
      });
    });

    it("should execute incremental sync by passing since parameter from repository.indexedAt", async () => {
      const indexedDate = new Date("2026-02-01T00:00:00Z");
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue({
        ...mockSyncJob,
        repository: {
          ...mockRepository,
          indexedAt: indexedDate,
        },
      });

      await service.orchestrateSync(validPayload);

      expect(mockAdapter.getCommits).toHaveBeenCalledWith("Ujjawal-0103", "HackFront", {
        page: 1,
        perPage: 50,
        since: indexedDate.toISOString(),
      });
    });
  });

  describe("Error Classification & Retry Policy", () => {
    it("should classify non-retryable GitHubAuthError: marks job FAILED and does not re-throw", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockAdapter.getRepository.mockRejectedValue(
        new GitHubAuthError("Bad credentials with token ghp_secretToken12345678901234567890"),
      );

      const result = await service.orchestrateSync(validPayload);

      // Fails job immediately
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("[REDACTED_GITHUB_TOKEN]"),
          completedAt: expect.any(Date),
        }),
      );
      // Secret token is NOT present in error message
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.not.objectContaining({
          errorMessage: expect.stringContaining("ghp_secretToken12345678901234567890"),
        }),
      );

      // Successful completion without throwing to BullMQ
      expect(result.status).toBe("COMPLETED");
    });

    it("should classify retryable GitHubRateLimitError on attempt 1: updates job note and re-throws for BullMQ retry", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      const rateLimitError = new GitHubRateLimitError("Rate limit exceeded", {
        retryAfterSeconds: 60,
      });
      mockAdapter.getRepository.mockRejectedValue(rateLimitError);

      const mockJob: any = {
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      await expect(service.orchestrateSync(validPayload, mockJob)).rejects.toThrow(
        rateLimitError,
      );

      // Does NOT mark status FAILED on attempt 1
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          errorMessage: expect.stringContaining("[Attempt 1] Rate limit exceeded"),
        }),
      );
    });

    it("should mark sync job FAILED when retryable error exhausts max attempts (attempt 3 of 3)", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      const transientError = new GitHubTransientError("Gateway timeout", 504);
      mockAdapter.getRepository.mockRejectedValue(transientError);

      const mockJob: any = {
        attemptsMade: 3,
        opts: { attempts: 3 },
      };

      await expect(service.orchestrateSync(validPayload, mockJob)).rejects.toThrow(
        transientError,
      );

      // Marks job FAILED on final attempt
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("Gateway timeout"),
          completedAt: expect.any(Date),
        }),
      );
    });

    it("should safely fail job and throw IngestionNonRetryableError when installation is deleted or missing", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(null);

      await expect(service.orchestrateSync(validPayload)).rejects.toThrow(
        IngestionNonRetryableError,
      );

      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("not found or has been deleted"),
          completedAt: expect.any(Date),
        }),
      );
      expect(mockAdapter.getRepository).not.toHaveBeenCalled();
    });

    it("should safely fail job when installation belongs to a different workspace", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue({
        id: "inst-other",
        installationId: 123456,
        workspaceId: "other-workspace-uuid",
      });

      await expect(service.orchestrateSync(validPayload)).rejects.toThrow(
        IngestionNonRetryableError,
      );

      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("not repository workspace"),
          completedAt: expect.any(Date),
        }),
      );
      expect(mockAdapter.getRepository).not.toHaveBeenCalled();
    });

    it("should halt external fetching if installation is deleted right before fetch", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      // First check passes, second check (prior to fetch) returns null
      mockPrisma.gitHubInstallation.findUnique
        .mockResolvedValueOnce({
          id: "inst-1",
          installationId: 123456,
          workspaceId: "ws-uuid-1",
        })
        .mockResolvedValueOnce(null);

      const result = await service.orchestrateSync(validPayload);

      expect(mockAdapter.getRepository).not.toHaveBeenCalled();
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("revoked or mismatched prior to external fetch"),
          completedAt: expect.any(Date),
        }),
      );
    });
  });

  describe("Pagination Truncation and Checkpoint Preservation", () => {
    it("should flag commits as truncated when page cap is reached with authoritative hasMore next link", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockAdapter.getCommits.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ sha: `sha-${params.page}`, message: `commit ${params.page}` }],
        hasMore: true,
      }));

      const result = await service.orchestrateSync(validPayload);

      expect(result.status).toBe("COMPLETED");
      expect(result.isTruncated).toBe(true);
      expect(result.truncatedEntities).toEqual(["commits"]);
      expect(result.warningMessage).toContain(
        "TRUNCATED: Ingestion reached maximum limit of 10 pages per entity (500 items). Additional records remain unindexed on GitHub for: commits.",
      );

      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "COMPLETED",
          errorMessage: expect.stringContaining("TRUNCATED"),
          completedAt: expect.any(Date),
        }),
      );

      // Checkpoint must NOT advance when commits are truncated
      expect(mockPersistence.updateRepositoryIndexedAt).not.toHaveBeenCalled();
    });

    it("should not flag commits as truncated when page cap is reached with hasMore: false", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockAdapter.getCommits.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ sha: `sha-${params.page}`, message: `commit ${params.page}` }],
        hasMore: params.page < 10,
      }));

      const result = await service.orchestrateSync(validPayload);

      expect(result.status).toBe("COMPLETED");
      expect(result.isTruncated).toBe(false);
      expect(result.truncatedEntities).toEqual([]);
      expect(result.warningMessage).toBeUndefined();

      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "COMPLETED",
          errorMessage: null,
          completedAt: expect.any(Date),
        }),
      );

      // Checkpoint safely advances
      expect(mockPersistence.updateRepositoryIndexedAt).toHaveBeenCalledWith("repo-uuid-111");
    });

    it("should track truncation independently across multiple entities with different outcomes", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      // Commits: single page, complete
      mockAdapter.getCommits.mockResolvedValue({
        items: [{ sha: "commit-c1", message: "first commit" }],
        hasMore: false,
      });
      // PRs: reaches page 10 with hasMore: true
      mockAdapter.getPullRequests.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ number: params.page, title: `PR #${params.page}`, author: "alex", state: "open" }],
        hasMore: true,
      }));
      // Issues: single page, complete
      mockAdapter.getIssues.mockResolvedValue({
        items: [{ number: 1, title: "Issue #1", author: "dev", state: "open", isPullRequest: false }],
        hasMore: false,
      });

      const result = await service.orchestrateSync(validPayload);

      expect(result.status).toBe("COMPLETED");
      expect(result.isTruncated).toBe(true);
      expect(result.truncatedEntities).toEqual(["pull_requests"]);
      expect(result.warningMessage).toContain("Additional records remain unindexed on GitHub for: pull_requests.");
      expect(result.warningMessage).not.toContain("commits");
      expect(result.warningMessage).not.toContain("issues");

      // Commits were fully fetched, so indexedAt can safely advance
      expect(mockPersistence.updateRepositoryIndexedAt).toHaveBeenCalledWith("repo-uuid-111");

      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "COMPLETED",
          errorMessage: expect.stringContaining("pull_requests"),
          completedAt: expect.any(Date),
        }),
      );
    });

    it("should persist accurate job warning, COMPLETED status, and completion timestamp on multi-entity truncation", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockAdapter.getCommits.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ sha: `sha-${params.page}`, message: `commit ${params.page}` }],
        hasMore: true,
      }));
      mockAdapter.getPullRequests.mockResolvedValue({ items: [], hasMore: false });
      mockAdapter.getIssues.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ number: params.page, title: `Issue #${params.page}`, author: "dev", state: "open", isPullRequest: false }],
        hasMore: true,
      }));

      const result = await service.orchestrateSync(validPayload);

      expect(result.status).toBe("COMPLETED");
      expect(result.isTruncated).toBe(true);
      expect(result.truncatedEntities).toEqual(["commits", "issues"]);
      expect(mockPersistence.updateSyncJob).toHaveBeenCalledWith(
        "job-uuid-222",
        expect.objectContaining({
          status: "COMPLETED",
          errorMessage: expect.stringMatching(/TRUNCATED:.*commits, issues/),
          completedAt: expect.any(Date),
        }),
      );
      expect(mockPersistence.updateRepositoryIndexedAt).not.toHaveBeenCalled();
    });

    it("should preserve previous indexedAt checkpoint after truncated run for safe subsequent incremental sync", async () => {
      // First run: initial sync with truncated commits
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);
      mockAdapter.getCommits.mockImplementation((_owner: string, _repo: string, params: any) => ({
        items: [{ sha: `sha-${params.page}`, message: `commit ${params.page}` }],
        hasMore: true,
      }));

      await service.orchestrateSync(validPayload);
      expect(mockPersistence.updateRepositoryIndexedAt).not.toHaveBeenCalled();

      // Second run: subsequent sync. Since indexedAt was not advanced, repository.indexedAt is still null
      mockAdapter.getCommits.mockClear();
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(mockSyncJob);

      await service.orchestrateSync(validPayload);

      // Asserts that since is still undefined (not advanced to a recent timestamp), preventing skipped historical records
      expect(mockAdapter.getCommits).toHaveBeenCalledWith(
        "Ujjawal-0103",
        "HackFront",
        expect.objectContaining({ since: undefined }),
      );
    });
  });

  describe("isRetryableIngestionError predicate", () => {
    it("should correctly identify non-retryable and retryable error types", () => {
      expect(isRetryableIngestionError(new GitHubAuthError())).toBe(false);
      expect(isRetryableIngestionError(new GitHubForbiddenError())).toBe(false);
      expect(isRetryableIngestionError(new GitHubNotFoundError())).toBe(false);
      expect(isRetryableIngestionError(new GitHubValidationError("bad input"))).toBe(false);
      expect(isRetryableIngestionError(new IngestionNormalizationError("bad field"))).toBe(false);
      expect(isRetryableIngestionError(new IngestionNonRetryableError("record missing"))).toBe(false);

      expect(isRetryableIngestionError(new GitHubRateLimitError("rate limited"))).toBe(true);
      expect(isRetryableIngestionError(new GitHubTransientError("503 server error"))).toBe(true);
      expect(isRetryableIngestionError(new Error("Generic network error"))).toBe(true);
    });
  });
});
