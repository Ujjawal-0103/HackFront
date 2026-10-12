import { GitHubAppClient } from "./github-app.client";
import { GitHubAppAuthService } from "./github-app-auth.service";
import {
  GitHubNotFoundError,
  GitHubForbiddenError,
  GitHubValidationError,
} from "./github.errors";

describe("GitHubAppClient (Sprint 3 Part 4)", () => {
  let client: GitHubAppClient;
  let mockAuthService: jest.Mocked<GitHubAppAuthService>;
  const mockBaseUrl = "https://api.github.test";
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockAuthService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getInstallationAccessToken: jest
        .fn()
        .mockResolvedValue("ghs_mockInstallationToken999"),
    } as any;

    client = new GitHubAppClient(mockAuthService, mockBaseUrl);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("should report isConfigured from authService", () => {
    expect(client.isConfigured()).toBe(true);
    mockAuthService.isConfigured.mockReturnValue(false);
    expect(client.isConfigured()).toBe(false);
  });

  it("should delegate getInstallationAccessToken to authService", async () => {
    const token = await client.getInstallationAccessToken(1234);
    expect(token).toBe("ghs_mockInstallationToken999");
    expect(mockAuthService.getInstallationAccessToken).toHaveBeenCalledWith(
      1234,
    );
  });

  describe("verifyRepositoryAccess", () => {
    it("should return authorized and readOnlyCompliant for repositories with read-only scopes (ADR-007)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 5566,
          name: "HackFront",
          full_name: "Ujjawal-0103/HackFront",
          owner: { login: "Ujjawal-0103" },
          default_branch: "main",
          private: false,
          permissions: {
            pull: true,
            push: false,
            admin: false,
          },
        }),
      } as Response);

      const result = await client.verifyRepositoryAccess(
        1234,
        "Ujjawal-0103",
        "HackFront",
      );

      expect(result.authorized).toBe(true);
      expect(result.readOnlyCompliant).toBe(true);
      expect(result.fullName).toBe("Ujjawal-0103/HackFront");
    });

    it("should flag non-compliant when repository permissions exceed read-only scopes", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 5566,
          name: "HackFront",
          full_name: "Ujjawal-0103/HackFront",
          owner: { login: "Ujjawal-0103" },
          default_branch: "main",
          private: false,
          permissions: {
            pull: true,
            push: true, // Write access violates strict read-only ADR-007
            admin: false,
          },
        }),
      } as Response);

      const result = await client.verifyRepositoryAccess(
        1234,
        "Ujjawal-0103",
        "HackFront",
      );

      expect(result.authorized).toBe(true);
      expect(result.readOnlyCompliant).toBe(false);
    });

    it("should return unauthorized when repository is not in installation (404)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not Found" }),
      } as Response);

      const result = await client.verifyRepositoryAccess(
        1234,
        "other-org",
        "private-repo",
      );

      expect(result.authorized).toBe(false);
      expect(result.readOnlyCompliant).toBe(false);
      expect(result.reason).toContain("not granted in GitHub App installation");
    });
  });

  describe("listInstallationRepositories", () => {
    it("should list authorized repositories for an installation", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          repositories: [
            {
              id: 1,
              name: "repo1",
              full_name: "org/repo1",
              owner: { login: "org" },
              default_branch: "main",
              private: false,
              permissions: { pull: true, push: false },
            },
            {
              id: 2,
              name: "repo2",
              full_name: "org/repo2",
              owner: { login: "org" },
              default_branch: "master",
              private: true,
              permissions: { pull: true, push: false },
            },
          ],
        }),
      } as Response);

      const repos = await client.listInstallationRepositories(1234);
      expect(repos).toHaveLength(2);
      expect(repos[0].fullName).toBe("org/repo1");
      expect(repos[0].permissions.contents).toBe("read");
      expect(repos[1].fullName).toBe("org/repo2");
    });

    it("should throw GitHubForbiddenError if listing fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      } as Response);

      await expect(
        client.listInstallationRepositories(1234),
      ).rejects.toThrow(GitHubForbiddenError);
    });
  });

  describe("getRepository", () => {
    it("should validate owner and repo parameters", async () => {
      await expect(client.getRepository(1234, "", "repo")).rejects.toThrow(
        GitHubValidationError,
      );
      await expect(client.getRepository(1234, "owner", "")).rejects.toThrow(
        GitHubValidationError,
      );
    });

    it("should throw GitHubNotFoundError on 404", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not Found" }),
      } as Response);

      await expect(
        client.getRepository(1234, "org", "nonexistent"),
      ).rejects.toThrow(GitHubNotFoundError);
    });
  });
});
