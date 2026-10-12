import { Injectable, Logger } from "@nestjs/common";
import {
  Repository,
  GitCommit,
  PullRequest,
  Issue,
  RepositorySyncJob,
  SyncStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  GitHubRepoDetails,
  GitHubCommitDetail,
  GitHubPullRequestDetail,
  GitHubPullRequestSummary,
  GitHubReview,
  GitHubIssueSummary,
  GitHubComment,
} from "../github/github-ingestion.types";
import {
  normalizeRepositoryMetadata,
  normalizeCommit,
  normalizePullRequest,
  normalizePullRequestComment,
  normalizeIssue,
  normalizeIssueComment,
  normalizeReviewToComment,
  NormalizedComment,
} from "./ingestion.normalizer";

@Injectable()
export class IngestionPersistenceService {
  private readonly logger = new Logger(IngestionPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotently updates repository metadata (defaultBranch, isPrivate, githubRepoId, indexedAt).
   */
  async upsertRepositoryMetadata(
    repositoryId: string,
    rawMetadata: GitHubRepoDetails,
    updateIndexedAt = true,
  ): Promise<Repository> {
    const normalized = normalizeRepositoryMetadata(rawMetadata);

    return this.prisma.repository.update({
      where: { id: repositoryId },
      data: {
        githubRepoId: normalized.githubRepoId,
        defaultBranch: normalized.defaultBranch,
        isPrivate: normalized.isPrivate,
        ...(updateIndexedAt ? { indexedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Updates repository indexedAt checkpoint upon successful, complete commit ingestion.
   */
  async updateRepositoryIndexedAt(
    repositoryId: string,
    indexedAt: Date = new Date(),
  ): Promise<Repository> {
    return this.prisma.repository.update({
      where: { id: repositoryId },
      data: { indexedAt },
    });
  }

  /**
   * Idempotently persists a single commit and its file diffs within an atomic transaction.
   * If a commit with (repositoryId, sha) already exists, it is updated in-place.
   * If a diff with (commitId, filePath) already exists, it is updated in-place.
   */
  async persistCommit(
    repositoryId: string,
    rawCommit: GitHubCommitDetail,
  ): Promise<{ commitId: string; diffsCount: number }> {
    const normalized = normalizeCommit(rawCommit);

    return this.prisma.$transaction(async (tx) => {
      const commit = await tx.gitCommit.upsert({
        where: {
          repositoryId_sha: {
            repositoryId,
            sha: normalized.sha,
          },
        },
        create: {
          repositoryId,
          sha: normalized.sha,
          message: normalized.message,
          authorName: normalized.authorName,
          authorEmail: normalized.authorEmail,
          committedAt: normalized.committedAt,
          url: normalized.url,
        },
        update: {
          message: normalized.message,
          authorName: normalized.authorName,
          authorEmail: normalized.authorEmail,
          committedAt: normalized.committedAt,
          url: normalized.url,
        },
      });

      for (const diff of normalized.diffs) {
        await tx.commitDiff.upsert({
          where: {
            commitId_filePath: {
              commitId: commit.id,
              filePath: diff.filePath,
            },
          },
          create: {
            commitId: commit.id,
            filePath: diff.filePath,
            status: diff.status,
            additions: diff.additions,
            deletions: diff.deletions,
            diffHunk: diff.diffHunk,
            isBinary: diff.isBinary,
          },
          update: {
            status: diff.status,
            additions: diff.additions,
            deletions: diff.deletions,
            diffHunk: diff.diffHunk,
            isBinary: diff.isBinary,
          },
        });
      }

      return { commitId: commit.id, diffsCount: normalized.diffs.length };
    });
  }

  /**
   * Idempotently persists a batch of commits and their diffs.
   */
  async persistCommits(
    repositoryId: string,
    rawCommits: GitHubCommitDetail[],
  ): Promise<{ commitsCount: number; diffsCount: number }> {
    let totalDiffs = 0;
    for (const rawCommit of rawCommits) {
      const { diffsCount } = await this.persistCommit(repositoryId, rawCommit);
      totalDiffs += diffsCount;
    }
    return { commitsCount: rawCommits.length, diffsCount: totalDiffs };
  }

  /**
   * Idempotently persists a pull request and its associated comments/reviews within an atomic transaction.
   * If a pull request with (repositoryId, number) already exists, it is updated in-place.
   * If a comment with (pullRequestId, githubCommentId) already exists, it is updated in-place.
   */
  async persistPullRequest(
    repositoryId: string,
    rawPr: GitHubPullRequestDetail | GitHubPullRequestSummary,
    comments: GitHubComment[] = [],
    reviews: GitHubReview[] = [],
  ): Promise<{ pullRequestId: string; commentsCount: number }> {
    const normalized = normalizePullRequest(rawPr);
    const normalizedComments = comments.map(normalizePullRequestComment);
    const reviewComments = reviews
      .map(normalizeReviewToComment)
      .filter((c): c is NormalizedComment => c !== null);
    const allComments = [...normalizedComments, ...reviewComments];

    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.pullRequest.upsert({
        where: {
          repositoryId_number: {
            repositoryId,
            number: normalized.number,
          },
        },
        create: {
          repositoryId,
          number: normalized.number,
          title: normalized.title,
          body: normalized.body,
          author: normalized.author,
          state: normalized.state,
          isMerged: normalized.isMerged,
          mergedAt: normalized.mergedAt,
          closedAt: normalized.closedAt,
          url: normalized.url,
        },
        update: {
          title: normalized.title,
          body: normalized.body,
          author: normalized.author,
          state: normalized.state,
          isMerged: normalized.isMerged,
          mergedAt: normalized.mergedAt,
          closedAt: normalized.closedAt,
          url: normalized.url,
        },
      });

      for (const comment of allComments) {
        await tx.pullRequestComment.upsert({
          where: {
            pullRequestId_githubCommentId: {
              pullRequestId: pr.id,
              githubCommentId: comment.githubCommentId,
            },
          },
          create: {
            pullRequestId: pr.id,
            githubCommentId: comment.githubCommentId,
            author: comment.author,
            body: comment.body,
            createdAt: comment.createdAt,
          },
          update: {
            author: comment.author,
            body: comment.body,
            createdAt: comment.createdAt,
          },
        });
      }

      return { pullRequestId: pr.id, commentsCount: allComments.length };
    });
  }

  /**
   * Idempotently persists a batch of pull requests and comments.
   */
  async persistPullRequests(
    repositoryId: string,
    rawPrs: (GitHubPullRequestDetail | GitHubPullRequestSummary)[],
    commentsMap?: Map<number, GitHubComment[]>,
    reviewsMap?: Map<number, GitHubReview[]>,
  ): Promise<{ prsCount: number; commentsCount: number }> {
    let totalComments = 0;
    for (const rawPr of rawPrs) {
      const comments = commentsMap?.get(rawPr.number) || [];
      const reviews = reviewsMap?.get(rawPr.number) || [];
      const { commentsCount } = await this.persistPullRequest(
        repositoryId,
        rawPr,
        comments,
        reviews,
      );
      totalComments += commentsCount;
    }
    return { prsCount: rawPrs.length, commentsCount: totalComments };
  }

  /**
   * Idempotently persists an issue and its associated comments within an atomic transaction.
   * Pull requests returned by GitHub's issue endpoint are filtered out to prevent duplicate entities.
   */
  async persistIssue(
    repositoryId: string,
    rawIssue: GitHubIssueSummary,
    comments: GitHubComment[] = [],
  ): Promise<{ issueId: string; commentsCount: number } | null> {
    if (rawIssue.isPullRequest) {
      return null;
    }

    const normalized = normalizeIssue(rawIssue);
    const normalizedComments = comments.map(normalizeIssueComment);

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.upsert({
        where: {
          repositoryId_number: {
            repositoryId,
            number: normalized.number,
          },
        },
        create: {
          repositoryId,
          number: normalized.number,
          title: normalized.title,
          body: normalized.body,
          author: normalized.author,
          state: normalized.state,
          closedAt: normalized.closedAt,
          url: normalized.url,
        },
        update: {
          title: normalized.title,
          body: normalized.body,
          author: normalized.author,
          state: normalized.state,
          closedAt: normalized.closedAt,
          url: normalized.url,
        },
      });

      for (const comment of normalizedComments) {
        await tx.issueComment.upsert({
          where: {
            issueId_githubCommentId: {
              issueId: issue.id,
              githubCommentId: comment.githubCommentId,
            },
          },
          create: {
            issueId: issue.id,
            githubCommentId: comment.githubCommentId,
            author: comment.author,
            body: comment.body,
            createdAt: comment.createdAt,
          },
          update: {
            author: comment.author,
            body: comment.body,
            createdAt: comment.createdAt,
          },
        });
      }

      return { issueId: issue.id, commentsCount: normalizedComments.length };
    });
  }

  /**
   * Idempotently persists a batch of issues and comments.
   */
  async persistIssues(
    repositoryId: string,
    rawIssues: GitHubIssueSummary[],
    commentsMap?: Map<number, GitHubComment[]>,
  ): Promise<{ issuesCount: number; commentsCount: number }> {
    let processedIssues = 0;
    let totalComments = 0;
    for (const rawIssue of rawIssues) {
      const comments = commentsMap?.get(rawIssue.number) || [];
      const res = await this.persistIssue(repositoryId, rawIssue, comments);
      if (res) {
        processedIssues++;
        totalComments += res.commentsCount;
      }
    }
    return { issuesCount: processedIssues, commentsCount: totalComments };
  }

  /**
   * Updates sync job state, progress metrics, and completion timestamps.
   */
  async updateSyncJob(
    syncJobId: string,
    data: {
      status?: SyncStatus;
      commitsCount?: number;
      pullRequestsCount?: number;
      issuesCount?: number;
      errorMessage?: string | null;
      startedAt?: Date;
      completedAt?: Date;
    },
  ): Promise<RepositorySyncJob> {
    return this.prisma.repositorySyncJob.update({
      where: { id: syncJobId },
      data,
    });
  }
}
