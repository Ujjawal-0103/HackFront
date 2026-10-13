import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";

export interface ProjectionSummary {
  repositoryId: string;
  commitsProjected: number;
  pullRequestsProjected: number;
  issuesProjected: number;
  documentationProjected: number;
  totalSourceRecords: number;
}

export interface DocumentationInput {
  referenceKey: string;
  title: string;
  content: string;
  author?: string;
  url?: string;
  filePath?: string;
  recordedAt?: Date;
  isAdr?: boolean;
}

@Injectable()
export class EvidenceProjectionService {
  private readonly logger = new Logger(EvidenceProjectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Projects ingested GitCommits and diffs into canonical SourceRecords.
   */
  async projectCommits(repositoryId: string): Promise<number> {
    const commits = await this.prisma.gitCommit.findMany({
      where: { repositoryId },
      include: { diffs: true },
    });

    let projected = 0;
    for (const commit of commits) {
      const firstLine = commit.message.split("\n")[0].trim() || commit.sha;
      const filePaths = commit.diffs.map((d) => d.filePath);
      const diffSummary = commit.diffs
        .map(
          (d) =>
            `File: ${d.filePath} (${d.status}, +${d.additions}, -${d.deletions})\n${d.diffHunk || ""}`,
        )
        .join("\n\n");

      const content = `${commit.message}\n\n${diffSummary}`.trim();
      const primaryFile = filePaths[0] || null;

      await this.prisma.sourceRecord.upsert({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId,
            sourceType: EvidenceSourceType.COMMIT,
            externalId: commit.sha,
          },
        },
        create: {
          repositoryId,
          sourceType: EvidenceSourceType.COMMIT,
          externalId: commit.sha,
          referenceKey: commit.sha.substring(0, 7),
          title: firstLine,
          author: commit.authorName,
          url: commit.url,
          content,
          snippet:
            commit.diffs[0]?.diffHunk?.substring(0, 500) ||
            commit.message.substring(0, 300),
          filePath: primaryFile,
          metadata: {
            sha: commit.sha,
            authorEmail: commit.authorEmail,
            filesChanged: filePaths,
            diffsCount: commit.diffs.length,
          },
          recordedAt: commit.committedAt,
        },
        update: {
          title: firstLine,
          author: commit.authorName,
          url: commit.url,
          content,
          snippet:
            commit.diffs[0]?.diffHunk?.substring(0, 500) ||
            commit.message.substring(0, 300),
          filePath: primaryFile,
          metadata: {
            sha: commit.sha,
            authorEmail: commit.authorEmail,
            filesChanged: filePaths,
            diffsCount: commit.diffs.length,
          },
          recordedAt: commit.committedAt,
        },
      });
      projected++;
    }

    return projected;
  }

  /**
   * Projects ingested PullRequests and discussions into canonical SourceRecords.
   */
  async projectPullRequests(repositoryId: string): Promise<number> {
    const pullRequests = await this.prisma.pullRequest.findMany({
      where: { repositoryId },
      include: { comments: true },
    });

    let projected = 0;
    for (const pr of pullRequests) {
      const commentsText = pr.comments
        .map(
          (c) =>
            `[Comment by ${c.author} at ${c.createdAt.toISOString()}]:\n${c.body}`,
        )
        .join("\n\n");

      const content =
        `${pr.title}\n\n${pr.body || ""}\n\n${commentsText}`.trim();
      const externalId = String(pr.number);
      const referenceKey = `#${pr.number}`;
      const recordedAt = pr.mergedAt || pr.closedAt || pr.createdAt;

      await this.prisma.sourceRecord.upsert({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId,
            sourceType: EvidenceSourceType.PULL_REQUEST,
            externalId,
          },
        },
        create: {
          repositoryId,
          sourceType: EvidenceSourceType.PULL_REQUEST,
          externalId,
          referenceKey,
          title: pr.title,
          author: pr.author,
          url: pr.url,
          content,
          snippet: pr.body?.substring(0, 400) || null,
          metadata: {
            number: pr.number,
            state: pr.state,
            isMerged: pr.isMerged,
            commentsCount: pr.comments.length,
          },
          recordedAt,
        },
        update: {
          title: pr.title,
          author: pr.author,
          url: pr.url,
          content,
          snippet: pr.body?.substring(0, 400) || null,
          metadata: {
            number: pr.number,
            state: pr.state,
            isMerged: pr.isMerged,
            commentsCount: pr.comments.length,
          },
          recordedAt,
        },
      });
      projected++;
    }

    return projected;
  }

  /**
   * Projects ingested Issues and discussions into canonical SourceRecords.
   */
  async projectIssues(repositoryId: string): Promise<number> {
    const issues = await this.prisma.issue.findMany({
      where: { repositoryId },
      include: { comments: true },
    });

    let projected = 0;
    for (const issue of issues) {
      const commentsText = issue.comments
        .map(
          (c) =>
            `[Comment by ${c.author} at ${c.createdAt.toISOString()}]:\n${c.body}`,
        )
        .join("\n\n");

      const content =
        `${issue.title}\n\n${issue.body || ""}\n\n${commentsText}`.trim();
      const externalId = String(issue.number);
      const referenceKey = `#${issue.number}`;
      const recordedAt = issue.closedAt || issue.createdAt;

      await this.prisma.sourceRecord.upsert({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId,
            sourceType: EvidenceSourceType.ISSUE,
            externalId,
          },
        },
        create: {
          repositoryId,
          sourceType: EvidenceSourceType.ISSUE,
          externalId,
          referenceKey,
          title: issue.title,
          author: issue.author,
          url: issue.url,
          content,
          snippet: issue.body?.substring(0, 400) || null,
          metadata: {
            number: issue.number,
            state: issue.state,
            commentsCount: issue.comments.length,
          },
          recordedAt,
        },
        update: {
          title: issue.title,
          author: issue.author,
          url: issue.url,
          content,
          snippet: issue.body?.substring(0, 400) || null,
          metadata: {
            number: issue.number,
            state: issue.state,
            commentsCount: issue.comments.length,
          },
          recordedAt,
        },
      });
      projected++;
    }

    return projected;
  }

  /**
   * Projects architecture documentation or ADRs into canonical SourceRecords.
   */
  async projectDocumentation(
    repositoryId: string,
    docs: DocumentationInput[],
  ): Promise<number> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
    });
    const repoFullName = repo?.fullName || "repository";

    let projected = 0;
    for (const doc of docs) {
      const sourceType = doc.isAdr
        ? EvidenceSourceType.ADR
        : EvidenceSourceType.DOCUMENTATION;
      const externalId = doc.filePath || doc.referenceKey;
      const url =
        doc.url ||
        `https://github.com/${repoFullName}/blob/main/${doc.filePath || doc.referenceKey}`;

      await this.prisma.sourceRecord.upsert({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId,
            sourceType,
            externalId,
          },
        },
        create: {
          repositoryId,
          sourceType,
          externalId,
          referenceKey: doc.referenceKey,
          title: doc.title,
          author: doc.author || "Repository Maintainers",
          url,
          content: doc.content,
          snippet: doc.content.substring(0, 400),
          filePath: doc.filePath,
          metadata: {
            isAdr: Boolean(doc.isAdr),
            filePath: doc.filePath,
          },
          recordedAt: doc.recordedAt || new Date(),
        },
        update: {
          title: doc.title,
          author: doc.author || "Repository Maintainers",
          url,
          content: doc.content,
          snippet: doc.content.substring(0, 400),
          filePath: doc.filePath,
          metadata: {
            isAdr: Boolean(doc.isAdr),
            filePath: doc.filePath,
          },
          recordedAt: doc.recordedAt || new Date(),
        },
      });
      projected++;
    }

    return projected;
  }

  /**
   * Projects all ingested entities for a repository into SourceRecords.
   */
  async projectAll(repositoryId: string): Promise<ProjectionSummary> {
    const commitsCount = await this.projectCommits(repositoryId);
    const prsCount = await this.projectPullRequests(repositoryId);
    const issuesCount = await this.projectIssues(repositoryId);

    const total = await this.prisma.sourceRecord.count({
      where: { repositoryId },
    });

    this.logger.log(
      `Projected repository ${repositoryId} into ${total} canonical SourceRecords (${commitsCount} commits, ${prsCount} PRs, ${issuesCount} issues)`,
    );

    return {
      repositoryId,
      commitsProjected: commitsCount,
      pullRequestsProjected: prsCount,
      issuesProjected: issuesCount,
      documentationProjected: 0,
      totalSourceRecords: total,
    };
  }
}
