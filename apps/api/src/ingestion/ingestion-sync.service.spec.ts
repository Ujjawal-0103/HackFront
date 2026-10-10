import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { IngestionSyncService } from "./ingestion-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { getQueueToken } from "@nestjs/bullmq";
import { INGESTION_QUEUE_NAME } from "./ingestion.constants";

describe("IngestionSyncService (Sprint 3 Part 6)", () => {
  let service: IngestionSyncService;
  let mockPrisma: any;
  let mockWorkspacesService: any;
  let mockQueue: any;

  const mockUserId = "usr-verified-123";
  const mockWorkspaceId = "ws-alpha";
  const mockRepositoryId = "repo-uuid-999";

  const mockRepository = {
    id: mockRepositoryId,
    workspaceId: mockWorkspaceId,
    fullName: "Ujjawal-0103/HackFront",
    defaultBranch: "main",
    isPrivate: true,
    indexedAt: new Date("2026-03-01T00:00:00Z"),
  };

  const mockInstallation = {
    id: "inst-record-1",
    workspaceId: mockWorkspaceId,
    installationId: 445566,
  };

  const mockCreatedJob = {
    id: "job-uuid-777",
    repositoryId: mockRepositoryId,
    status: "PENDING",
    trigger: "MANUAL",
    commitsCount: 0,
    pullRequestsCount: 0,
    issuesCount: 0,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      repository: {
        findUnique: jest.fn(),
      },
      gitHubInstallation: {
        findFirst: jest.fn(),
      },
      repositorySyncJob: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    mockWorkspacesService = {
      getMembership: jest.fn(),
    };

    mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkspacesService, useValue: mockWorkspacesService },
        { provide: getQueueToken(INGESTION_QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<IngestionSyncService>(IngestionSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("triggerManualSync", () => {
    it("should successfully create sync job and enqueue payload without secrets", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue(mockInstallation);
      mockPrisma.repositorySyncJob.create.mockResolvedValue(mockCreatedJob);
      mockQueue.add.mockResolvedValue({ id: "bullmq-job-1" });

      const response = await service.triggerManualSync(
        mockRepositoryId,
        mockUserId,
        mockWorkspaceId,
        "MANUAL",
      );

      expect(response).toEqual({
        jobId: "job-uuid-777",
        repositoryId: mockRepositoryId,
        status: "PENDING",
        message: "Sync job enqueued successfully for Ujjawal-0103/HackFront",
      });

      // Verify created job
      expect(mockPrisma.repositorySyncJob.create).toHaveBeenCalledWith({
        data: {
          repositoryId: mockRepositoryId,
          status: "PENDING",
          trigger: "MANUAL",
          commitsCount: 0,
          pullRequestsCount: 0,
          issuesCount: 0,
        },
      });

      // Verify queue payload has NO access tokens or secrets
      expect(mockQueue.add).toHaveBeenCalledWith(
        "sync-repository-history",
        expect.objectContaining({
          repositoryId: mockRepositoryId,
          syncJobId: "job-uuid-777",
          installationId: 445566,
          fullName: "Ujjawal-0103/HackFront",
          trigger: "MANUAL",
          enqueuedAt: expect.any(String),
        }),
        expect.any(Object),
      );

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload).not.toHaveProperty("token");
      expect(payload).not.toHaveProperty("privateKey");
      expect(payload).not.toHaveProperty("secret");
    });

    it("should throw BadRequestException if repositoryId is empty or whitespace", async () => {
      await expect(
        service.triggerManualSync("", mockUserId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.triggerManualSync("   ", mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if repository does not exist", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(
        service.triggerManualSync("non-existent-id", mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if repository belongs to a different workspace", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);

      await expect(
        service.triggerManualSync(mockRepositoryId, mockUserId, "different-workspace"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if user is not a member of the workspace", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue(null);

      await expect(
        service.triggerManualSync(mockRepositoryId, mockUserId, mockWorkspaceId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject manual sync with BadRequestException when workspace has no GitHubInstallation", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerManualSync(mockRepositoryId, mockUserId, mockWorkspaceId),
      ).rejects.toThrow(BadRequestException);

      // Verify no job record or queue entry was created
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should reject manual sync with BadRequestException when installation workspace is mismatched", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue({
        id: "inst-wrong",
        installationId: 888999,
        workspaceId: "other-workspace-id",
      });

      await expect(
        service.triggerManualSync(mockRepositoryId, mockUserId, mockWorkspaceId),
      ).rejects.toThrow(BadRequestException);

      // Verify no job record or queue entry was created
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should handle queue enqueue failure safely and mark job as FAILED", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue(mockInstallation);
      mockPrisma.repositorySyncJob.create.mockResolvedValue(mockCreatedJob);
      mockQueue.add.mockRejectedValue(new Error("Redis connection refused on 6379"));

      await expect(
        service.triggerManualSync(mockRepositoryId, mockUserId, mockWorkspaceId),
      ).rejects.toThrow(ServiceUnavailableException);

      // Verify job was transitioned to FAILED so it does not remain pending
      expect(mockPrisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "job-uuid-777" },
        data: {
          status: "FAILED",
          errorMessage: expect.stringContaining("Redis connection refused"),
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe("getSyncStatus", () => {
    it("should return repository sync status, active job, and history", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });

      const mockSyncJobs = [
        {
          id: "job-1",
          repositoryId: mockRepositoryId,
          status: "SYNCING",
          trigger: "MANUAL",
          commitsCount: 15,
          pullRequestsCount: 2,
          issuesCount: 1,
          errorMessage: null,
          startedAt: new Date("2026-03-02T10:00:00Z"),
          completedAt: null,
          createdAt: new Date("2026-03-02T09:59:00Z"),
        },
        {
          id: "job-0",
          repositoryId: mockRepositoryId,
          status: "COMPLETED",
          trigger: "MANUAL",
          commitsCount: 50,
          pullRequestsCount: 10,
          issuesCount: 5,
          errorMessage: null,
          startedAt: new Date("2026-03-01T10:00:00Z"),
          completedAt: new Date("2026-03-01T10:05:00Z"),
          createdAt: new Date("2026-03-01T09:59:00Z"),
        },
      ];
      mockPrisma.repositorySyncJob.findMany.mockResolvedValue(mockSyncJobs);

      const statusResponse = await service.getSyncStatus(
        mockRepositoryId,
        mockUserId,
        mockWorkspaceId,
      );

      expect(statusResponse.repositoryId).toBe(mockRepositoryId);
      expect(statusResponse.lastIndexedAt).toBe("2026-03-01T00:00:00.000Z");
      expect(statusResponse.activeJob).toBeDefined();
      expect(statusResponse.activeJob?.id).toBe("job-1");
      expect(statusResponse.activeJob?.status).toBe("SYNCING");
      expect(statusResponse.recentJobs).toHaveLength(2);
    });

    it("should throw NotFoundException if repository does not exist", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(
        service.getSyncStatus("missing-repo", mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if user is unauthorized", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepository);
      mockWorkspacesService.getMembership.mockResolvedValue(null);

      await expect(
        service.getSyncStatus(mockRepositoryId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getSyncJobDetails", () => {
    it("should return detailed progress for a specific sync job", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue({
        id: "job-101",
        repositoryId: mockRepositoryId,
        status: "COMPLETED",
        trigger: "MANUAL",
        commitsCount: 20,
        pullRequestsCount: 5,
        issuesCount: 2,
        errorMessage: null,
        startedAt: new Date("2026-03-02T10:00:00Z"),
        completedAt: new Date("2026-03-02T10:02:00Z"),
        createdAt: new Date("2026-03-02T09:59:00Z"),
        repository: mockRepository,
      });

      mockWorkspacesService.getMembership.mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: "MEMBER",
      });

      const details = await service.getSyncJobDetails("job-101", mockUserId, mockWorkspaceId);

      expect(details.id).toBe("job-101");
      expect(details.status).toBe("COMPLETED");
      expect(details.counts).toEqual({
        commits: 20,
        pullRequests: 5,
        issues: 2,
      });
    });

    it("should throw NotFoundException if job does not exist", async () => {
      mockPrisma.repositorySyncJob.findUnique.mockResolvedValue(null);

      await expect(
        service.getSyncJobDetails("non-existent-job", mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
