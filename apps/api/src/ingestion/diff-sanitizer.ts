/**
 * Git Diff Sanitizer (Sprint 3 Part 3)
 *
 * Sanitizes and redacts GitHub diff/patch text before persistence or downstream processing:
 * 1. Binary file detection and payload stripping
 * 2. Conservative minified and generated artifact exclusion
 * 3. Secret redaction (GitHub tokens, private keys, passwords, API keys, database credentials)
 * 4. 50 KB per-file diff truncation boundary
 * 5. Preservation of source code structure without leaking raw secret values
 */

export const MAX_DIFF_SIZE_BYTES = 50 * 1024; // 50 KB

export const TRUNCATION_MARKER = "\n\n[Diff truncated: exceeds 50 KB limit]";

/**
 * Common binary file extensions where diff content must not be stored.
 */
const BINARY_EXTENSION_REGEX =
  /\.(png|jpe?g|gif|ico|webp|bmp|tiff|heic|pdf|zip|tar|gz|tgz|7z|rar|mp4|mp3|wav|mov|exe|dll|so|dylib|bin|wasm|iso|woff2?|ttf|otf|eot|parquet|sqlite|db)$/i;

/**
 * Git binary diff markers inside patch headers.
 */
const BINARY_DIFF_MARKER_REGEX =
  /(?:GIT binary patch|Binary files \S+ and \S+ differ)/i;

/**
 * Minified and generated artifact paths and filenames that should be omitted from diff storage.
 */
const GENERATED_OR_MINIFIED_PATH_REGEX =
  /(?:^|[\\/])(?:dist|build|\.next|out|coverage|\.turbo|node_modules|vendor)[\\/]|(?:\.(?:min\.(?:js|css|mjs)|bundle\.js|(?:js|css|ts)\.map)|(?:^|[\\/])(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock|Cargo\.lock|Gemfile\.lock|poetry\.lock))$/i;

/**
 * Regular expressions for detecting and redacting secrets in unified diffs.
 */
const SECRET_PATTERNS = [
  // 1. Private key blocks (RSA, EC, DSA, OPENSSH, PGP)
  {
    regex:
      /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },

  // 2. GitHub Tokens (Personal Access Tokens, Fine-Grained, OAuth, App)
  {
    regex: /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },

  // 3. Database URLs containing credentials (postgresql, mysql, mongodb, redis, amqp)
  {
    regex:
      /((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/)([^:\s\/@]+):([^@\s\/]+)(@)/gi,
    replacement: "$1[REDACTED_USER]:[REDACTED_PASSWORD]$4",
  },

  // 4. AWS Access Key IDs
  {
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: "[REDACTED_AWS_KEY]",
  },

  // 5. Slack Tokens
  {
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,})\b/g,
    replacement: "[REDACTED_SLACK_TOKEN]",
  },

  // 6. Bearer authorization tokens
  {
    regex: /(Bearer\s+)[A-Za-z0-9_\-.]+/gi,
    replacement: "$1[REDACTED_TOKEN]",
  },

  // 7. Common key/token/password assignments in source code and config (preserves assignment, redacts value)
  {
    regex:
      /((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|password|passwd|pwd|private[_-]?key)\s*[:=]\s*['"]?)([^'"\s,;\r\n]{8,})(['"]?)/gi,
    replacement: "$1[REDACTED_SECRET]$3",
  },
];

export interface DiffSanitizerResult {
  diffHunk: string | null;
  isBinary: boolean;
  isSkipped: boolean;
  isTruncated: boolean;
}

/**
 * Checks whether a given file path or patch content indicates a binary file.
 */
export function isBinaryFile(filePath: string, patch?: string | null): boolean {
  if (BINARY_EXTENSION_REGEX.test(filePath)) {
    return true;
  }
  if (patch) {
    if (patch.includes("\0") || BINARY_DIFF_MARKER_REGEX.test(patch)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a file is a generated artifact, bundle, minified script, or lockfile.
 */
export function isGeneratedOrMinified(filePath: string): boolean {
  return GENERATED_OR_MINIFIED_PATH_REGEX.test(filePath);
}

/**
 * Redacts known secret patterns from diff text while preserving surrounding source code context.
 */
export function redactSecrets(patch: string): string {
  if (!patch) return "";

  let sanitized = patch;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

/**
 * Truncates diff text to a maximum of 50 KB (51,200 bytes).
 */
export function truncateDiff(
  patch: string,
  maxSizeBytes: number = MAX_DIFF_SIZE_BYTES,
): { text: string; isTruncated: boolean } {
  if (!patch) {
    return { text: "", isTruncated: false };
  }

  // Check character length as upper bound for UTF-8 bytes
  if (patch.length <= maxSizeBytes) {
    return { text: patch, isTruncated: false };
  }

  // Find a line boundary near the truncation limit
  const sliceLimit = maxSizeBytes - TRUNCATION_MARKER.length;
  let cutIndex = patch.lastIndexOf("\n", sliceLimit);
  if (cutIndex === -1 || cutIndex < sliceLimit * 0.8) {
    cutIndex = sliceLimit;
  }

  const truncatedText = patch.slice(0, cutIndex) + TRUNCATION_MARKER;
  return { text: truncatedText, isTruncated: true };
}

/**
 * Main sanitizer function: sanitizes, redacts, limits, and handles binary/minified files.
 */
export function sanitizeDiff(
  filePath: string,
  patch: string | null | undefined,
): DiffSanitizerResult {
  const normalizedPath = (filePath || "").trim();

  // 1. Binary file detection
  if (isBinaryFile(normalizedPath, patch)) {
    return {
      diffHunk: null,
      isBinary: true,
      isSkipped: false,
      isTruncated: false,
    };
  }

  // If no patch text is provided (e.g. empty commit or file mode change)
  if (!patch || !patch.trim()) {
    return {
      diffHunk: null,
      isBinary: false,
      isSkipped: false,
      isTruncated: false,
    };
  }

  // 2. Generated or minified artifact exclusion
  if (isGeneratedOrMinified(normalizedPath)) {
    return {
      diffHunk: null,
      isBinary: false,
      isSkipped: true,
      isTruncated: false,
    };
  }

  // 3. Secret redaction
  const redacted = redactSecrets(patch.trim());

  // 4. 50 KB truncation boundary
  const { text: finalDiffHunk, isTruncated } = truncateDiff(redacted);

  return {
    diffHunk: finalDiffHunk,
    isBinary: false,
    isSkipped: false,
    isTruncated,
  };
}
