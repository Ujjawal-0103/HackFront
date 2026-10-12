/**
 * Typed Error Hierarchy for GitHub Ingestion Adapter
 * Strictly scrubs credentials and authorization tokens from messages and inspectable properties.
 */

export function sanitizeErrorMessage(message: string): string {
  if (!message) return "";
  return message
    .replace(
      /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(
      /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)/g,
      "[REDACTED_GITHUB_TOKEN]",
    )
    .replace(/Bearer\s+[A-Za-z0-9_\-.]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/token\s+[A-Za-z0-9_\-.]+/gi, "token [REDACTED_TOKEN]");
}

export abstract class GitHubAdapterError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(sanitizeErrorMessage(message));
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.endpoint = endpoint ? sanitizeErrorMessage(endpoint) : undefined;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 401: Authentication failure (invalid, revoked, or expired token)
 */
export class GitHubAuthError extends GitHubAdapterError {
  constructor(
    message = "GitHub authentication failed: invalid or expired token",
    endpoint?: string,
  ) {
    super(message, 401, endpoint);
  }
}

/**
 * HTTP 403: Permission/authorization failure (insufficient scopes, SSO enforcement, or repository access denied)
 * Distinct from rate-limit exhaustion.
 */
export class GitHubForbiddenError extends GitHubAdapterError {
  constructor(
    message = "GitHub access denied: insufficient permissions or scopes",
    endpoint?: string,
  ) {
    super(message, 403, endpoint);
  }
}

/**
 * HTTP 404: Target repository, commit, pull request, issue, or file was not found
 */
export class GitHubNotFoundError extends GitHubAdapterError {
  constructor(message = "GitHub resource not found", endpoint?: string) {
    super(message, 404, endpoint);
  }
}

/**
 * HTTP 403 / 429: Rate limit or secondary rate limit exceeded
 */
export class GitHubRateLimitError extends GitHubAdapterError {
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly resetAt?: Date;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    options?: {
      limit?: number;
      remaining?: number;
      resetAt?: Date;
      retryAfterSeconds?: number;
      endpoint?: string;
    },
  ) {
    super(message, 429, options?.endpoint);
    this.limit = options?.limit;
    this.remaining = options?.remaining;
    this.resetAt = options?.resetAt;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

/**
 * HTTP 5xx, network timeout, connection reset, or abort signal
 */
export class GitHubTransientError extends GitHubAdapterError {
  public readonly isTimeout: boolean;

  constructor(
    message: string,
    statusCode?: number,
    isTimeout = false,
    endpoint?: string,
  ) {
    super(message, statusCode, endpoint);
    this.isTimeout = isTimeout;
  }
}

/**
 * Malformed JSON, non-JSON response where JSON expected, or invalid API contract
 */
export class GitHubInvalidResponseError extends GitHubAdapterError {
  constructor(
    message = "Invalid or malformed response received from GitHub API",
    endpoint?: string,
  ) {
    super(message, undefined, endpoint);
  }
}

/**
 * Content exceeds bounded ingestion size limits (e.g. file or diff > 10MB)
 */
export class GitHubPayloadTooLargeError extends GitHubAdapterError {
  public readonly sizeBytes: number;
  public readonly maxBytes: number;

  constructor(sizeBytes: number, maxBytes: number, endpoint?: string) {
    super(
      `GitHub payload too large: ${sizeBytes} bytes exceeds limit of ${maxBytes} bytes`,
      413,
      endpoint,
    );
    this.sizeBytes = sizeBytes;
    this.maxBytes = maxBytes;
  }
}

/**
 * Client-side parameter validation failure (invalid repository identifier, malicious path traversal, invalid SHA)
 */
export class GitHubValidationError extends GitHubAdapterError {
  constructor(message: string, endpoint?: string) {
    super(message, 400, endpoint);
  }
}

/**
 * General or unclassified GitHub API response error (e.g. HTTP 400 Bad Request, HTTP 422 Unprocessable Entity)
 */
export class GitHubApiError extends GitHubAdapterError {
  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message, statusCode, endpoint);
  }
}
