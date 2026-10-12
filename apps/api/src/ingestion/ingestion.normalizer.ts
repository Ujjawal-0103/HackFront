import {
  GitHubRepoDetails,
  GitHubCommitDetail,
  GitHubCommitFile,
  GitHubPullRequestDetail,
  GitHubPullRequestSummary,
  GitHubReview,
  GitHubIssueSummary,
  GitHubComment,
} from "../github/github-ingestion.types";
import { sanitizeDiff } from "./diff-sanitizer";

/**
 * Custom error thrown when a GitHub ingestion payload fails structural normalization.
 */
export class IngestionNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionNormalizationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Normalized repository metadata for updating the Repository entity.
 */
export interface NormalizedRepoMetadata {
  githubRepoId: number;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  sizeKb: number;
}

/**
 * Normalized commit diff record for persisting to CommitDiff.
 */
export interface NormalizedCommitDiff {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  diffHunk: string | null;
  isBinary: boolean;
}

/**
 * Normalized commit record for persisting to GitCommit.
 * Captures parentShas in memory for upstream claim provenance analysis.
 */
export interface NormalizedCommit {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string | null;
  committedAt: Date;
  url: string;
  parentShas: string[];
  diffs: NormalizedCommitDiff[];
}

/**
 * Normalized comment for PullRequestComment or IssueComment.
 */
export interface NormalizedComment {
  githubCommentId: string;
  author: string;
  body: string;
  createdAt: Date;
}

/**
 * Normalized pull request for persisting to PullRequest.
 */
export interface NormalizedPullRequest {
  number: number;
  title: string;
  body: string | null;
  author: string;
  state: "open" | "closed" | "merged";
  isMerged: boolean;
  mergedAt: Date | null;
  closedAt: Date | null;
  url: string;
}

/**
 * Normalized issue for persisting to Issue.
 */
export interface NormalizedIssue {
  number: number;
  title: string;
  body: string | null;
  author: string;
  state: "open" | "closed";
  closedAt: Date | null;
  url: string;
}

/**
 * Safely parses an ISO date string, throwing IngestionNormalizationError if invalid.
 */
function parseRequiredDate(
  dateStr: string | undefined | null,
  fieldName: string,
): Date {
  if (!dateStr) {
    throw new IngestionNormalizationError(
      `Missing required date for ${fieldName}`,
    );
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new IngestionNormalizationError(
      `Invalid date format for ${fieldName}: "${dateStr}"`,
    );
  }
  return date;
}

/**
 * Safely parses an optional ISO date string, returning null if missing or empty.
 */
function parseOptionalDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalizes repository metadata payload.
 */
export function normalizeRepositoryMetadata(
  raw: GitHubRepoDetails,
): NormalizedRepoMetadata {
  if (!raw || typeof raw.id !== "number") {
    throw new IngestionNormalizationError(
      "Invalid repository metadata: missing numeric repository ID",
    );
  }

  const fullName = (
    raw.fullName || `${raw.owner || ""}/${raw.name || ""}`
  ).trim();
  if (!fullName || fullName === "/") {
    throw new IngestionNormalizationError(
      "Invalid repository metadata: missing repository full name",
    );
  }

  return {
    githubRepoId: raw.id,
    fullName,
    defaultBranch: (raw.defaultBranch || "main").trim(),
    isPrivate: Boolean(raw.isPrivate),
    description: raw.description ? raw.description.trim() : null,
    sizeKb: typeof raw.sizeKb === "number" && raw.sizeKb >= 0 ? raw.sizeKb : 0,
  };
}

/**
 * Normalizes a single commit file change into a CommitDiff record.
 */
export function normalizeCommitDiff(
  rawFile: GitHubCommitFile,
): NormalizedCommitDiff {
  if (!rawFile || !rawFile.filename || typeof rawFile.filename !== "string") {
    throw new IngestionNormalizationError(
      "Commit file change missing filename",
    );
  }

  const filename = rawFile.filename.trim();
  if (!filename) {
    throw new IngestionNormalizationError(
      "Commit file change has empty filename",
    );
  }

  const validStatuses = ["added", "modified", "removed", "renamed"];
  const status = (rawFile.status || "modified").toLowerCase();
  const normalizedStatus = validStatuses.includes(status) ? status : "modified";

  const sanitized = sanitizeDiff(filename, rawFile.patch);
  const isBinary =
    sanitized.isBinary ||
    (!rawFile.patch &&
      (normalizedStatus === "added" || normalizedStatus === "modified") &&
      (rawFile.changes === 0 || (!rawFile.additions && !rawFile.deletions)));

  return {
    filePath: filename,
    status: normalizedStatus,
    additions:
      typeof rawFile.additions === "number" && rawFile.additions >= 0
        ? rawFile.additions
        : 0,
    deletions:
      typeof rawFile.deletions === "number" && rawFile.deletions >= 0
        ? rawFile.deletions
        : 0,
    diffHunk: sanitized.diffHunk,
    isBinary,
  };
}

/**
 * Normalizes a GitHub commit detail payload into a GitCommit record with child diffs.
 */
export function normalizeCommit(raw: GitHubCommitDetail): NormalizedCommit {
  if (!raw || !raw.sha || typeof raw.sha !== "string") {
    throw new IngestionNormalizationError("Commit missing valid SHA hash");
  }

  const sha = raw.sha.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/i.test(sha)) {
    throw new IngestionNormalizationError(
      `Invalid commit SHA format: "${raw.sha}"`,
    );
  }

  const authorName = (
    raw.author?.name ||
    raw.committer?.name ||
    "Unknown"
  ).trim();
  const authorEmail =
    (raw.author?.email || raw.committer?.email || null)?.trim() || null;
  const dateStr = raw.committer?.date || raw.author?.date;
  const committedAt = parseRequiredDate(dateStr, `commit ${sha}`);

  const diffs = Array.isArray(raw.files)
    ? raw.files.map(normalizeCommitDiff)
    : [];
  const parentShas = Array.isArray(raw.parentShas)
    ? raw.parentShas
        .filter((p) => typeof p === "string" && p.trim().length > 0)
        .map((p) => p.trim().toLowerCase())
    : [];

  return {
    sha,
    message: typeof raw.message === "string" ? raw.message : "",
    authorName: authorName || "Unknown",
    authorEmail,
    committedAt,
    url: raw.url || `https://github.com/commit/${sha}`,
    parentShas,
    diffs,
  };
}

/**
 * Normalizes a pull request payload into a PullRequest record.
 */
export function normalizePullRequest(
  raw: GitHubPullRequestDetail | GitHubPullRequestSummary,
): NormalizedPullRequest {
  if (
    !raw ||
    typeof raw.number !== "number" ||
    raw.number <= 0 ||
    !Number.isInteger(raw.number)
  ) {
    throw new IngestionNormalizationError(
      "Pull request missing valid positive integer number",
    );
  }

  const title = (raw.title || "Untitled Pull Request").trim();
  const author = (raw.author || "Unknown").trim() || "Unknown";
  const mergedAt = parseOptionalDate(raw.mergedAt);
  const closedAt = parseOptionalDate(raw.closedAt);

  const isMerged = Boolean(mergedAt);
  let state: "open" | "closed" | "merged" = "open";
  if (isMerged) {
    state = "merged";
  } else if (raw.state === "closed") {
    state = "closed";
  }

  return {
    number: raw.number,
    title,
    body: raw.body ? raw.body.trim() : null,
    author,
    state,
    isMerged,
    mergedAt,
    closedAt,
    url: raw.url || "",
  };
}

/**
 * Normalizes a pull request comment.
 */
export function normalizePullRequestComment(
  raw: GitHubComment,
): NormalizedComment {
  if (!raw || !raw.id) {
    throw new IngestionNormalizationError("Pull request comment missing ID");
  }

  const githubCommentId = String(raw.id).trim();
  if (!githubCommentId) {
    throw new IngestionNormalizationError("Pull request comment has empty ID");
  }

  const createdAt = parseRequiredDate(
    raw.createdAt,
    `pull request comment ${githubCommentId}`,
  );

  return {
    githubCommentId,
    author: (raw.author || "Unknown").trim() || "Unknown",
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt,
  };
}

/**
 * Normalizes an issue payload into an Issue record.
 */
export function normalizeIssue(raw: GitHubIssueSummary): NormalizedIssue {
  if (
    !raw ||
    typeof raw.number !== "number" ||
    raw.number <= 0 ||
    !Number.isInteger(raw.number)
  ) {
    throw new IngestionNormalizationError(
      "Issue missing valid positive integer number",
    );
  }

  const title = (raw.title || "Untitled Issue").trim();
  const author = (raw.author || "Unknown").trim() || "Unknown";
  const closedAt = parseOptionalDate(raw.closedAt);
  const state: "open" | "closed" = raw.state === "closed" ? "closed" : "open";

  return {
    number: raw.number,
    title,
    body: raw.body ? raw.body.trim() : null,
    author,
    state,
    closedAt,
    url: raw.url || "",
  };
}

/**
 * Normalizes an issue comment.
 */
export function normalizeIssueComment(raw: GitHubComment): NormalizedComment {
  if (!raw || !raw.id) {
    throw new IngestionNormalizationError("Issue comment missing ID");
  }

  const githubCommentId = String(raw.id).trim();
  if (!githubCommentId) {
    throw new IngestionNormalizationError("Issue comment has empty ID");
  }

  const createdAt = parseRequiredDate(
    raw.createdAt,
    `issue comment ${githubCommentId}`,
  );

  return {
    githubCommentId,
    author: (raw.author || "Unknown").trim() || "Unknown",
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt,
  };
}

/**
 * Converts a GitHub pull request review into a NormalizedComment for PullRequestComment persistence
 * where review comments/body are supported by the existing schema.
 */
export function normalizeReviewToComment(
  rawReview: GitHubReview,
): NormalizedComment | null {
  if (!rawReview || !rawReview.id) return null;

  // Only persist reviews that contain commentary or review summary
  const statePrefix = rawReview.state ? `[Review: ${rawReview.state}] ` : "";
  const bodyText = (rawReview.body || "").trim();
  if (!bodyText && !rawReview.state) {
    return null;
  }

  const githubCommentId = `review_${rawReview.id}`;
  const createdAt = rawReview.submittedAt
    ? parseOptionalDate(rawReview.submittedAt) || new Date()
    : new Date();

  return {
    githubCommentId,
    author: (rawReview.user || "Unknown").trim() || "Unknown",
    body: `${statePrefix}${bodyText}`.trim(),
    createdAt,
  };
}
