import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";

describe("GitHubController", () => {
  let controller: GitHubController;
  let mockGitHubService: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockGitHubService = {
      isConfigured: jest.fn().mockReturnValue(true),
      isMock: jest.fn().mockReturnValue(false),
      getAppSlug: jest.fn().mockReturnValue("traceback-app"),
      createConnectState: jest.fn().mockReturnValue("valid-signed-state"),
      verifyConnectState: jest.fn().mockReturnValue({ workspaceId: "ws_alpha", userId: "user_1" }),
      getInstallationDetails: jest.fn().mockResolvedValue({
        id: 12345,
        accountLogin: "acme-corp",
        accountType: "Organization",
        permissions: { contents: "read", issues: "read", pullRequests: "read" },
      }),
      getStatus: jest.fn().mockImplementation((wsId, userId, inst) => ({
        isConfigured: true,
        isMockMode: false,
        appSlug: "traceback-app",
        installation: inst,
        installUrl: "https://github.com/apps/traceback-app/installations/new?state=valid-signed-state",
      })),
      listAuthorizedRepositories: jest.fn().mockResolvedValue([
        {
          id: 991,
          fullName: "acme-corp/api-service",
          owner: "acme-corp",
          repo: "api-service",
          defaultBranch: "main",
          isPrivate: true,
          permissions: { contents: "read", issues: "read", pullRequests: "read" },
        },
      ]),
      verifyRepositoryAccess: jest.fn().mockResolvedValue({
        authorized: true,
        fullName: "acme-corp/api-service",
        readOnlyCompliant: true,
        reason: "Access verified",
      }),
    };

    mockPrisma = {
      gitHubInstallation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "inst-record-1",
          workspaceId: "ws_alpha",
          installationId: 12345,
          accountLogin: "acme-corp",
          accountType: "Organization",
          createdAt: new Date("2026-10-18T10:00:00Z"),
        }),
        upsert: jest.fn().mockResolvedValue({
          id: "inst-record-1",
          workspaceId: "ws_alpha",
          installationId: 12345,
          accountLogin: "acme-corp",
          accountType: "Organization",
          permissions: { contents: "read" },
          createdAt: new Date("2026-10-18T10:00:00Z"),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitHubController],
      providers: [
        { provide: GitHubService, useValue: mockGitHubService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WorkspaceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GitHubController>(GitHubController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getStatus", () => {
    it("should return integration status and linked installation for workspace", async () => {
      const req: any = { user: { id: "user_1" } };
      const status = await controller.getStatus("ws_alpha", req);

      expect(mockPrisma.gitHubInstallation.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: "ws_alpha" },
      });
      expect(status.isConfigured).toBe(true);
      expect(status.installation?.accountLogin).toBe("acme-corp");
      expect(status.installation?.installationId).toBe(12345);
    });
  });

  describe("getInstallUrl", () => {
    it("should generate anti-tamper state and return GitHub App setup URL", async () => {
      const req: any = { user: { id: "user_1" } };
      const res = await controller.getInstallUrl("ws_alpha", req);

      expect(mockGitHubService.createConnectState).toHaveBeenCalledWith("ws_alpha", "user_1");
      expect(res.installUrl).toContain("https://github.com/apps/traceback-app/installations/new");
      expect(res.state).toBe("valid-signed-state");
    });
  });

  describe("connectInstallation", () => {
    it("should associate an installation with the workspace for an authorized OWNER", async () => {
      const req: any = {
        user: { id: "user_1" },
        workspaceContext: { workspaceId: "ws_alpha", role: "OWNER" },
      };

      const result = await controller.connectInstallation("ws_alpha", req, {
        installationId: 12345,
        state: "valid-signed-state",
      });

      expect(mockGitHubService.verifyConnectState).toHaveBeenCalledWith("valid-signed-state", "ws_alpha");
      expect(mockGitHubService.getInstallationDetails).toHaveBeenCalledWith(12345);
      expect(mockPrisma.gitHubInstallation.upsert).toHaveBeenCalled();
      expect(result.installationId).toBe(12345);
      expect(result.accountLogin).toBe("acme-corp");
    });

    it("should reject connection attempts by non-admin MEMBER role", async () => {
      const req: any = {
        user: { id: "user_2" },
        workspaceContext: { workspaceId: "ws_alpha", role: "MEMBER" },
      };

      await expect(
        controller.connectInstallation("ws_alpha", req, { installationId: 12345 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject invalid numeric installationId", async () => {
      const req: any = {
        user: { id: "user_1" },
        workspaceContext: { workspaceId: "ws_alpha", role: "OWNER" },
      };

      await expect(
        controller.connectInstallation("ws_alpha", req, { installationId: NaN as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("disconnectInstallation", () => {
    it("should delete installation association for authorized ADMIN", async () => {
      const req: any = {
        user: { id: "user_1" },
        workspaceContext: { workspaceId: "ws_alpha", role: "ADMIN" },
      };

      const res = await controller.disconnectInstallation("ws_alpha", req);
      expect(mockPrisma.gitHubInstallation.deleteMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_alpha" },
      });
      expect(res.success).toBe(true);
    });

    it("should forbid disconnect by unauthorized VIEWER role", async () => {
      const req: any = {
        user: { id: "user_3" },
        workspaceContext: { workspaceId: "ws_alpha", role: "VIEWER" },
      };

      await expect(controller.disconnectInstallation("ws_alpha", req)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("listRepositories", () => {
    it("should resolve installation from workspace and list authorized repositories", async () => {
      const repos = await controller.listRepositories("ws_alpha");
      expect(mockGitHubService.listAuthorizedRepositories).toHaveBeenCalledWith(12345);
      expect(repos).toHaveLength(1);
      expect(repos[0].fullName).toBe("acme-corp/api-service");
    });

    it("should throw NotFoundException in live mode when workspace has no installation", async () => {
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValueOnce(null);
      mockGitHubService.isMock.mockReturnValueOnce(false);

      await expect(controller.listRepositories("ws_beta")).rejects.toThrow(NotFoundException);
    });

    it("should fall back to sandbox installation 1001 when in mock mode without linked installation", async () => {
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValueOnce(null);
      mockGitHubService.isMock.mockReturnValueOnce(true);

      await controller.listRepositories("ws_unlinked");
      expect(mockGitHubService.listAuthorizedRepositories).toHaveBeenCalledWith(1001);
    });
  });
});
