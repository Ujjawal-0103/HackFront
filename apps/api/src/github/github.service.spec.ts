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
});
