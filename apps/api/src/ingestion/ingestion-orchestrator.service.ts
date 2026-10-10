import { Injectable, Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { IngestionPersistenceService } from "./ingestion-persistence.service";
import { IngestionJobPayload } from "./ingestion.types";
import {
  IGitHubIngestionAdapter,
  GITHUB_INGESTION_ADAPTER_TOKEN,
} from "../github/github-adapter.interface";
import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubPayloadTooLargeError,
  GitHubValidationError,
  sanitizeErrorMessage,
} from "../github/github.errors";
import { IngestionNormalizationError } from "./ingestion.normalizer";
import {
  GitHubCommitDetail,
  GitHubPullRequestDetail,
  GitHubPullRequestSummary,
  GitHubReview,
  GitHubIssueSummary,
  GitHubComment,
} from "../github/github-ingestion.types";

/**
 * Non-retryable error indicating invalid parameters, missing records, or unrecoverable association failures.
 */
export class IngestionNonRetryableError extends Error {
  constructor(message: string) {
    super(sanitizeErrorMessage(message));
    this.name = "IngestionNonRetryableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Classifies an ingestion failure as retryable vs permanent.
 */
export function isRetryableIngestionError(err: unknown): boolean {
  if (err instanceof GitHubAuthError) return false;
  if (err instanceof GitHubForbiddenError) return false;
  if (err instanceof GitHubNotFoundError) return false;
  if (err instanceof GitHubPayloadTooLargeError) return false;
  if (err instanceof GitHubValidationError) return false;
  if (err instanceof IngestionNormalizationError) return false;
  if (err instanceof IngestionNonRetryableError) return false;
  if (err instanceof GitHubRateLimitError) return true;
  if (err instanceof GitHubTransientError) return true;
  return true;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES_PER_ENTITY = 10;

@Injectable()
export class IngestionOrchestratorService {
  private readonly logger = new Logger(IngestionOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persistenceService: IngestionPersistenceService,
    @Inject(GITHUB_INGESTION_ADAPTER_TOKEN)
    private readonly githubAdapter: IGitHubIngestionAdapter,
  ) {}

  /**
   * Orchestrates the complete sync pipeline for a repository ingestion job:
   * 1. Validates payload and database record associations
   * 2. Idempotently skips already COMPLETED jobs
   * 3. Syncs repository metadata
   * 4. Syncs commits & diffs in bounded batches
   * 5. Syncs pull requests, comments & reviews in bounded batches
   * 6. Syncs issues and comments in bounded batches
   * 7. Tracks progress and updates status to COMPLETED or FAILED
   */
  async orchestrateSync(
    payload: IngestionJobPayload,
    job?: Job<IngestionJobPayload>,
  ): Promise<{
    status: "COMPLETED" | "SKIPPED";
    isTruncated?: boolean;
    truncatedEntities?: string[];
    warningMessage?: string;
    commitsCount: number;
    pullRequestsCount: number;
    issuesCount: number;
  }> {
    // 1. Structural Validation
    this.validatePayload(payload);

    // 2. Database Record Association Verification
    const syncJob = await this.prisma.repositorySyncJob.findUnique({
      where: { id: payload.syncJobId },
      include: { repository: true },
    });

    if (!syncJob) {
      throw new IngestionNonRetryableError(
        `Sync job record "${payload.syncJobId}" not found in database`,
      );
    }

    if (syncJob.repositoryId !== payload.repositoryId) {
      throw new IngestionNonRetryableError(
        `Sync job repository mismatch: expected "${syncJob.repositoryId}", got "${payload.repositoryId}"`,
      );
    }

    if (!syncJob.repository) {
      throw new IngestionNonRetryableError(
        `Repository record "${payload.repositoryId}" not found in database`,
      );
    }

    // Idempotent Short-Circuit: If already marked COMPLETED, skip duplicate processing
    if (syncJob.status === "COMPLETED") {
      this.logger.log(
        `Sync job ${syncJob.id} is already COMPLETED. Skipping duplicate execution.`,
      );
      return {
        status: "SKIPPED",
        commitsCount: syncJob.commitsCount,
        pullRequestsCount: syncJob.pullRequestsCount,
        issuesCount: syncJob.issuesCount,
      };
    }

    // 2b. Installation Verification & Workspace Association
    const installation = await this.prisma.gitHubInstallation.findUnique({
      where: { installationId: payload.installationId },
    });

    if (!installation) {
      await this.persistenceService.updateSyncJob(syncJob.id, {
        status: "FAILED",
        errorMessage: `GitHub installation ${payload.installationId} not found or has been deleted`,
        completedAt: new Date(),
      });
      throw new IngestionNonRetryableError(
        `GitHub installation ${payload.installationId} not found or has been deleted`,
      );
    }

    if (installation.workspaceId !== syncJob.repository.workspaceId) {
      await this.persistenceService.updateSyncJob(syncJob.id, {
        status: "FAILED",
        errorMessage: `Installation ${payload.installationId} belongs to workspace "${installation.workspaceId}", not repository workspace "${syncJob.repository.workspaceId}"`,
        completedAt: new Date(),
      });
      throw new IngestionNonRetryableError(
        `Installation ${payload.installationId} belongs to workspace "${installation.workspaceId}", not repository workspace "${syncJob.repository.workspaceId}"`,
      );
    }

    const [owner, repo] = payload.fullName.split("/");
    if (!owner || !repo) {
      throw new IngestionNonRetryableError(
        `Invalid fullName identifier "${payload.fullName}": expected "owner/repo"`,
      );
    }

    // 3. Mark Job as SYNCING
    await this.persistenceService.updateSyncJob(syncJob.id, {
      status: "SYNCING",
      startedAt: syncJob.startedAt || new Date(),
    });

    let totalCommits = syncJob.commitsCount || 0;
    let totalPrs = syncJob.pullRequestsCount || 0;
    let totalIssues = syncJob.issuesCount || 0;

    try {
      // Re-verify installation existence immediately prior to external fetch to prevent race with installation.deleted
      const activeInstallation = await this.prisma.gitHubInstallation.findUnique({
        where: { installationId: payload.installationId },
      });
      if (
        !activeInstallation ||
        activeInstallation.workspaceId !== syncJob.repository.workspaceId
      ) {
        throw new IngestionNonRetryableError(
          `Installation ${payload.installationId} was revoked or mismatched prior to external fetch`,
        );
      }

      // 4. Repository Metadata (do not update indexedAt here; checkpoint is managed after commit ingestion)
      this.logger.log(`Fetching metadata for ${owner}/${repo}...`);
      const repoDetails = await this.githubAdapter.getRepository(owner, repo);
      await this.persistenceService.upsertRepositoryMetadata(
        syncJob.repositoryId,
        repoDetails,
        false,
      );

      // 5. Commits Ingestion (Incremental if previous indexedAt exists)
      const since = syncJob.repository.indexedAt
        ? syncJob.repository.indexedAt.toISOString()
        : undefined;

      const commitsResult = await this.syncCommits(
        syncJob.repositoryId,
        syncJob.id,
        owner,
        repo,
        since,
      );
      totalCommits += commitsResult.count;

      // 6. Pull Requests Ingestion
      const prsResult = await this.syncPullRequests(
        syncJob.repositoryId,
        syncJob.id,
        owner,
        repo,
      );
      totalPrs += prsResult.count;

      // 7. Issues Ingestion
      const issuesResult = await this.syncIssues(
        syncJob.repositoryId,
        syncJob.id,
        owner,
        repo,
      );
      totalIssues += issuesResult.count;

      // Track truncation independently for commits, pull requests, and issues
      const truncatedEntities: string[] = [];
      if (commitsResult.isTruncated) truncatedEntities.push("commits");
      if (prsResult.isTruncated) truncatedEntities.push("pull_requests");
      if (issuesResult.isTruncated) truncatedEntities.push("issues");

      const isTruncated = truncatedEntities.length > 0;
      let truncationWarning: string | undefined;

      if (isTruncated) {
        truncationWarning = `TRUNCATED: Ingestion reached maximum limit of 10 pages per entity (500 items). Additional records remain unindexed on GitHub for: ${truncatedEntities.join(", ")}.`;
        this.logger.warn(
          `Sync job ${syncJob.id} on ${owner}/${repo} truncated: additional records remain for ${truncatedEntities.join(", ")}`,
        );
      }

      // Checkpoint indexedAt preservation:
      // If commits were NOT truncated, advance indexedAt to new Date().
      // If commits WERE truncated, preserve indexedAt at its previous value so subsequent syncs do not permanently skip omitted historical commits.
      if (!commitsResult.isTruncated) {
        await this.persistenceService.updateRepositoryIndexedAt(syncJob.repositoryId);
      } else {
        this.logger.warn(
          `Commits ingestion for ${owner}/${repo} was truncated; repository.indexedAt checkpoint retained at previous value to protect historical records.`,
        );
      }

      // 8. Mark Job as COMPLETED with truncation warning if applicable
      await this.persistenceService.updateSyncJob(syncJob.id, {
        status: "COMPLETED",
        commitsCount: totalCommits,
        pullRequestsCount: totalPrs,
        issuesCount: totalIssues,
        errorMessage: truncationWarning || null,
        completedAt: new Date(),
      });

      this.logger.log(
        `Successfully completed sync for ${owner}/${repo}: ${totalCommits} commits, ${totalPrs} PRs, ${totalIssues} issues (truncated: ${isTruncated}).`,
      );

      return {
        status: "COMPLETED",
        isTruncated,
        truncatedEntities,
        warningMessage: truncationWarning,
        commitsCount: totalCommits,
        pullRequestsCount: totalPrs,
        issuesCount: totalIssues,
      };
    } catch (err: any) {
      const isRetryable = isRetryableIngestionError(err);
      const sanitizedError = sanitizeErrorMessage(err.message || String(err));
      const attemptsMade = job ? job.attemptsMade : 1;
      const maxAttempts = job?.opts?.attempts || 3;
      const isFinalAttempt = !isRetryable || attemptsMade >= maxAttempts;

      this.logger.error(
        `Ingestion error on ${owner}/${repo} (attempt ${attemptsMade}/${maxAttempts}, retryable=${isRetryable}): ${sanitizedError}`,
      );

      if (isFinalAttempt) {
        await this.persistenceService.updateSyncJob(syncJob.id, {
          status: "FAILED",
          errorMessage: sanitizedError,
          completedAt: new Date(),
        });
      } else {
        await this.persistenceService.updateSyncJob(syncJob.id, {
          errorMessage: `[Attempt ${attemptsMade}] ${sanitizedError}`,
        });
      }

      // Re-throw retryable errors for BullMQ exponential backoff; suppress non-retryable to halt futile retries
      if (isRetryable) {
        throw err;
      }

      return {
        status: "COMPLETED",
        commitsCount: totalCommits,
        pullRequestsCount: totalPrs,
        issuesCount: totalIssues,
      };
    }
  }

  // --- Entity Sync Implementations ---

  private async syncCommits(
    repositoryId: string,
    syncJobId: string,
    owner: string,
    repo: string,
    since?: string,
  ): Promise<{ count: number; isTruncated: boolean }> {
    let page = 1;
    let addedCommits = 0;
    let isTruncated = false;

    while (page <= MAX_PAGES_PER_ENTITY) {
      const { items, hasMore } = await this.githubAdapter.getCommits(
        owner,
        repo,
        {
          page,
          perPage: DEFAULT_PAGE_SIZE,
          since,
        },
      );

      if (!items || items.length === 0) break;

      // Fetch detailed commit records (including diffs/files)
      const detailedCommits: GitHubCommitDetail[] = [];
      for (const summary of items) {
        try {
          const detail = await this.githubAdapter.getCommit(
            owner,
            repo,
            summary.sha,
          );
          detailedCommits.push(detail);
        } catch (detailErr) {
          // If a single commit detail fails, fallback to basic commit info with empty files
          detailedCommits.push({
            ...summary,
            stats: { additions: 0, deletions: 0, total: 0 },
            files: [],
          });
        }
      }

      const { commitsCount } = await this.persistenceService.persistCommits(
        repositoryId,
        detailedCommits,
      );
      addedCommits += commitsCount;

      await this.persistenceService.updateSyncJob(syncJobId, {
        commitsCount: addedCommits,
      });

      // Authoritative next-page check at page limit
      if (page === MAX_PAGES_PER_ENTITY) {
        if (hasMore) {
          isTruncated = true;
        }
        break;
      }

      if (!hasMore) break;
      page++;
    }

    return { count: addedCommits, isTruncated };
  }

  private async syncPullRequests(
    repositoryId: string,
    syncJobId: string,
    owner: string,
    repo: string,
  ): Promise<{ count: number; isTruncated: boolean }> {
    let page = 1;
    let addedPrs = 0;
    let isTruncated = false;

    while (page <= MAX_PAGES_PER_ENTITY) {
      const { items, hasMore } = await this.githubAdapter.getPullRequests(
        owner,
        repo,
        {
          page,
          perPage: DEFAULT_PAGE_SIZE,
          state: "all",
        },
      );

      if (!items || items.length === 0) break;

      const detailedPrs: GitHubPullRequestDetail[] = [];
      const commentsMap = new Map<number, GitHubComment[]>();
      const reviewsMap = new Map<number, GitHubReview[]>();

      for (const prSummary of items) {
        try {
          const detail = await this.githubAdapter.getPullRequest(
            owner,
            repo,
            prSummary.number,
          );
          detailedPrs.push(detail);
        } catch {
          // Fallback to summary with default delta stats if detail fetch fails
          detailedPrs.push({
            ...prSummary,
            additions: 0,
            deletions: 0,
            changedFiles: 0,
            baseRef: "main",
            headRef: "branch",
            headSha: "",
          });
        }

        // Fetch comments and reviews for this PR
        try {
          const commentsRes =
            await this.githubAdapter.getPullRequestComments(
              owner,
              repo,
              prSummary.number,
              { page: 1, perPage: DEFAULT_PAGE_SIZE },
            );
          if (commentsRes.items && commentsRes.items.length > 0) {
            commentsMap.set(prSummary.number, commentsRes.items);
          }
        } catch {
          // Non-fatal if comment retrieval fails
        }

        try {
          const reviewsRes = await this.githubAdapter.getPullRequestReviews(
            owner,
            repo,
            prSummary.number,
            { page: 1, perPage: DEFAULT_PAGE_SIZE },
          );
          if (reviewsRes.items && reviewsRes.items.length > 0) {
            reviewsMap.set(prSummary.number, reviewsRes.items);
          }
        } catch {
          // Non-fatal if review retrieval fails
        }
      }

      const { prsCount } = await this.persistenceService.persistPullRequests(
        repositoryId,
        detailedPrs,
        commentsMap,
        reviewsMap,
      );
      addedPrs += prsCount;

      await this.persistenceService.updateSyncJob(syncJobId, {
        pullRequestsCount: addedPrs,
      });

      // Authoritative next-page check at page limit
      if (page === MAX_PAGES_PER_ENTITY) {
        if (hasMore) {
          isTruncated = true;
        }
        break;
      }

      if (!hasMore) break;
      page++;
    }

    return { count: addedPrs, isTruncated };
  }

  private async syncIssues(
    repositoryId: string,
    syncJobId: string,
    owner: string,
    repo: string,
  ): Promise<{ count: number; isTruncated: boolean }> {
    let page = 1;
    let addedIssues = 0;
    let isTruncated = false;

    while (page <= MAX_PAGES_PER_ENTITY) {
      const { items, hasMore } = await this.githubAdapter.getIssues(
        owner,
        repo,
        {
          page,
          perPage: DEFAULT_PAGE_SIZE,
          state: "all",
        },
      );

      if (!items || items.length === 0) break;

      const nonPrIssues = items.filter((issue) => !issue.isPullRequest);
      const commentsMap = new Map<number, GitHubComment[]>();

      for (const issue of nonPrIssues) {
        if (issue.commentsCount > 0) {
          try {
            const commentsRes = await this.githubAdapter.getIssueComments(
              owner,
              repo,
              issue.number,
              { page: 1, perPage: DEFAULT_PAGE_SIZE },
            );
            if (commentsRes.items && commentsRes.items.length > 0) {
              commentsMap.set(issue.number, commentsRes.items);
            }
          } catch {
            // Non-fatal if issue comments fail
          }
        }
      }

      const { issuesCount } = await this.persistenceService.persistIssues(
        repositoryId,
        nonPrIssues,
        commentsMap,
      );
      addedIssues += issuesCount;

      await this.persistenceService.updateSyncJob(syncJobId, {
        issuesCount: addedIssues,
      });

      // Authoritative next-page check at page limit
      if (page === MAX_PAGES_PER_ENTITY) {
        if (hasMore) {
          isTruncated = true;
        }
        break;
      }

      if (!hasMore) break;
      page++;
    }

    return { count: addedIssues, isTruncated };
  }

  private validatePayload(payload: IngestionJobPayload): void {
    if (!payload) {
      throw new IngestionNonRetryableError("Ingestion job payload is missing");
    }
    if (!payload.repositoryId || typeof payload.repositoryId !== "string") {
      throw new IngestionNonRetryableError("Ingestion payload missing valid repositoryId UUID");
    }
    if (!payload.syncJobId || typeof payload.syncJobId !== "string") {
      throw new IngestionNonRetryableError("Ingestion payload missing valid syncJobId UUID");
    }
    if (!payload.installationId || typeof payload.installationId !== "number") {
      throw new IngestionNonRetryableError("Ingestion payload missing valid numeric installationId");
    }
    if (!payload.fullName || typeof payload.fullName !== "string") {
      throw new IngestionNonRetryableError("Ingestion payload missing valid fullName (owner/repo)");
    }
  }
}
