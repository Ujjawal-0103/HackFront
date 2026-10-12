import { Test } from "@nestjs/testing";
import { ConfigService, ConfigModule } from "@nestjs/config";
import { GitHubModule } from "./github.module";
import {
  GITHUB_BASE_URL_TOKEN,
  GITHUB_INGESTION_ADAPTER_TOKEN,
} from "./github-adapter.interface";
import { GitHubIngestionAdapter } from "./github-ingestion.adapter";
import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubInvalidResponseError,
  GitHubPayloadTooLargeError,
  GitHubAdapterError,
  GitHubValidationError,
  sanitizeErrorMessage,
} from "./github.errors";

describe("GitHubIngestionAdapter (Sprint 3 Part 3)", () => {
  let adapter: GitHubIngestionAdapter;
  const mockBaseUrl = "https://mock.api.github.test";
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    adapter = new GitHubIngestionAdapter(undefined, mockBaseUrl);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // --- 1. Repository Metadata ---
  describe("getRepository", () => {
    it("should successfully fetch and map repository metadata", async () => {
      const mockRepoPayload = {
        id: 12345,
        name: "HackFront",
        full_name: "Ujjawal-0103/HackFront",
        owner: { login: "Ujjawal-0103" },
        description: "Verified code rationale verification",
        default_branch: "main",
        private: false,
        fork: false,
        created_at: "2026-10-09T00:00:00Z",
        updated_at: "2026-10-10T00:00:00Z",
        pushed_at: "2026-10-11T00:00:00Z",
        size: 5120,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockRepoPayload,
      } as Response);

      const result = await adapter.getRepository("Ujjawal-0103", "HackFront");

      expect(result.id).toBe(12345);
      expect(result.fullName).toBe("Ujjawal-0103/HackFront");
      expect(result.defaultBranch).toBe("main");
      expect(result.isPrivate).toBe(false);
      expect(result.sizeKb).toBe(5120);
    });

    it("should reject invalid repository owner with malicious path traversal", async () => {
      await expect(
        adapter.getRepository("../malicious", "repo"),
      ).rejects.toThrow(GitHubValidationError);
    });
  });

  // --- 2. Commits & Pagination ---
  describe("getCommits & getCommit", () => {
    it("should parse paginated commit list and terminate when items < perPage", async () => {
      const mockCommits = [
        {
          sha: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
          commit: {
            message: "fix: memoize row count mapper",
            author: {
              name: "Alex",
              email: "alex@co.com",
              date: "2025-04-12T10:00:00Z",
            },
            committer: {
              name: "Alex",
              email: "alex@co.com",
              date: "2025-04-12T10:00:00Z",
            },
          },
          html_url: "https://github.com/org/repo/commit/7a8b9c",
          parents: [{ sha: "parent1" }],
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "4950",
          "x-ratelimit-reset": "1760000000",
        }),
        json: async () => mockCommits,
      } as Response);

      const result = await adapter.getCommits("Ujjawal-0103", "HackFront", {
        page: 1,
        perPage: 30,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sha).toBe(
        "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
      );
      expect(result.hasMore).toBe(false);
      expect(result.rateLimit?.remaining).toBe(4950);
    });

    it("should detect hasMore when Link header includes rel='next'", async () => {
      const mockCommits = new Array(30).fill(null).map((_, i) => ({
        sha: `sha_${i}`,
        commit: { message: `commit ${i}` },
        parents: [],
      }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          link: '<https://api.github.com/repos/org/repo/commits?page=2>; rel="next"',
        }),
        json: async () => mockCommits,
      } as Response);

      const result = await adapter.getCommits("Ujjawal-0103", "HackFront", {
        page: 1,
        perPage: 30,
      });

      expect(result.items).toHaveLength(30);
      expect(result.hasMore).toBe(true);
      expect(result.nextUrl).toBe(
        "https://api.github.com/repos/org/repo/commits?page=2",
      );
    });

    it("should extract nextUrl from Link header and parse continuation URL", async () => {
      const mockCommits = [
        {
          sha: "c1",
          commit: {
            message: "msg",
            author: { name: "A", date: "2026-01-01" },
            committer: { name: "A", date: "2026-01-01" },
          },
          parents: [],
        },
      ];

      const linkHeader =
        '<https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2&per_page=30>; rel="next", <https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=5&per_page=30>; rel="last"';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ link: linkHeader }),
        json: async () => mockCommits,
      } as Response);

      const result = await adapter.getCommits("Ujjawal-0103", "HackFront", {
        page: 1,
        perPage: 30,
      });
      expect(result.hasMore).toBe(true);
      expect(result.nextUrl).toBe(
        "https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2&per_page=30",
      );
    });

    it("should fetch commits from continuation URL safely", async () => {
      const mockCommits = [
        {
          sha: "c2",
          commit: {
            message: "page 2 commit",
            author: { name: "B", date: "2026-01-02" },
            committer: { name: "B", date: "2026-01-02" },
          },
          parents: [],
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockCommits,
      } as Response);

      const continuationUrl =
        "https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2&per_page=30";
      const result = await adapter.getCommitsFromContinuationUrl(
        "Ujjawal-0103",
        "HackFront",
        continuationUrl,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sha).toBe("c2");
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(30);
    });

    it("should validate safe continuation URLs and reject insecure or SSRF URLs", () => {
      // 1. Valid URLs
      expect(
        adapter.validateContinuationUrl(
          "https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2",
          "Ujjawal-0103",
          "HackFront",
        ),
      ).toBe(
        "https://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2",
      );

      expect(
        adapter.validateContinuationUrl(
          "https://mock.api.github.test/repositories/12345/commits?page=2",
          "Ujjawal-0103",
          "HackFront",
        ),
      ).toBe("https://mock.api.github.test/repositories/12345/commits?page=2");

      // 2. Reject non-HTTPS
      expect(() =>
        adapter.validateContinuationUrl(
          "http://mock.api.github.test/repos/Ujjawal-0103/HackFront/commits?page=2",
          "Ujjawal-0103",
          "HackFront",
        ),
      ).toThrow(GitHubValidationError);

      // 3. Reject wrong host (SSRF attack)
      expect(() =>
        adapter.validateContinuationUrl(
          "https://evil-attacker.com/repos/Ujjawal-0103/HackFront/commits?page=2",
          "Ujjawal-0103",
          "HackFront",
        ),
      ).toThrow(GitHubValidationError);

      // 4. Reject mismatched repo or path
      expect(() =>
        adapter.validateContinuationUrl(
          "https://mock.api.github.test/repos/attacker/malicious-repo/commits?page=2",
          "Ujjawal-0103",
          "HackFront",
        ),
      ).toThrow(GitHubValidationError);

      // 5. Reject unexpected endpoint traversal
      expect(() =>
        adapter.validateContinuationUrl(
          "https://mock.api.github.test/repos/Ujjawal-0103/HackFront/admin",
          "Ujjawal-0103",
          "HackFront",
          "commits",
        ),
      ).toThrow(GitHubValidationError);
    });

    it("should fetch commit detail with changed files and patch hunks", async () => {
      const mockDetail = {
        sha: "abc1234",
        commit: {
          message: "refactor: optimize table rendering",
          author: { name: "Dev", date: "2025-01-01T00:00:00Z" },
        },
        stats: { additions: 10, deletions: 2, total: 12 },
        files: [
          {
            filename: "src/table.ts",
            status: "modified",
            additions: 10,
            deletions: 2,
            changes: 12,
            patch: "@@ -1,2 +1,10 @@\n+ const memoized = true;",
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockDetail,
      } as Response);

      const detail = await adapter.getCommit(
        "Ujjawal-0103",
        "HackFront",
        "abc1234",
      );

      expect(detail.sha).toBe("abc1234");
      expect(detail.stats.total).toBe(12);
      expect(detail.files[0].filename).toBe("src/table.ts");
      expect(detail.files[0].patch).toContain("memoized");
    });
  });

  // --- 3. Pull Requests, Reviews & Comments ---
  describe("Pull Requests & Discussions", () => {
    it("should fetch pull requests and available reviews", async () => {
      const mockPulls = [
        {
          number: 42,
          title: "Streaming table optimization",
          body: "Fixes memory leak on large datasets",
          state: "closed",
          user: { login: "maintainer-alex" },
          draft: false,
          created_at: "2025-04-10T00:00:00Z",
          updated_at: "2025-04-12T00:00:00Z",
          merged_at: "2025-04-12T00:00:00Z",
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockPulls,
      } as Response);

      const res = await adapter.getPullRequests("Ujjawal-0103", "HackFront");
      expect(res.items).toHaveLength(1);
      expect(res.items[0].number).toBe(42);
      expect(res.items[0].state).toBe("closed");
      expect(res.items[0].mergedAt).toBe("2025-04-12T00:00:00Z");
    });
  });

  // --- 4. Issues & Comments ---
  describe("Issues", () => {
    it("should fetch issues and comments cleanly", async () => {
      const mockIssues = [
        {
          number: 101,
          title: "Performance issue with large table",
          state: "closed",
          user: { login: "tester" },
          pull_request: null, // Pure issue, not PR
          comments: 3,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-02T00:00:00Z",
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockIssues,
      } as Response);

      const res = await adapter.getIssues("Ujjawal-0103", "HackFront");
      expect(res.items[0].number).toBe(101);
      expect(res.items[0].isPullRequest).toBe(false);
    });
  });

  // --- 5. File Trees & README ---
  describe("File Trees and Content", () => {
    it("should fetch and decode base64 file content", async () => {
      const mockFilePayload = {
        type: "file",
        path: "README.md",
        sha: "blob_123",
        size: 32,
        encoding: "base64",
        content: Buffer.from("# Welcome to Traceback").toString("base64"),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockFilePayload,
      } as Response);

      const file = await adapter.getFileContent(
        "Ujjawal-0103",
        "HackFront",
        "README.md",
      );
      expect(file.content).toBe("# Welcome to Traceback");
      expect(file.size).toBe(32);
    });

    it("should reject file exceeding bounded size limit", async () => {
      const mockOversizedPayload = {
        type: "file",
        path: "large-bundle.js",
        sha: "blob_huge",
        size: 2 * 1024 * 1024, // 2MB exceeds 1MB limit
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockOversizedPayload,
      } as Response);

      await expect(
        adapter.getFileContent(
          "Ujjawal-0103",
          "HackFront",
          "large-bundle.js",
          undefined,
          {
            maxSizeBytes: 1024 * 1024,
          },
        ),
      ).rejects.toThrow(GitHubPayloadTooLargeError);
    });
  });

  // --- 6. Error Handling & Security ---
  describe("Error Mapping & Credential Protection", () => {
    it("should map HTTP 401 to GitHubAuthError without retrying", async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(),
        json: async () => ({ message: "Bad credentials" }),
      } as Response);
      global.fetch = fetchSpy;

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront", {
          token: "ghp_secretToken12345678901234567890",
        }),
      ).rejects.toThrow(GitHubAuthError);

      // Verify no retry was performed on 401
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should map HTTP 403 (insufficient permissions) to GitHubForbiddenError", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({ "x-ratelimit-remaining": "4000" }),
        json: async () => ({
          message: "Must have push access or SSO authorization",
        }),
      } as Response);

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubForbiddenError);
    });

    it("should map HTTP 404 to GitHubNotFoundError", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        json: async () => ({ message: "Not Found" }),
      } as Response);

      await expect(
        adapter.getRepository("Ujjawal-0103", "nonexistent-repo"),
      ).rejects.toThrow(GitHubNotFoundError);
    });

    it("should map depleted rate limit to GitHubRateLimitError with Retry-After and reset time", async () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 120;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetUnix),
          "retry-after": "120",
        }),
        json: async () => ({ message: "API rate limit exceeded" }),
      } as Response);

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront");
        fail("Should have thrown GitHubRateLimitError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.remaining).toBe(0);
        expect(err.retryAfterSeconds).toBe(120);
        expect(err.resetAt).toBeDefined();
      }
    });

    it("should proactively trigger rate limit deferral when remaining quota is 99 (< 100)", async () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 300;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "99",
          "x-ratelimit-reset": String(resetUnix),
        }),
        json: async () => ({ id: 1, name: "repo", full_name: "org/repo" }),
      } as Response);

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront");
        fail("Should have thrown GitHubRateLimitError for remaining quota 99");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.remaining).toBe(99);
        expect(err.resetAt).toBeDefined();
        expect(err.message).toContain("low quota safety threshold");
      }

      // Subsequent request before resetAt is deferred immediately without calling fetch
      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubRateLimitError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should not trigger low-quota threshold when remaining quota is 100", async () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 300;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "100",
          "x-ratelimit-reset": String(resetUnix),
        }),
        json: async () => ({ id: 1, name: "repo", full_name: "org/repo" }),
      } as Response);

      const result = await adapter.getRepository("Ujjawal-0103", "HackFront");
      expect(result.id).toBe(1);
      expect(result.fullName).toBe("org/repo");
    });

    it("should handle depleted quota (remaining 0) and HTTP 429 secondary rate limit", async () => {
      // Depleted quota with HTTP 403
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
        }),
        json: async () => ({ message: "API rate limit exceeded" }),
      } as Response);

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubRateLimitError);

      adapter.clearRateLimitState();

      // HTTP 429 with retry-after
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({
          "retry-after": "60",
        }),
        json: async () => ({
          message: "You have exceeded a secondary rate limit",
        }),
      } as Response);

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront");
        fail("Should have thrown GitHubRateLimitError on HTTP 429");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.retryAfterSeconds).toBe(60);
      }
    });

    it("should handle missing or invalid reset timestamps safely without invalid Date or unbounded delay", async () => {
      // Missing x-ratelimit-reset header with low quota
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "50",
          // x-ratelimit-reset omitted
        }),
        json: async () => ({ id: 1, name: "repo", full_name: "org/repo" }),
      } as Response);

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront");
        fail("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.resetAt).toBeInstanceOf(Date);
        expect(isNaN(err.resetAt.getTime())).toBe(false);
        expect(err.retryAfterSeconds).toBeLessThanOrEqual(3600);
      }

      adapter.clearRateLimitState();

      // Malformed x-ratelimit-reset: "invalid_timestamp"
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "50",
          "x-ratelimit-reset": "invalid_timestamp",
        }),
        json: async () => ({ id: 1, name: "repo", full_name: "org/repo" }),
      } as Response);

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront");
        fail("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.resetAt).toBeInstanceOf(Date);
        expect(isNaN(err.resetAt.getTime())).toBe(false);
        expect(err.retryAfterSeconds).toBeLessThanOrEqual(3600);
      }
    });

    it("should enforce retry limits on transient errors without retrying rate limit errors", async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers(),
        json: async () => ({ message: "Service Unavailable" }),
      } as Response);
      global.fetch = fetchSpy;

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubTransientError);

      // Exactly 1 initial + 3 retries = 4 attempts total
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Rate limit errors are never retried by the HTTP engine
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "30" }),
        json: async () => ({ message: "Rate limit" }),
      } as Response);

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubRateLimitError);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should map malformed JSON response to GitHubInvalidResponseError", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      } as unknown as Response);

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubInvalidResponseError);
    });

    it("should retry transient HTTP 503 errors and exhaust bounded retries", async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers(),
        json: async () => ({
          message: "GitHub service temporarily unavailable",
        }),
      } as Response);
      global.fetch = fetchSpy;

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront"),
      ).rejects.toThrow(GitHubTransientError);

      // Initial request + 3 retries = 4 attempts total
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it("should handle caller abort signal with GitHubTransientError", async () => {
      const abortController = new AbortController();
      abortController.abort(); // Pre-aborted signal

      await expect(
        adapter.getRepository("Ujjawal-0103", "HackFront", {
          signal: abortController.signal,
        }),
      ).rejects.toThrow(GitHubTransientError);
    });

    it("should never expose secret token in error message", async () => {
      const sensitiveToken =
        "ghp_secretPersonalAccessToken98765432101234567890";
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error(`Failed to authenticate with token ${sensitiveToken}`),
        );

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront", {
          token: sensitiveToken,
        });
        fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).not.toContain(sensitiveToken);
        expect(err.message).toContain("[REDACTED_GITHUB_TOKEN]");
      }
    });

    it("should resolve token via authService when installationId is provided without explicit token", async () => {
      const mockAuthService = {
        getInstallationAccessToken: jest
          .fn()
          .mockResolvedValue("ghs_resolvedToken999888"),
      };
      const adapterWithAuth = new GitHubIngestionAdapter(
        undefined,
        mockBaseUrl,
        mockAuthService as any,
      );

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ id: 1, name: "repo", full_name: "org/repo" }),
      } as Response);

      await adapterWithAuth.getRepository("org", "repo", {
        installationId: 4321,
      });

      expect(mockAuthService.getInstallationAccessToken).toHaveBeenCalledWith(
        4321,
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/repos/org/repo"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer ghs_resolvedToken999888",
          }),
        }),
      );
    });

    it("should redact bare fine-grained PATs, classic tokens, and bearer credentials", () => {
      const bareFineGrained =
        "github_pat_11ABCD_mockSecretFineGrainedToken9876543210";
      const bareClassicPat = "ghp_mockClassicPersonalAccessToken1234567890";
      const bareInstallation = "ghs_mockInstallationToken123456789012345";
      const bareOAuth = "gho_mockOAuthAccessToken12345678901234567890";
      const bearerHeader = "Bearer secret_bearer_token_value_abc123";
      const tokenHeader = "token secret_token_header_val_xyz789";

      // 1. Direct sanitizer check on bare fine-grained PAT
      const sanitizedPat = sanitizeErrorMessage(
        `Failed with bare fine-grained token ${bareFineGrained}`,
      );
      expect(sanitizedPat).not.toContain(bareFineGrained);
      expect(sanitizedPat).toContain("[REDACTED_GITHUB_TOKEN]");

      // 2. Direct sanitizer checks on other token forms
      expect(sanitizeErrorMessage(`Token: ${bareClassicPat}`)).not.toContain(
        bareClassicPat,
      );
      expect(sanitizeErrorMessage(`Token: ${bareInstallation}`)).not.toContain(
        bareInstallation,
      );
      expect(sanitizeErrorMessage(`Token: ${bareOAuth}`)).not.toContain(
        bareOAuth,
      );
      expect(sanitizeErrorMessage(`Auth: ${bearerHeader}`)).toBe(
        "Auth: Bearer [REDACTED_TOKEN]",
      );
      expect(sanitizeErrorMessage(`Auth: ${tokenHeader}`)).toBe(
        "Auth: token [REDACTED_TOKEN]",
      );
      const privateKeyBlock =
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----";
      expect(sanitizeErrorMessage(`Key: ${privateKeyBlock}`)).toBe(
        "Key: [REDACTED_PRIVATE_KEY]",
      );

      // 3. GitHubAdapterError hierarchy sanitizes message and endpoint for bare fine-grained PAT
      const errorInstance = new GitHubAuthError(
        `Invalid token ${bareFineGrained}`,
        `/repos/org/repo?token=${bareFineGrained}`,
      );
      expect(errorInstance.message).not.toContain(bareFineGrained);
      expect(errorInstance.message).toContain("[REDACTED_GITHUB_TOKEN]");
      expect(errorInstance.endpoint).not.toContain(bareFineGrained);
      expect(errorInstance.endpoint).toContain("[REDACTED_GITHUB_TOKEN]");
    });

    it("should redact bare fine-grained PAT when adapter encounters network failure", async () => {
      const fineGrainedToken =
        "github_pat_11ABCD_mockSecretFineGrainedToken9876543210";
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error(`Connection failed using ${fineGrainedToken}`),
        );

      try {
        await adapter.getRepository("Ujjawal-0103", "HackFront", {
          token: fineGrainedToken,
        });
        fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).not.toContain(fineGrainedToken);
        expect(err.message).toContain("[REDACTED_GITHUB_TOKEN]");
      }
    });
  });

  // --- 7. Dependency Injection Resolution ---
  describe("NestJS Dependency Injection resolution", () => {
    it("should resolve dependencies cleanly without unregistered String dependency at index 1", async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          GitHubIngestionAdapter,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const instance = moduleRef.get<GitHubIngestionAdapter>(
        GitHubIngestionAdapter,
      );
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(GitHubIngestionAdapter);
    });

    it("should resolve custom baseUrl from ConfigService when configured", async () => {
      const customUrl = "https://custom-gh.internal";
      const moduleRef = await Test.createTestingModule({
        providers: [
          GitHubIngestionAdapter,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) => {
                if (key === "GITHUB_API_BASE_URL" || key === "github.baseUrl") {
                  return customUrl;
                }
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const instance = moduleRef.get<GitHubIngestionAdapter>(
        GitHubIngestionAdapter,
      );
      expect(instance).toBeDefined();
      expect(
        instance.validateContinuationUrl(
          `${customUrl}/repos/owner/repo/commits`,
          "owner",
          "repo",
        ),
      ).toBe(`${customUrl}/repos/owner/repo/commits`);
    });

    it("should resolve custom baseUrl from GITHUB_BASE_URL_TOKEN if provided", async () => {
      const tokenUrl = "https://token-gh.internal";
      const moduleRef = await Test.createTestingModule({
        providers: [
          GitHubIngestionAdapter,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          {
            provide: GITHUB_BASE_URL_TOKEN,
            useValue: tokenUrl,
          },
        ],
      }).compile();

      const instance = moduleRef.get<GitHubIngestionAdapter>(
        GitHubIngestionAdapter,
      );
      expect(instance).toBeDefined();
      expect(
        instance.validateContinuationUrl(
          `${tokenUrl}/repos/owner/repo/commits`,
          "owner",
          "repo",
        ),
      ).toBe(`${tokenUrl}/repos/owner/repo/commits`);
    });

    it("should compile within GitHubModule context without DI resolution errors", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true }), GitHubModule],
      }).compile();

      const instance = moduleRef.get<GitHubIngestionAdapter>(
        GitHubIngestionAdapter,
      );
      expect(instance).toBeDefined();
      const tokenInstance = moduleRef.get(GITHUB_INGESTION_ADAPTER_TOKEN);
      expect(tokenInstance).toBeDefined();
    });
  });
});
