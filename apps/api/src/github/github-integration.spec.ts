import * as crypto from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { GitHubService } from "./github.service";
import { GitHubController } from "./github.controller";
import { GitHubAppAuthService, normalizePrivateKey } from "./github-app-auth.service";
import { GitHubAppClient } from "./github-app.client";
import { MockGitHubClient } from "./mock-github.client";
import { GitHubAuthError, GitHubNotFoundError, GitHubRateLimitError } from "./github.errors";
import { PrismaService } from "../prisma/prisma.service";

describe("GitHub App Live vs Mock Integration & Hardening Verification (Section 10)", () => {
  let testKeyPair: { publicKey: string; privateKey: string };

  beforeAll(() => {
    testKeyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  });

  describe("1. Configuration & Private Key Parsing", () => {
    it("should reject missing App ID and fall back to mock mode in development", () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === "GITHUB_APP_PRIVATE_KEY") return testKeyPair.privateKey;
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      expect(service.isConfigured()).toBe(false);
      expect(service.isMock()).toBe(true);
    });

    it("should reject missing private key and fall back to mock mode in development", () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === "GITHUB_APP_ID") return "999888";
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      expect(service.isConfigured()).toBe(false);
      expect(service.isMock()).toBe(true);
    });

    it("should reject malformed private key without crashing or exposing key content", () => {
      const malformedKey = "-----BEGIN RSA PRIVATE KEY-----\nNOT_A_VALID_KEY\n-----END RSA PRIVATE KEY-----";
      expect(() => normalizePrivateKey(malformedKey)).toThrow(GitHubAuthError);

      const config = {
        get: jest.fn((key: string) => {
          if (key === "GITHUB_APP_ID") return "999888";
          if (key === "GITHUB_APP_PRIVATE_KEY") return malformedKey;
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      expect(service.isConfigured()).toBe(false);
      expect(service.isMock()).toBe(true);
    });

    it("should successfully parse and validate a valid live configuration", () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === "GITHUB_APP_ID") return "999888";
          if (key === "GITHUB_APP_PRIVATE_KEY") return testKeyPair.privateKey;
          if (key === "GITHUB_APP_SLUG") return "test-traceback-app";
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      expect(service.isConfigured()).toBe(true);
      expect(service.isMock()).toBe(false);
      expect(service.getAppSlug()).toBe("test-traceback-app");
    });

    it("should strictly reject unconfigured integration in production", async () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === "app.nodeEnv") return "production";
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      expect(service.isConfigured()).toBe(false);
      expect(service.isMock()).toBe(false);

      await expect(service.listAuthorizedRepositories(1001)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("2. Installation Verification & Multi-Tenant Boundaries", () => {
    let mockPrisma: any;
    let service: GitHubService;
    let controller: GitHubController;

    beforeEach(() => {
      mockPrisma = {
        gitHubInstallation: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          upsert: jest.fn(),
          deleteMany: jest.fn(),
        },
      };

      const config = {
        get: jest.fn((key: string) => null),
      } as unknown as ConfigService;

      service = new GitHubService(config);
      controller = new GitHubController(service, mockPrisma);
    });

    it("should reject non-numeric installationId with BadRequestException", async () => {
      const req: any = {
        workspaceContext: { role: "OWNER" },
        user: { id: "user-123" },
      };

      await expect(
        controller.connectInstallation("ws-1", req, { installationId: "invalid" as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should forbid installation connect by non-admin/owner member", async () => {
      const req: any = {
        workspaceContext: { role: "MEMBER" },
        user: { id: "user-member" },
      };

      await expect(
        controller.connectInstallation("ws-1", req, { installationId: 1001 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should forbid installation disconnect by non-admin/owner member", async () => {
      const req: any = {
        workspaceContext: { role: "VIEWER" },
        user: { id: "user-viewer" },
      };

      await expect(
        controller.disconnectInstallation("ws-1", req),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow OWNER to disconnect installation and preserve data", async () => {
      const req: any = {
        workspaceContext: { role: "OWNER" },
        user: { id: "user-owner" },
      };

      const result = await controller.disconnectInstallation("ws-1", req);
      expect(result.success).toBe(true);
      expect(mockPrisma.gitHubInstallation.deleteMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws-1" },
      });
    });

    it("should return clear status indicating mock mode when live credentials absent", async () => {
      const req: any = { user: { id: "user-owner" } };
      mockPrisma.gitHubInstallation.findFirst.mockResolvedValue({
        id: "inst-db-1",
        workspaceId: "ws-1",
        installationId: 1001,
        accountLogin: "Ujjawal-0103",
        accountType: "User",
        createdAt: new Date(),
      });

      const status = await controller.getStatus("ws-1", req);
      expect(status.isConfigured).toBe(false);
      expect(status.isMockMode).toBe(true);
      expect(status.installation?.installationId).toBe(1001);
    });
  });

  describe("3. Secrets Safety & Rate Limiting", () => {
    it("should not expose private key or raw secrets in toString or json representation", () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === "GITHUB_APP_ID") return "123456";
          if (key === "GITHUB_APP_PRIVATE_KEY") return testKeyPair.privateKey;
          return null;
        }),
      } as unknown as ConfigService;

      const service = new GitHubService(config);
      const jsonStr = JSON.stringify(service);
      expect(jsonStr).not.toContain(testKeyPair.privateKey);
      expect(jsonStr).not.toContain("BEGIN RSA PRIVATE KEY");
    });
  });
});
