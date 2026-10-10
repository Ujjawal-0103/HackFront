import { Test, TestingModule } from "@nestjs/testing";
import { IngestionSyncController } from "./ingestion-sync.controller";
import { IngestionSyncService } from "./ingestion-sync.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AuthenticatedUser } from "../auth/auth.types";

describe("IngestionSyncController (Sprint 3 Part 6)", () => {
  let controller: IngestionSyncController;
  let mockSyncService: any;
  let mockWorkspacesService: any;

  const mockUser: AuthenticatedUser = {
    id: "usr_verified_123",
    email: "alex@company.com",
    name: "Alex Maintainer",
  };

  const mockRepoId = "repo-uuid-999";
  const mockWorkspaceId = "ws-alpha";

  beforeEach(async () => {
    mockSyncService = {
      triggerManualSync: jest.fn(),
      getSyncStatus: jest.fn(),
      getSyncJobDetails: jest.fn(),
    };

    mockWorkspacesService = {
      getMembership: jest.fn().mockResolvedValue({
        workspaceId: mockWorkspaceId,
        userId: mockUser.id,
        role: "MEMBER",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionSyncController],
      providers: [
        { provide: IngestionSyncService, useValue: mockSyncService },
        { provide: WorkspacesService, useValue: mockWorkspacesService },
      ],
    }).compile();

    controller = module.get<IngestionSyncController>(IngestionSyncController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("triggerSync", () => {
    it("should delegate to syncService.triggerManualSync and return response", async () => {
      const mockResponse = {
        jobId: "job-101",
        repositoryId: mockRepoId,
        status: "PENDING" as const,
        message: "Sync job enqueued successfully",
      };
      mockSyncService.triggerManualSync.mockResolvedValue(mockResponse);

      const result = await controller.triggerSync(
        mockRepoId,
        mockWorkspaceId,
        mockUser,
        { trigger: "MANUAL" },
      );

      expect(mockSyncService.triggerManualSync).toHaveBeenCalledWith(
        mockRepoId,
        mockUser.id,
        mockWorkspaceId,
        "MANUAL",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should default to MANUAL trigger when body is undefined", async () => {
      const mockResponse = {
        jobId: "job-102",
        repositoryId: mockRepoId,
        status: "PENDING" as const,
        message: "Sync job enqueued successfully",
      };
      mockSyncService.triggerManualSync.mockResolvedValue(mockResponse);

      const result = await controller.triggerSync(
        mockRepoId,
        mockWorkspaceId,
        mockUser,
        undefined,
      );

      expect(mockSyncService.triggerManualSync).toHaveBeenCalledWith(
        mockRepoId,
        mockUser.id,
        mockWorkspaceId,
        "MANUAL",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should default to MANUAL trigger when empty body object is sent", async () => {
      const mockResponse = {
        jobId: "job-103",
        repositoryId: mockRepoId,
        status: "PENDING" as const,
        message: "Sync job enqueued successfully",
      };
      mockSyncService.triggerManualSync.mockResolvedValue(mockResponse);

      const result = await controller.triggerSync(
        mockRepoId,
        mockWorkspaceId,
        mockUser,
        {},
      );

      expect(mockSyncService.triggerManualSync).toHaveBeenCalledWith(
        mockRepoId,
        mockUser.id,
        mockWorkspaceId,
        "MANUAL",
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getSyncStatus", () => {
    it("should delegate to syncService.getSyncStatus and return status", async () => {
      const mockStatusResponse = {
        repositoryId: mockRepoId,
        lastIndexedAt: "2026-03-01T00:00:00.000Z",
        activeJob: undefined,
        recentJobs: [],
      };
      mockSyncService.getSyncStatus.mockResolvedValue(mockStatusResponse);

      const result = await controller.getSyncStatus(
        mockRepoId,
        mockWorkspaceId,
        mockUser,
      );

      expect(mockSyncService.getSyncStatus).toHaveBeenCalledWith(
        mockRepoId,
        mockUser.id,
        mockWorkspaceId,
      );
      expect(result).toEqual(mockStatusResponse);
    });
  });

  describe("getJobDetails", () => {
    it("should delegate to syncService.getSyncJobDetails and return job details", async () => {
      const mockJobSummary = {
        id: "job-101",
        repositoryId: mockRepoId,
        status: "COMPLETED" as const,
        trigger: "MANUAL" as const,
        counts: { commits: 25, pullRequests: 5, issues: 2 },
        createdAt: "2026-03-01T00:00:00.000Z",
      };
      mockSyncService.getSyncJobDetails.mockResolvedValue(mockJobSummary);

      const result = await controller.getJobDetails(
        "job-101",
        mockWorkspaceId,
        mockUser,
      );

      expect(mockSyncService.getSyncJobDetails).toHaveBeenCalledWith(
        "job-101",
        mockUser.id,
        mockWorkspaceId,
      );
      expect(result).toEqual(mockJobSummary);
    });
  });
});
