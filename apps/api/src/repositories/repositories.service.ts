import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GitHubService } from "../github/github.service";
import {
  CreateRepositoryDto,
  RepositoryDetailsDto,
  RepositoryActivityDto,
  ImportRepositoryByUrlResponse,
} from "@traceback/shared-types";
import { parseGitHubRepositoryUrl } from "./github-url-parser.util";

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

    let installationId = dto.installationId;
    if (!installationId && this.prisma?.gitHubInstallation) {
      const inst = await this.prisma.gitHubInstallation.findFirst({
        where: { workspaceId },
      });
      if (inst) {
        installationId = inst.installationId;
      }
    }

    if (!installationId) {
      if (this.githubService.isMock()) {
        installationId = 1001;
      } else {
        throw new BadRequestException(
          `Workspace "${workspaceId}" has no active GitHub App installation. Please connect an installation before importing repositories.`,
        );
      }
    }

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

  /**
   * Imports or connects a repository by pasting its GitHub URL.
   * Enforces strict URL parsing, workspace authorization, and live GitHub App installation verification.
   */
  async importRepositoryByUrl(
    workspaceId: string,
    url: string,
  ): Promise<ImportRepositoryByUrlResponse> {
    const { owner, repo, fullName, canonicalUrl } =
      parseGitHubRepositoryUrl(url);

    await this.ensureWorkspaceExists(workspaceId);

    // 1. Check if the repository is already connected to this workspace
    const existing = await this.prisma.repository.findUnique({
      where: {
        workspaceId_fullName: {
          workspaceId,
          fullName,
        },
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

    if (existing) {
      return {
        repository: this.mapRepositoryDetails(existing),
        isAlreadyConnected: true,
        message: `Repository "${fullName}" is already connected to this workspace.`,
      };
    }

    // 2. Resolve active GitHub installation for this workspace
    let installationId: number | undefined;
    if (this.prisma?.gitHubInstallation) {
      const inst = await this.prisma.gitHubInstallation.findFirst({
        where: { workspaceId },
      });
      if (inst) {
        installationId = inst.installationId;
      }
    }

    // 3. Mock mode safety rules
    if (this.githubService.isMock()) {
      const isFixture =
        fullName.toLowerCase() === "ujjawal-0103/hackfront" ||
        fullName.toLowerCase() === "acme-corp/payment-service";

      if (!isFixture) {
        throw new BadRequestException(
          `Cannot connect "${fullName}" by URL in Development Mock Sandbox Mode. Only mock fixtures ("Ujjawal-0103/HackFront", "acme-corp/payment-service") are available without live GitHub App credentials. Please configure GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY for live repository integration.`,
        );
      }
      installationId = 1001;
    } else {
      if (!installationId) {
        throw new BadRequestException(
          `Workspace "${workspaceId}" has no active GitHub App installation. Please connect a GitHub App installation before importing repositories by URL.`,
        );
      }
    }

    // 4. Verify repository access through the GitHub App installation
    try {
      await this.githubService.verifyRepositoryAccess(
        installationId,
        owner,
        repo,
      );
    } catch (err: any) {
      if (err instanceof ForbiddenException || err.status === 403) {
        throw new ForbiddenException(
          `Repository "${fullName}" is not authorized for GitHub App Installation #${installationId}. Please install the GitHub App on "${owner}" or grant access to "${repo}" in GitHub App installation settings.`,
        );
      }
      if (err instanceof NotFoundException || err.status === 404) {
        throw new NotFoundException(
          `Repository "${fullName}" was not found or is not accessible to GitHub App Installation #${installationId}. Verify that the repository exists and access has been granted to the GitHub App.`,
        );
      }
      throw err;
    }

    // 5. Fetch verified repository metadata
    let defaultBranch = "main";
    let isPrivate = false;
    let githubRepoId: number | undefined;

    try {
      const meta = await this.githubService.getRepository(
        installationId,
        owner,
        repo,
      );
      defaultBranch = meta.defaultBranch || "main";
      isPrivate = Boolean(meta.isPrivate);
      if (typeof meta.id === "number") {
        githubRepoId = meta.id;
      }
    } catch (_err) {
      // Non-fatal if metadata retrieval fails after access verification
    }

    // 6. Persist repository record in PostgreSQL
    const created = await this.prisma.repository.create({
      data: {
        workspaceId,
        fullName,
        defaultBranch,
        isPrivate,
        githubRepoId: githubRepoId || undefined,
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
      repository: this.mapRepositoryDetails(created),
      isAlreadyConnected: false,
      message: `Repository "${fullName}" successfully connected to workspace.`,
    };
  }

  /**
   * Helper to transform Prisma repository entity into DTO contract.
   */
  private mapRepositoryDetails(repo: any): RepositoryDetailsDto {
    const latestJob = repo.syncJobs?.[0] || null;
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
        commits: repo._count?.commits ?? 0,
        pullRequests: repo._count?.pullRequests ?? 0,
        issues: repo._count?.issues ?? 0,
        sourceRecords: repo._count?.sourceRecords ?? 0,
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
}

