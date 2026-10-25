import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { GitHubService } from "./github.service";

describe("GitHubService (Read-Only Least-Privilege Repository Boundary)", () => {
  let service: GitHubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "GITHUB_APP_ID") return null; // Unconfigured in test env
              if (key === "GITHUB_APP_PRIVATE_KEY") return null;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GitHubService>(GitHubService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should report unconfigured live credentials and operate safely in mock mode", () => {
    expect(service.isConfigured()).toBe(false);
  });

  it("should verify access for authorized repository included in installation", async () => {
    const access = await service.verifyRepositoryAccess(
      1001,
      "Ujjawal-0103",
      "HackFront",
    );
    expect(access.authorized).toBe(true);
    expect(access.readOnlyCompliant).toBe(true);
    expect(access.fullName).toBe("Ujjawal-0103/HackFront");
  });

  it("should reject access and throw ForbiddenException for unauthorized repository", async () => {
    await expect(
      service.verifyRepositoryAccess(1001, "unauthorized-org", "private-repo"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should list all authorized repositories for an installation", async () => {
    const repos = await service.listAuthorizedRepositories(1001);
    expect(repos).toHaveLength(2);
    expect(repos[0].fullName).toBe("Ujjawal-0103/HackFront");
    expect(repos[0].permissions.contents).toBe("read");
  });

  it("should return mock installation token when unconfigured in sandbox mode", async () => {
    const token = await service.getInstallationAccessToken(1001);
    expect(token).toBe("mock-installation-token-1001");
  });

  it("should support live configured mode with GitHubAppAuthService", async () => {
    const mockAuthService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getInstallationAccessToken: jest
        .fn()
        .mockResolvedValue("live-installation-token-7788"),
    };

    const liveModule: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "GITHUB_APP_ID") return "123456";
              if (key === "GITHUB_APP_PRIVATE_KEY")
                return "-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----";
              return null;
            }),
          },
        },
        {
          provide: GitHubService,
          useFactory: (config: ConfigService) => {
            return new GitHubService(config, mockAuthService as any);
          },
          inject: [ConfigService],
        },
      ],
    }).compile();

    const liveService = liveModule.get<GitHubService>(GitHubService);
    expect(liveService.isConfigured()).toBe(true);

    const token = await liveService.getInstallationAccessToken(7788);
    expect(token).toBe("live-installation-token-7788");
    expect(mockAuthService.getInstallationAccessToken).toHaveBeenCalledWith(
      7788,
    );
  });

  describe("connect state signing & validation", () => {
    it("should sign and verify valid connect state token", () => {
      const state = service.createConnectState("ws_alpha", "user_1");
      expect(typeof state).toBe("string");

      const verified = service.verifyConnectState(state, "ws_alpha");
      expect(verified.workspaceId).toBe("ws_alpha");
      expect(verified.userId).toBe("user_1");
    });

    it("should reject connect state token with mismatched workspace", () => {
      const state = service.createConnectState("ws_alpha", "user_1");
      expect(() => service.verifyConnectState(state, "ws_beta")).toThrow();
    });

    it("should reject malformed or tampered state tokens", () => {
      expect(() =>
        service.verifyConnectState("not-a-valid-token", "ws_alpha"),
      ).toThrow();
    });
  });

  describe("credentials validation and live vs mock mode", () => {
    it("should stay in mock mode if private key is corrupt even if appId is present", async () => {
      const corruptModule: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "GITHUB_APP_ID") return "123456";
                if (key === "GITHUB_APP_PRIVATE_KEY")
                  return "not-a-valid-pem-key";
                return null;
              }),
            },
          },
          GitHubService,
        ],
      }).compile();

      const corruptService = corruptModule.get<GitHubService>(GitHubService);
      expect(corruptService.isConfigured()).toBe(false);
      expect(corruptService.isMock()).toBe(true);
    });

    it("should reject unconfigured integration in production even if corrupt key provided", async () => {
      const prodCorruptModule: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "app.nodeEnv") return "production";
                if (key === "GITHUB_APP_ID") return "123456";
                if (key === "GITHUB_APP_PRIVATE_KEY") return "corrupt-key";
                return null;
              }),
            },
          },
          GitHubService,
        ],
      }).compile();

      const prodCorruptService =
        prodCorruptModule.get<GitHubService>(GitHubService);
      expect(prodCorruptService.isConfigured()).toBe(false);
      expect(prodCorruptService.isMock()).toBe(false);
      await expect(
        prodCorruptService.listAuthorizedRepositories(1001),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("production safety", () => {
    it("should disable mock client and reject calls in production when credentials missing", async () => {
      const prodModule: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "app.nodeEnv") return "production";
                return null;
              }),
            },
          },
          GitHubService,
        ],
      }).compile();

      const prodService = prodModule.get<GitHubService>(GitHubService);
      expect(prodService.isConfigured()).toBe(false);
      expect(prodService.isMock()).toBe(false);

      await expect(
        prodService.listAuthorizedRepositories(1001),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
