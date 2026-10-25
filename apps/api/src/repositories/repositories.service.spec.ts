import { Test, TestingModule } from "@nestjs/testing";
import {
  RepositoriesService,
  RepositoryDetailsDto,
} from "./repositories.service";
import { PrismaService } from "../prisma/prisma.service";
import { GitHubService } from "../github/github.service";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("RepositoriesService", () => {
  let service: RepositoriesService;
  let mockPrisma: any;
  let mockGitHubService: any;

  beforeEach(async () => {
    mockPrisma = {
      workspace: {
        upsert: jest.fn().mockResolvedValue({ id: "ws_alpha" }),
      },
      repository: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      gitHubInstallation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "inst_1",
          workspaceId: "ws_alpha",
          installationId: 1001,
        }),
      },
    };

    mockGitHubService = {
      isMock: jest.fn().mockReturnValue(true),
      verifyRepositoryAccess: jest.fn().mockResolvedValue({
        authorized: true,
        permissions: { contents: "read" },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoriesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GitHubService, useValue: mockGitHubService },
      ],
    }).compile();

    service = module.get<RepositoriesService>(RepositoriesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("listRepositories", () => {
    it("should list all repositories for a workspace with counts and latest sync job", async () => {
      const mockDbRepos = [
        {
          id: "repo_1",
          workspaceId: "ws_alpha",
          fullName: "Ujjawal-0103/HackFront",
          defaultBranch: "main",
          isPrivate: false,
          indexedAt: new Date("2026-10-13T10:00:00Z"),
          createdAt: new Date("2026-10-13T09:00:00Z"),
          updatedAt: new Date("2026-10-13T10:00:00Z"),
          _count: {
            commits: 15,
            pullRequests: 4,
            issues: 6,
            sourceRecords: 25,
          },
          syncJobs: [
            {
              id: "job_1",
              status: "COMPLETED",
              trigger: "MANUAL",
              commitsCount: 15,
              pullRequestsCount: 4,
              issuesCount: 6,
              errorMessage: null,
              startedAt: new Date("2026-10-13T09:55:00Z"),
              completedAt: new Date("2026-10-13T10:00:00Z"),
              createdAt: new Date("2026-10-13T09:55:00Z"),
            },
          ],
        },
      ];

      mockPrisma.repository.findMany.mockResolvedValue(mockDbRepos);

      const result = await service.listRepositories("ws_alpha");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("repo_1");
      expect(result[0].fullName).toBe("Ujjawal-0103/HackFront");
      expect(result[0].counts.commits).toBe(15);
      expect(result[0].counts.sourceRecords).toBe(25);
      expect(result[0].latestSyncJob?.status).toBe("COMPLETED");
      expect(mockPrisma.workspace.upsert).toHaveBeenCalled();
    });
  });

  describe("getRepository", () => {
    it("should return repository details when authorized", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo_1",
        workspaceId: "ws_alpha",
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: false,
        indexedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          commits: 0,
          pullRequests: 0,
          issues: 0,
          sourceRecords: 0,
        },
        syncJobs: [],
      });

      const result = await service.getRepository("ws_alpha", "repo_1");
      expect(result.id).toBe("repo_1");
    });

    it("should throw NotFoundException if repository does not exist", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(
        service.getRepository("ws_alpha", "repo_nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if repository belongs to another workspace", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo_1",
        workspaceId: "ws_beta",
        fullName: "other/repo",
      });

      await expect(service.getRepository("ws_alpha", "repo_1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("createRepository", () => {
    it("should verify access and upsert repository", async () => {
      mockPrisma.repository.upsert.mockResolvedValue({
        id: "repo_new",
        workspaceId: "ws_alpha",
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: false,
        indexedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { commits: 0, pullRequests: 0, issues: 0, sourceRecords: 0 },
        syncJobs: [],
      });

      const result = await service.createRepository("ws_alpha", {
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: false,
      });

      expect(mockGitHubService.verifyRepositoryAccess).toHaveBeenCalledWith(
        1001,
        "Ujjawal-0103",
        "HackFront",
      );
      expect(result.id).toBe("repo_new");
      expect(result.fullName).toBe("Ujjawal-0103/HackFront");
    });
  });

  describe("getRepositoryActivity", () => {
    it("should return recent commits, PRs, and issues for preview", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo_1",
        workspaceId: "ws_alpha",
        fullName: "Ujjawal-0103/HackFront",
        commits: [
          {
            sha: "abcdef123456",
            message: "feat: add caching layer",
            authorName: "Alex Dev",
            committedAt: new Date("2026-10-12T12:00:00Z"),
            url: "https://github.com/Ujjawal-0103/HackFront/commit/abcdef123456",
          },
        ],
        pullRequests: [
          {
            number: 42,
            title: "Support streaming responses",
            author: "Alex Dev",
            state: "closed",
            isMerged: true,
            url: "https://github.com/Ujjawal-0103/HackFront/pull/42",
            createdAt: new Date("2026-10-12T10:00:00Z"),
          },
        ],
        issues: [
          {
            number: 10,
            title: "Memory leak on reconnection",
            author: "Bug Hunter",
            state: "closed",
            url: "https://github.com/Ujjawal-0103/HackFront/issues/10",
            createdAt: new Date("2026-10-11T08:00:00Z"),
          },
        ],
      });

      const activity = await service.getRepositoryActivity(
        "ws_alpha",
        "repo_1",
      );

      expect(activity.commits).toHaveLength(1);
      expect(activity.pullRequests).toHaveLength(1);
      expect(activity.issues).toHaveLength(1);
      expect(activity.commits[0].sha).toBe("abcdef123456");
      expect(activity.pullRequests[0].number).toBe(42);
    });
  });

  describe("deleteRepository", () => {
    it("should delete repository when authorized", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo_1",
        workspaceId: "ws_alpha",
      });
      mockPrisma.repository.delete.mockResolvedValue({ id: "repo_1" });

      const res = await service.deleteRepository("ws_alpha", "repo_1");
      expect(res.success).toBe(true);
      expect(mockPrisma.repository.delete).toHaveBeenCalledWith({
        where: { id: "repo_1" },
      });
    });
  });

  describe("importRepositoryByUrl", () => {
    it("should return existing repository if already connected to workspace", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo_existing",
        workspaceId: "ws_alpha",
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncJobs: [],
        _count: { commits: 10, pullRequests: 2, issues: 0, sourceRecords: 12 },
      });

      const res = await service.importRepositoryByUrl(
        "ws_alpha",
        "https://github.com/Ujjawal-0103/HackFront",
      );

      expect(res.isAlreadyConnected).toBe(true);
      expect(res.repository.id).toBe("repo_existing");
      expect(res.message).toContain("already connected");
    });

    it("should import fixture repository in mock mode", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockGitHubService.isMock.mockReturnValue(true);
      mockGitHubService.verifyRepositoryAccess.mockResolvedValue({
        authorized: true,
      });
      mockGitHubService.getRepository = jest.fn().mockResolvedValue({
        id: 12345,
        defaultBranch: "main",
        isPrivate: false,
      });
      mockPrisma.repository.create = jest.fn().mockResolvedValue({
        id: "repo_created",
        workspaceId: "ws_alpha",
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncJobs: [],
        _count: { commits: 0, pullRequests: 0, issues: 0, sourceRecords: 0 },
      });

      const res = await service.importRepositoryByUrl(
        "ws_alpha",
        "https://github.com/Ujjawal-0103/HackFront.git",
      );

      expect(res.isAlreadyConnected).toBe(false);
      expect(res.repository.id).toBe("repo_created");
      expect(mockGitHubService.verifyRepositoryAccess).toHaveBeenCalledWith(
        1001,
        "Ujjawal-0103",
        "HackFront",
      );
    });

    it("should reject non-fixture repository in mock mode", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockGitHubService.isMock.mockReturnValue(true);

      await expect(
        service.importRepositoryByUrl(
          "ws_alpha",
          "https://github.com/some-user/external-repo",
        ),
      ).rejects.toThrow("Development Mock Sandbox Mode");
    });

    it("should verify access and import in live mode", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockGitHubService.isMock.mockReturnValue(false);
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue({
        installationId: 173390166,
      });
      mockGitHubService.verifyRepositoryAccess.mockResolvedValue({
        authorized: true,
      });
      mockGitHubService.getRepository = jest.fn().mockResolvedValue({
        id: 99999,
        defaultBranch: "main",
        isPrivate: true,
      });
      mockPrisma.repository.create = jest.fn().mockResolvedValue({
        id: "repo_live",
        workspaceId: "ws_alpha",
        fullName: "org/private-repo",
        defaultBranch: "main",
        isPrivate: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncJobs: [],
        _count: { commits: 0, pullRequests: 0, issues: 0, sourceRecords: 0 },
      });

      const res = await service.importRepositoryByUrl(
        "ws_alpha",
        "https://github.com/org/private-repo",
      );

      expect(res.isAlreadyConnected).toBe(false);
      expect(res.repository.fullName).toBe("org/private-repo");
      expect(mockGitHubService.verifyRepositoryAccess).toHaveBeenCalledWith(
        173390166,
        "org",
        "private-repo",
      );
    });

    it("should reject when workspace lacks an active installation in live mode", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockGitHubService.isMock.mockReturnValue(false);
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue(null);

      await expect(
        service.importRepositoryByUrl(
          "ws_alpha",
          "https://github.com/org/repo",
        ),
      ).rejects.toThrow("has no active GitHub App installation");
    });
  });
});
