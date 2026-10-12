import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import {
  GitHubAppAuthService,
  normalizePrivateKey,
  createGitHubAppJwt,
} from "./github-app-auth.service";
import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubValidationError,
} from "./github.errors";

describe("GitHubAppAuthService (Sprint 3 Part 4)", () => {
  let testKeyPair: { publicKey: string; privateKey: string };
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    // Generate an ephemeral 2048-bit RSA key pair for cryptographic testing
    testKeyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  });

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // --- 1. Private Key Parsing and Normalization ---
  describe("normalizePrivateKey", () => {
    it("should accept a standard valid PEM private key", () => {
      const normalized = normalizePrivateKey(testKeyPair.privateKey);
      expect(normalized).toContain("-----BEGIN PRIVATE KEY-----");
      expect(normalized).toContain("-----END PRIVATE KEY-----");
    });

    it("should parse private key with escaped newlines (\\n) commonly used in .env", () => {
      const escapedKey = testKeyPair.privateKey.replace(/\n/g, "\\n");
      const normalized = normalizePrivateKey(escapedKey);
      expect(normalized).toBe(testKeyPair.privateKey.trim());
    });

    it("should parse base64-encoded private key", () => {
      const base64Key = Buffer.from(testKeyPair.privateKey, "utf8").toString(
        "base64",
      );
      const normalized = normalizePrivateKey(base64Key);
      expect(normalized).toBe(testKeyPair.privateKey.trim());
    });

    it("should strip surrounding quotes and whitespace", () => {
      const quotedKey = `"${testKeyPair.privateKey}"`;
      const normalized = normalizePrivateKey(quotedKey);
      expect(normalized).toBe(testKeyPair.privateKey.trim());
    });

    it("should strip trailing newlines and whitespace consistently", () => {
      const keyWithTrailingWhitespace = `${testKeyPair.privateKey}\n\n  \n`;
      const normalized = normalizePrivateKey(keyWithTrailingWhitespace);
      expect(normalized).toBe(testKeyPair.privateKey.trim());
    });

    it("should throw GitHubAuthError for missing or empty key", () => {
      expect(() => normalizePrivateKey("")).toThrow(GitHubAuthError);
      expect(() => normalizePrivateKey("   ")).toThrow(GitHubAuthError);
      expect(() => normalizePrivateKey(null as any)).toThrow(GitHubAuthError);
    });

    it("should throw GitHubAuthError for corrupt or invalid private key without leaking key", () => {
      const corruptKey = "-----BEGIN RSA PRIVATE KEY-----\ncorrupt_payload\n-----END RSA PRIVATE KEY-----";
      try {
        normalizePrivateKey(corruptKey);
        fail("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubAuthError);
        expect(err.message).not.toContain("corrupt_payload");
        expect(err.message).toContain("failed to parse RSA private key");
      }
    });
  });

  // --- 2. RS256 JWT Generation ---
  describe("createGitHubAppJwt & generateAppJwt", () => {
    it("should generate a valid RS256 JWT that verifies against the public key", () => {
      const appId = "123456";
      const jwt = createGitHubAppJwt(appId, testKeyPair.privateKey);

      const parts = jwt.split(".");
      expect(parts).toHaveLength(3);

      const [headerB64, payloadB64, signatureB64] = parts;
      const header = JSON.parse(
        Buffer.from(headerB64, "base64url").toString("utf8"),
      );
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      );

      expect(header.alg).toBe("RS256");
      expect(header.typ).toBe("JWT");
      expect(payload.iss).toBe("123456");
      expect(payload.exp - payload.iat).toBe(600); // 10 minutes total window (9 min + 60s drift)

      // Cryptographically verify signature using public key
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();

      const signature = Buffer.from(signatureB64, "base64url");
      const isValid = verifier.verify(testKeyPair.publicKey, signature);
      expect(isValid).toBe(true);
    });

    it("should throw GitHubAuthError if unconfigured", () => {
      const service = new GitHubAppAuthService(undefined, undefined);
      expect(service.isConfigured()).toBe(false);
      expect(() => service.generateAppJwt()).toThrow(GitHubAuthError);
    });
  });

  // --- 3. Installation Access Token Generation & Caching ---
  describe("getInstallationAccessToken", () => {
    function createService(refreshBufferMs = 5 * 60 * 1000): GitHubAppAuthService {
      const configService = {
        get: (key: string) => {
          if (key === "GITHUB_APP_ID") return "998877";
          if (key === "GITHUB_APP_PRIVATE_KEY") return testKeyPair.privateKey;
          return undefined;
        },
      } as ConfigService;

      return new GitHubAppAuthService(
        configService,
        "https://api.github.test",
        refreshBufferMs,
      );
    }

    it("should reject invalid installation IDs", async () => {
      const service = createService();
      await expect(service.getInstallationAccessToken(0)).rejects.toThrow(
        GitHubValidationError,
      );
      await expect(service.getInstallationAccessToken(-5)).rejects.toThrow(
        GitHubValidationError,
      );
      await expect(service.getInstallationAccessToken(NaN)).rejects.toThrow(
        GitHubValidationError,
      );
    });

    it("should successfully fetch, cache, and return an installation token", async () => {
      const service = createService();
      const mockExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
      const mockToken = "ghs_testInstallationAccessToken1234567890";

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          token: mockToken,
          expires_at: mockExpiry,
          permissions: { contents: "read", issues: "read" },
        }),
      } as Response);

      // First call: fetches from GitHub
      const token1 = await service.getInstallationAccessToken(1001);
      expect(token1).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify cached token
      const cached = service.getCachedToken(1001);
      expect(cached).toBeDefined();
      expect(cached?.token).toBe(mockToken);

      // Second call: served from memory cache without new fetch call
      const token2 = await service.getInstallationAccessToken(1001);
      expect(token2).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should refresh token safely when within the refresh buffer window", async () => {
      // 5-minute buffer
      const service = createService(5 * 60 * 1000);
      const now = Date.now();

      // Token expiring in 3 minutes (within 5 min buffer)
      const nearExpiry = new Date(now + 3 * 60 * 1000).toISOString();
      const freshExpiry = new Date(now + 60 * 60 * 1000).toISOString();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            token: "ghs_initialExpiringToken123456789",
            expires_at: nearExpiry,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            token: "ghs_refreshedToken9876543210123",
            expires_at: freshExpiry,
          }),
        } as Response);

      const token1 = await service.getInstallationAccessToken(1001);
      expect(token1).toBe("ghs_initialExpiringToken123456789");
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Next call sees it is within 5-minute buffer and refreshes
      const token2 = await service.getInstallationAccessToken(1001);
      expect(token2).toBe("ghs_refreshedToken9876543210123");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate concurrent requests for the same installation ID", async () => {
      const service = createService();
      const mockExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
      const mockToken = "ghs_concurrentToken123456789012345";

      let resolveFetch: (val: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      global.fetch = jest.fn().mockImplementation(() => fetchPromise);

      // Fire 3 simultaneous token requests
      const p1 = service.getInstallationAccessToken(2002);
      const p2 = service.getInstallationAccessToken(2002);
      const p3 = service.getInstallationAccessToken(2002);

      // Resolve HTTP response
      resolveFetch!({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          token: mockToken,
          expires_at: mockExpiry,
        }),
      });

      const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
      expect(res1).toBe(mockToken);
      expect(res2).toBe(mockToken);
      expect(res3).toBe(mockToken);

      // Only a single HTTP request was initiated
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should throw GitHubAuthError on HTTP 401", async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ message: "Bad credentials" }),
      } as Response);

      await expect(service.getInstallationAccessToken(1001)).rejects.toThrow(
        GitHubAuthError,
      );
    });

    it("should throw GitHubNotFoundError on HTTP 404 (revoked or uninstalled)", async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: "Not Found" }),
      } as Response);

      await expect(service.getInstallationAccessToken(1001)).rejects.toThrow(
        GitHubNotFoundError,
      );
    });

    it("should throw GitHubForbiddenError on HTTP 403 (suspended installation)", async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ message: "Installation suspended" }),
      } as Response);

      await expect(service.getInstallationAccessToken(1001)).rejects.toThrow(
        GitHubForbiddenError,
      );
    });

    it("should throw GitHubRateLimitError on HTTP 429", async () => {
      const service = createService();
      const headers = new Headers();
      headers.set("retry-after", "120");

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ message: "Too many requests" }),
      } as Response);

      try {
        await service.getInstallationAccessToken(1001);
        fail("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitHubRateLimitError);
        expect(err.retryAfterSeconds).toBe(120);
      }
    });

    it("should retry transient HTTP 500 errors and succeed if subsequent attempt succeeds", async () => {
      const service = createService();
      const mockExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: async () => ({ message: "Bad Gateway" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            token: "ghs_retrySucceededToken123456789",
            expires_at: mockExpiry,
          }),
        } as Response);

      const token = await service.getInstallationAccessToken(1001);
      expect(token).toBe("ghs_retrySucceededToken123456789");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should throw GitHubTransientError when transient HTTP errors exhaust retries", async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ message: "Service Unavailable" }),
      } as Response);

      await expect(service.getInstallationAccessToken(1001)).rejects.toThrow(
        GitHubTransientError,
      );
    });

    it("should support clearTokenCache for manual cache eviction", async () => {
      const service = createService();
      const mockExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          token: "ghs_tokenToEvict123456789012",
          expires_at: mockExpiry,
        }),
      } as Response);

      await service.getInstallationAccessToken(1001);
      expect(service.getCachedToken(1001)).toBeDefined();

      service.clearTokenCache(1001);
      expect(service.getCachedToken(1001)).toBeUndefined();
    });
  });
});
