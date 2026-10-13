import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GitHubService } from "../github/github.service";
import {
  CreateRepositoryDto,
  RepositoryDetailsDto,
  RepositoryActivityDto,
} from "@traceback/shared-types";

export { RepositoryDetailsDto, RepositoryActivityDto };

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
  ) {}

  /**
   * Ensures the Workspace record exists in the database.
   */
  async ensureWorkspaceExists(workspaceId: string): Promise<void> {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      create: {
        id: workspaceId,
        name: `Workspace ${workspaceId}`,
        slug: workspaceId.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      },
      update: {},
    });
  }

  /**
   * Lists all repositories registered in the specified workspace with summary counts and latest sync job.
   */
  async listRepositories(workspaceId: string): Promise<RepositoryDetailsDto[]> {
    await this.ensureWorkspaceExists(workspaceId);

    const repos = await this.prisma.repository.findMany({
      where: { workspaceId },
      include: {
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            commits: true,
            pullRequests: true,
            issues: true,
            sourceRecords: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return repos.map((repo) => {
      const latestJob = repo.syncJobs[0] || null;
      return {
        id: repo.id,
        workspaceId: repo.workspaceId,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
        indexedAt: repo.indexedAt ? repo.indexedAt.toISOString() : null,
        createdAt: repo.createdAt.toISOString(),
        updatedAt: repo.updatedAt.toISOString(),
        counts: {
          commits: repo._count.commits,
          pullRequests: repo._count.pullRequests,
          issues: repo._count.issues,
          sourceRecords: repo._count.sourceRecords,
        },
        latestSyncJob: latestJob
          ? {
              id: latestJob.id,
              status: latestJob.status,
              trigger: latestJob.trigger,
              commitsCount: latestJob.commitsCount,
              pullRequestsCount: latestJob.pullRequestsCount,
              issuesCount: latestJob.issuesCount,
              errorMessage: latestJob.errorMessage,
              startedAt: latestJob.startedAt
                ? latestJob.startedAt.toISOString()
                : null,
              completedAt: latestJob.completedAt
                ? latestJob.completedAt.toISOString()
                : null,
              createdAt: latestJob.createdAt.toISOString(),
            }
          : null,
      };
    });
  }

  /**
   * Gets details for a single repository, verifying workspace authorization.
   */
  async getRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryDetailsDto> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            commits: true,
            pullRequests: true,
            issues: true,
            sourceRecords: true,
          },
        },
      },
    });

    if (!repo) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    if (repo.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        `Cross-workspace access denied: Repository "${repositoryId}" does not belong to workspace "${workspaceId}"`,
      );
    }

    const latestJob = repo.syncJobs[0] || null;

    return {
      id: repo.id,
      workspaceId: repo.workspaceId,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      isPrivate: repo.isPrivate,
      indexedAt: repo.indexedAt ? repo.indexedAt.toISOString() : null,
      createdAt: repo.createdAt.toISOString(),
      updatedAt: repo.updatedAt.toISOString(),
      counts: {
        commits: repo._count.commits,
        pullRequests: repo._count.pullRequests,
        issues: repo._count.issues,
        sourceRecords: repo._count.sourceRecords,
      },
      latestSyncJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            trigger: latestJob.trigger,
            commitsCount: latestJob.commitsCount,
            pullRequestsCount: latestJob.pullRequestsCount,
            issuesCount: latestJob.issuesCount,
            errorMessage: latestJob.errorMessage,
            startedAt: latestJob.startedAt
              ? latestJob.startedAt.toISOString()
              : null,
            completedAt: latestJob.completedAt
              ? latestJob.completedAt.toISOString()
              : null,
            createdAt: latestJob.createdAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Registers/imports an authorized GitHub repository into the workspace.
   */
  async createRepository(
    workspaceId: string,
    dto: CreateRepositoryDto,
  ): Promise<RepositoryDetailsDto> {
    await this.ensureWorkspaceExists(workspaceId);

    // Verify repository access through GitHubService
    const parts = dto.fullName.split("/");
    if (parts.length !== 2) {
      throw new ConflictException(
        'Invalid repository full name format. Expected "owner/repo"',
      );
    }
    const [owner, repoName] = parts;

    const installationId = dto.installationId || 1001;
    await this.githubService.verifyRepositoryAccess(
      installationId,
      owner,
      repoName,
    );

    const repository = await this.prisma.repository.upsert({
      where: {
        workspaceId_fullName: {
          workspaceId,
          fullName: dto.fullName,
        },
      },
      create: {
        workspaceId,
        fullName: dto.fullName,
        defaultBranch: dto.defaultBranch || "main",
        isPrivate: dto.isPrivate !== undefined ? dto.isPrivate : false,
      },
      update: {
        defaultBranch: dto.defaultBranch || "main",
        isPrivate: dto.isPrivate !== undefined ? dto.isPrivate : false,
      },
      include: {
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            commits: true,
            pullRequests: true,
            issues: true,
            sourceRecords: true,
          },
        },
      },
    });

    return {
      id: repository.id,
      workspaceId: repository.workspaceId,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
      indexedAt: repository.indexedAt
        ? repository.indexedAt.toISOString()
        : null,
      createdAt: repository.createdAt.toISOString(),
      updatedAt: repository.updatedAt.toISOString(),
      counts: {
        commits: repository._count.commits,
        pullRequests: repository._count.pullRequests,
        issues: repository._count.issues,
        sourceRecords: repository._count.sourceRecords,
      },
      latestSyncJob: null,
    };
  }

  /**
   * Retrieves recent activity (commits, PRs, issues) for previewing imported data.
   */
  async getRepositoryActivity(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryActivityDto> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        commits: {
          orderBy: { committedAt: "desc" },
          take: 10,
        },
        pullRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        issues: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!repo) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    if (repo.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        `Cross-workspace access denied: Repository "${repositoryId}" does not belong to workspace "${workspaceId}"`,
      );
    }

    return {
      repositoryId: repo.id,
      fullName: repo.fullName,
      commits: repo.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        authorName: c.authorName,
        committedAt: c.committedAt.toISOString(),
        url: c.url,
      })),
      pullRequests: repo.pullRequests.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.author,
        state: pr.state,
        isMerged: pr.isMerged,
        url: pr.url,
        createdAt: pr.createdAt.toISOString(),
      })),
      issues: repo.issues.map((i) => ({
        number: i.number,
        title: i.title,
        author: i.author,
        state: i.state,
        url: i.url,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Deletes a repository from the workspace.
   */
  async deleteRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<{ success: boolean; id: string }> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, workspaceId: true },
    });

    if (!repo) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    if (repo.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        `Cross-workspace access denied: Repository "${repositoryId}" does not belong to workspace "${workspaceId}"`,
      );
    }

    await this.prisma.repository.delete({
      where: { id: repositoryId },
    });

    return { success: true, id: repositoryId };
  }
}
