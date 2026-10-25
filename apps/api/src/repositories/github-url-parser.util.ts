import { BadRequestException } from "@nestjs/common";

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  fullName: string;
  canonicalUrl: string;
}

const RESERVED_GITHUB_PATHS = new Set([
  "about",
  "pricing",
  "features",
  "security",
  "customer-stories",
  "enterprise",
  "explore",
  "topics",
  "collections",
  "trending",
  "login",
  "join",
  "signup",
  "settings",
  "organizations",
  "orgs",
  "apps",
  "marketplace",
  "issues",
  "pulls",
  "notifications",
  "search",
  "sponsors",
  "contact",
]);

const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Validates and parses an arbitrary user-supplied URL to extract a legitimate GitHub repository owner and name.
 * 
 * Strict security constraints:
 * - Only official github.com host permitted.
 * - Credential-bearing URLs (containing '@') are strictly rejected.
 * - Non-HTTP schemes are rejected.
 * - Reserved GitHub service paths are rejected.
 * - Formatting variations like trailing slashes, .git extensions, and branch fragments are cleanly normalized.
 */
export function parseGitHubRepositoryUrl(input: string): ParsedGitHubUrl {
  if (!input || typeof input !== "string" || !input.trim()) {
    throw new BadRequestException("Repository URL must be a non-empty string");
  }

  const trimmed = input.trim();

  // Reject embedded credentials (user:pass@host)
  if (trimmed.includes("@")) {
    throw new BadRequestException(
      "Repository URLs containing embedded credentials are not permitted",
    );
  }

  // Prepend https:// if protocol was omitted
  const urlWithProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(urlWithProtocol);
  } catch {
    throw new BadRequestException("Invalid URL format");
  }

  // Enforce HTTP / HTTPS scheme
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new BadRequestException(
      `Unsupported scheme "${parsed.protocol}". Only HTTP/HTTPS URLs are supported`,
    );
  }

  // Enforce official github.com domain
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "github.com" && hostname !== "www.github.com") {
    throw new BadRequestException(
      `Unsupported repository host "${hostname}". Only official github.com repositories are supported`,
    );
  }

  // Path segments extraction (e.g. /owner/repo/tree/main -> ["owner", "repo", "tree", "main"])
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new BadRequestException(
      'Repository URL must contain both an owner and repository name (e.g. "https://github.com/owner/repo")',
    );
  }

  const rawOwner = segments[0].trim();
  let rawRepo = segments[1].trim();

  // Strip .git suffix if present
  if (rawRepo.toLowerCase().endsWith(".git")) {
    rawRepo = rawRepo.slice(0, -4);
  }

  // Reject reserved service paths
  if (RESERVED_GITHUB_PATHS.has(rawOwner.toLowerCase())) {
    throw new BadRequestException(
      `"${rawOwner}" is a reserved GitHub path, not a valid repository owner or organization`,
    );
  }

  // Validate owner syntax (alphanumeric, single hyphens, no consecutive hyphens, max 39 chars)
  if (
    !GITHUB_OWNER_REGEX.test(rawOwner) ||
    rawOwner.includes("--") ||
    rawOwner.length > 39
  ) {
    throw new BadRequestException(
      `Invalid GitHub owner name "${rawOwner}". Owner names must contain only alphanumeric characters or single hyphens without consecutive hyphens`,
    );
  }

  // Validate repo syntax
  if (
    !rawRepo ||
    !GITHUB_REPO_REGEX.test(rawRepo) ||
    rawRepo === "." ||
    rawRepo === ".." ||
    rawRepo.length > 100
  ) {
    throw new BadRequestException(
      `Invalid GitHub repository name "${rawRepo}". Repository names must contain only alphanumeric characters, hyphens, underscores, or periods`,
    );
  }

  const fullName = `${rawOwner}/${rawRepo}`;
  const canonicalUrl = `https://github.com/${fullName}`;

  return {
    owner: rawOwner,
    repo: rawRepo,
    fullName,
    canonicalUrl,
  };
}
