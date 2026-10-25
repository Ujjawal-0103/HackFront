import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import {
  GitHubAdapterError,
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubInvalidResponseError,
  GitHubValidationError,
  GitHubApiError,
  sanitizeErrorMessage,
} from "./github.errors";
import { GITHUB_BASE_URL_TOKEN } from "./github-adapter.interface";

export const GITHUB_TOKEN_REFRESH_BUFFER_TOKEN =
  "GITHUB_TOKEN_REFRESH_BUFFER_TOKEN";

export interface CachedInstallationToken {
  token: string;
  expiresAt: Date;
  cachedAt: Date;
}

const DEFAULT_BASE_URL = "https://api.github.com";
// Refresh token 5 minutes before expiration (GitHub installation tokens expire in 60 minutes)
const DEFAULT_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Safely parses and normalizes a GitHub App PEM private key.
 * Handles standard multiline PEM, escaped newlines (\\n), base64 encoded strings, and surrounding quotes.
 * Cryptographically verifies key parseability without leaking key contents on error.
 */
export function normalizePrivateKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
    throw new GitHubAuthError("GitHub App private key is missing or empty");
  }

  let cleaned = rawKey.trim();

  // Strip wrapping single or double quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Normalize Windows CRLF
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Expand escaped newlines from .env or JSON configurations
  if (cleaned.includes("\\n")) {
    cleaned = cleaned.replace(/\\n/g, "\n");
  }

  // Detect and decode base64 encoded PEM keys
  if (!cleaned.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(cleaned, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) {
        cleaned = decoded.trim();
      }
    } catch {
      // Not base64; fall through to validation
    }
  }

  // Ensure any trailing or leading whitespace/newlines are stripped
  cleaned = cleaned.trim();

  // Cryptographically validate that the key is parseable
  try {
    crypto.createPrivateKey(cleaned);
  } catch {
    throw new GitHubAuthError(
      "Invalid GitHub App private key: failed to parse RSA private key",
    );
  }

  return cleaned;
}

/**
 * Creates an RS256 JWT for GitHub App authentication (valid for up to 10 minutes).
 */
export function createGitHubAppJwt(
  appId: string | number,
  privateKeyPem: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iat: now - 60, // 60-second allowance for clock drift
    exp: now + 9 * 60, // 9 minutes expiration (GitHub allows max 10 minutes)
    iss: String(appId).trim(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(privateKeyPem);
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

@Injectable()
export class GitHubAppAuthService {
  private readonly logger = new Logger(GitHubAppAuthService.name);
  private readonly appId?: string;
  private readonly privateKey?: string;
  private readonly baseUrl: string;
  private readonly refreshBufferMs: number;
  private readonly tokenCache = new Map<number, CachedInstallationToken>();
  private readonly inFlightRefreshes = new Map<number, Promise<string>>();

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(GITHUB_BASE_URL_TOKEN) customBaseUrl?: string,
    @Optional()
    @Inject(GITHUB_TOKEN_REFRESH_BUFFER_TOKEN)
    customRefreshBufferMs?: number,
  ) {
    const rawAppId =
      this.configService?.get<string>("GITHUB_APP_ID") ||
      this.configService?.get<string>("github.appId");
    let rawPrivateKey =
      this.configService?.get<string>("GITHUB_APP_PRIVATE_KEY") ||
      this.configService?.get<string>("github.privateKey");

    if (!rawPrivateKey) {
      const keyPath =
        this.configService?.get<string>("GITHUB_APP_PRIVATE_KEY_PATH") ||
        this.configService?.get<string>("github.privateKeyPath");
      if (keyPath) {
        try {
          const fs = require("fs");
          const path = require("path");
          const candidatePaths = path.isAbsolute(keyPath)
            ? [keyPath]
            : [
                path.resolve(process.cwd(), keyPath),
                path.resolve(process.cwd(), "../..", keyPath),
                path.resolve(process.cwd(), "..", keyPath),
                path.resolve(__dirname, "../../..", keyPath),
                path.resolve(__dirname, "../../../..", keyPath),
              ];
          for (const cand of candidatePaths) {
            if (fs.existsSync(cand)) {
              rawPrivateKey = fs.readFileSync(cand, "utf8");
              break;
            }
          }
        } catch (readErr: any) {
          this.logger.warn(
            `Failed to read GITHUB_APP_PRIVATE_KEY_PATH: ${sanitizeErrorMessage(readErr.message)}`,
          );
        }
      }
    }

    this.appId = rawAppId ? String(rawAppId).trim() : undefined;

    if (rawPrivateKey) {
      try {
        this.privateKey = normalizePrivateKey(rawPrivateKey);
      } catch (err: any) {
        this.logger.warn(
          `Failed to parse configured GITHUB_APP_PRIVATE_KEY: ${sanitizeErrorMessage(err.message)}`,
        );
        this.privateKey = undefined;
      }
    }

    this.baseUrl =
      customBaseUrl ||
      this.configService?.get<string>("GITHUB_API_BASE_URL") ||
      this.configService?.get<string>("github.baseUrl") ||
      DEFAULT_BASE_URL;

    this.refreshBufferMs =
      customRefreshBufferMs ??
      this.configService?.get<number>("GITHUB_TOKEN_REFRESH_BUFFER_MS") ??
      DEFAULT_REFRESH_BUFFER_MS;
  }

  /**
   * Returns true if both App ID and a valid private key are configured.
   */
  isConfigured(): boolean {
    return Boolean(this.appId && this.privateKey);
  }

  /**
   * Generates a signed GitHub App JWT for authenticating app-level API requests.
   */
  generateAppJwt(): string {
    if (!this.appId || !this.privateKey) {
      throw new GitHubAuthError(
        "GitHub App authentication unconfigured: missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY",
      );
    }
    return createGitHubAppJwt(this.appId, this.privateKey);
  }

  /**
   * Retrieves an installation access token for the given installation ID.
   * Caches tokens in memory until shortly before expiry (default 5 minutes prior).
   * Automatically refreshes expiring tokens and deduplicates concurrent in-flight requests.
   */
  async getInstallationAccessToken(installationId: number): Promise<string> {
    if (!this.isConfigured()) {
      throw new GitHubAuthError(
        "GitHub App authentication unconfigured: missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY",
      );
    }

    if (
      !installationId ||
      !Number.isInteger(installationId) ||
      installationId <= 0
    ) {
      throw new GitHubValidationError(
        `Invalid installation ID: "${installationId}" must be a positive integer`,
      );
    }

    // Check in-memory cache
    const cached = this.tokenCache.get(installationId);
    if (cached && !this.isTokenExpiring(cached)) {
      return cached.token;
    }

    // Deduplicate concurrent requests for the same installation
    const inFlight = this.inFlightRefreshes.get(installationId);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = this.fetchAndCacheInstallationToken(installationId);
    this.inFlightRefreshes.set(installationId, refreshPromise);

    try {
      return await refreshPromise;
    } finally {
      this.inFlightRefreshes.delete(installationId);
    }
  }

  /**
   * Checks if a cached token is expired or within the refresh buffer window.
   */
  private isTokenExpiring(cached: CachedInstallationToken): boolean {
    return Date.now() >= cached.expiresAt.getTime() - this.refreshBufferMs;
  }

  /**
   * Requests a new installation access token from the GitHub API and caches it.
   */
  private async fetchAndCacheInstallationToken(
    installationId: number,
  ): Promise<string> {
    const appJwt = this.generateAppJwt();
    const endpoint = `/app/installations/${encodeURIComponent(installationId)}/access_tokens`;
    const url = `${this.baseUrl}${endpoint}`;

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Traceback-GitHub-App-Auth/1.0",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as {
            token: string;
            expires_at: string;
            permissions?: Record<string, string>;
          };

          if (!data?.token || !data?.expires_at) {
            throw new GitHubInvalidResponseError(
              "GitHub installation token response missing token or expires_at",
              endpoint,
            );
          }

          const expiresAt = new Date(data.expires_at);
          this.tokenCache.set(installationId, {
            token: data.token,
            expiresAt,
            cachedAt: new Date(),
          });

          return data.token;
        }

        const status = response.status;
        let responseBody: any = null;
        try {
          responseBody = await response.json();
        } catch {
          // Response body was not JSON
        }
        const message =
          responseBody?.message || response.statusText || `HTTP ${status}`;

        // 1. Authentication failure (invalid credentials or bad private key)
        if (status === 401) {
          throw new GitHubAuthError(
            `GitHub App authentication failed: ${message}`,
            endpoint,
          );
        }

        // 2. Installation not found or revoked/uninstalled
        if (status === 404) {
          throw new GitHubNotFoundError(
            `GitHub installation ${installationId} not found or revoked: ${message}`,
            endpoint,
          );
        }

        // 3. Rate limiting (429 or 403 quota exhaustion)
        const retryAfterHeader = response.headers.get("retry-after");
        const remaining = response.headers.get("x-ratelimit-remaining");
        const isRateLimit =
          status === 429 ||
          (status === 403 &&
            (remaining === "0" || /rate limit/i.test(message)));

        if (isRateLimit) {
          const retryAfterSeconds = retryAfterHeader
            ? parseInt(retryAfterHeader, 10)
            : undefined;
          throw new GitHubRateLimitError(
            `GitHub rate limit exceeded during installation token generation: ${message}`,
            {
              retryAfterSeconds,
              endpoint,
            },
          );
        }

        // 4. Access forbidden (suspended installation or permissions error)
        if (status === 403) {
          throw new GitHubForbiddenError(
            `GitHub installation ${installationId} access denied or suspended: ${message}`,
            endpoint,
          );
        }

        // 5. Transient Server Errors (500, 502, 503, 504) -> retry with backoff
        if ([500, 502, 503, 504].includes(status)) {
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000);
            await this.delay(backoffMs);
            continue;
          }
          throw new GitHubTransientError(
            `GitHub transient server error HTTP ${status} exhausted retries on ${endpoint}: ${message}`,
            status,
            false,
            endpoint,
          );
        }

        // Other client errors
        throw new GitHubApiError(
          `GitHub installation token request failed HTTP ${status}: ${message}`,
          status,
          endpoint,
        );
      } catch (err: any) {
        if (err instanceof GitHubAdapterError) {
          throw err;
        }

        if (attempt <= maxRetries) {
          const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000);
          await this.delay(backoffMs);
          continue;
        }

        throw new GitHubTransientError(
          `GitHub installation token network request failed on ${endpoint}: ${sanitizeErrorMessage(err.message)}`,
          undefined,
          false,
          endpoint,
        );
      }
    }

    throw new GitHubTransientError(
      `GitHub installation token request exhausted retries on ${endpoint}`,
    );
  }

  /**
   * Manually invalidates cached tokens for a specific installation or all installations.
   */
  clearTokenCache(installationId?: number): void {
    if (installationId !== undefined) {
      this.tokenCache.delete(installationId);
    } else {
      this.tokenCache.clear();
    }
  }

  /**
   * Returns cached token metadata for inspection in tests.
   */
  getCachedToken(installationId: number): CachedInstallationToken | undefined {
    return this.tokenCache.get(installationId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
