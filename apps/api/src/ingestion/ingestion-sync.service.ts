import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import {
  INGESTION_QUEUE_NAME,
  INGESTION_JOB_NAMES,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from "./ingestion.constants";
import { IngestionJobPayload } from "./ingestion.types";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";
import {
  SyncTrigger,
  TriggerSyncResponse,
  RepositorySyncStatusResponse,
  RepositorySyncSummary,
} from "@traceback/shared-types";
import { sanitizeErrorMessage } from "../github/github.errors";

@Injectable()
export class IngestionSyncService {
  private readonly logger = new Logger(IngestionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
    @InjectQueue(INGESTION_QUEUE_NAME)
    private readonly ingestionQueue: Queue<IngestionJobPayload>,
    @Optional()
    private readonly orchestrator?: IngestionOrchestratorService,
  ) {}

  /**
   * Enqueues a manual repository sync job after validating user authorization and repository existence.
   */
  async triggerManualSync(
    repositoryId: string,
    userId: string,
    workspaceIdParam?: string,
    trigger: SyncTrigger = "MANUAL",
  ): Promise<TriggerSyncResponse> {
    if (
      !repositoryId ||
      typeof repositoryId !== "string" ||
      !repositoryId.trim()
    ) {
      throw new BadRequestException("Repository ID is required");
    }

    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId.trim() },
    });

    if (!repository) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    await this.verifyAccess(
      repository.workspaceId,
      userId,
      workspaceIdParam,
      repositoryId,
    );

    // Clean up any stale/orphaned jobs for this repository before starting a fresh sync
    await this.cleanupStaleSyncJobs(repository.id);

    // Verify that the repository's workspace has an associated GitHub App installation
    const installation = await this.prisma.gitHubInstallation.findFirst({
      where: { workspaceId: repository.workspaceId },
    });

    if (!installation) {
      throw new BadRequestException(
        `Repository workspace "${repository.workspaceId}" has no active GitHub App installation`,
      );
    }

    if (installation.workspaceId !== repository.workspaceId) {
      throw new BadRequestException(
        `Installation ${installation.installationId} does not belong to repository workspace "${repository.workspaceId}"`,
      );
    }

    const installationId = installation.installationId;

    // Create the tracking job record in PENDING status
    const syncJob = await this.prisma.repositorySyncJob.create({
      data: {
        repositoryId: repository.id,
        status: "PENDING",
        trigger,
        commitsCount: 0,
        pullRequestsCount: 0,
        issuesCount: 0,
      },
    });

    const payload: IngestionJobPayload = {
      repositoryId: repository.id,
      syncJobId: syncJob.id,
      installationId,
      fullName: repository.fullName,
      trigger,
      enqueuedAt: new Date().toISOString(),
    };

    try {
      await this.ingestionQueue.add(
        INGESTION_JOB_NAMES.SYNC_REPOSITORY,
        payload,
        DEFAULT_INGESTION_JOB_OPTIONS,
      );

      this.logger.log(
        `Successfully enqueued sync job ${syncJob.id} for repository ${repository.fullName}`,
      );

      return {
        jobId: syncJob.id,
        repositoryId: repository.id,
        status: "PENDING",
        message: `Sync job enqueued successfully for ${repository.fullName}`,
      };
    } catch (queueErr: any) {
      const sanitizedError = sanitizeErrorMessage(
        queueErr instanceof Error ? queueErr.message : String(queueErr),
      );

      this.logger.warn(
        `Failed to enqueue sync job ${syncJob.id} to Redis queue: ${sanitizedError}`,
      );

      // In development mode when Redis is not running, run directly via orchestrator
      if (this.orchestrator && process.env.NODE_ENV !== "production") {
        this.logger.warn(
          `Redis queue offline in development mode. Executing sync directly via orchestrator fallback for ${repository.fullName}.`,
        );

        // Run direct sync asynchronously
        this.orchestrator
          .orchestrateSync(payload)
          .catch((err) =>
            this.logger.error(
              `Direct fallback sync failed for ${repository.fullName}: ${err.message}`,
            ),
          );

        return {
          jobId: syncJob.id,
          repositoryId: repository.id,
          status: "PENDING",
          message: `Sync job initiated directly (development mode fallback) for ${repository.fullName}`,
        };
      }

      // Transition job to FAILED so it does not remain permanently PENDING in the database
      await this.prisma.repositorySyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "FAILED",
          errorMessage: `Queue enqueue failure: ${sanitizedError}`,
          completedAt: new Date(),
        },
      });

      throw new ServiceUnavailableException(
        `Failed to enqueue repository sync job: ${sanitizedError}`,
      );
    }
  }

  /**
   * Reaps any stale PENDING or SYNCING jobs older than 15 minutes to prevent the UI from remaining stuck indefinitely.
   */
  async cleanupStaleSyncJobs(repositoryId?: string): Promise<void> {
    const STALE_TIMEOUT_MS = 15 * 60 * 1000;
    const thresholdDate = new Date(Date.now() - STALE_TIMEOUT_MS);

    try {
      const staleJobs = await this.prisma.repositorySyncJob.findMany({
        where: {
          ...(repositoryId ? { repositoryId } : {}),
          status: { in: ["PENDING", "SYNCING"] },
          createdAt: { lt: thresholdDate },
        },
      });

      for (const stale of staleJobs) {
        this.logger.warn(
          `Reaping stale sync job ${stale.id} (created at ${stale.createdAt.toISOString()}) stuck in ${stale.status}`,
        );
        await this.prisma.repositorySyncJob.update({
          where: { id: stale.id },
          data: {
            status: "FAILED",
            errorMessage: stale.errorMessage
              ? `${stale.errorMessage} (Sync timed out or was interrupted)`
              : "Sync operation timed out or was interrupted. Status reset for retry.",
            completedAt: new Date(),
          },
        });
      }
    } catch (reapErr: any) {
      this.logger.warn(`Failed to reap stale sync jobs: ${reapErr.message}`);
    }
  }

  /**
   * Returns current sync status, active job (if running), and history of recent sync jobs.
   */
  async getSyncStatus(
    repositoryId: string,
    userId: string,
    workspaceIdParam?: string,
  ): Promise<RepositorySyncStatusResponse> {
    if (
      !repositoryId ||
      typeof repositoryId !== "string" ||
      !repositoryId.trim()
    ) {
      throw new BadRequestException("Repository ID is required");
    }

    await this.cleanupStaleSyncJobs(repositoryId.trim());

    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId.trim() },
    });

    if (!repository) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    await this.verifyAccess(
      repository.workspaceId,
      userId,
      workspaceIdParam,
      repositoryId,
    );

    const syncJobs = await this.prisma.repositorySyncJob.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentJobs: RepositorySyncSummary[] = syncJobs.map((j) => ({
      id: j.id,
      repositoryId: j.repositoryId,
      status: j.status,
      trigger: j.trigger,
      counts: {
        commits: j.commitsCount,
        pullRequests: j.pullRequestsCount,
        issues: j.issuesCount,
      },
      errorMessage: j.errorMessage
        ? sanitizeErrorMessage(j.errorMessage)
        : undefined,
      startedAt: j.startedAt ? j.startedAt.toISOString() : undefined,
      completedAt: j.completedAt ? j.completedAt.toISOString() : undefined,
      createdAt: j.createdAt.toISOString(),
    }));

    const activeJob = recentJobs.find(
      (j) => j.status === "PENDING" || j.status === "SYNCING",
    );

    return {
      repositoryId: repository.id,
      lastIndexedAt: repository.indexedAt
        ? repository.indexedAt.toISOString()
        : undefined,
      activeJob,
      recentJobs,
    };
  }

  /**
   * Retrieves status and diagnostic metadata for a single specific sync job.
   */
  async getSyncJobDetails(
    jobId: string,
    userId: string,
    workspaceIdParam?: string,
  ): Promise<RepositorySyncSummary> {
    if (!jobId || typeof jobId !== "string" || !jobId.trim()) {
      throw new BadRequestException("Job ID is required");
    }

    const job = await this.prisma.repositorySyncJob.findUnique({
      where: { id: jobId.trim() },
      include: { repository: true },
    });

    if (!job) {
      throw new NotFoundException(`Sync job "${jobId}" not found`);
    }

    await this.verifyAccess(
      job.repository.workspaceId,
      userId,
      workspaceIdParam,
      job.repositoryId,
    );

    return {
      id: job.id,
      repositoryId: job.repositoryId,
      status: job.status,
      trigger: job.trigger,
      counts: {
        commits: job.commitsCount,
        pullRequests: job.pullRequestsCount,
        issues: job.issuesCount,
      },
      errorMessage: job.errorMessage
        ? sanitizeErrorMessage(job.errorMessage)
        : undefined,
      startedAt: job.startedAt ? job.startedAt.toISOString() : undefined,
      completedAt: job.completedAt ? job.completedAt.toISOString() : undefined,
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Enforces cross-workspace isolation and user membership permissions.
   */
  private async verifyAccess(
    workspaceId: string,
    userId: string,
    workspaceIdParam?: string,
    repositoryId?: string,
  ): Promise<void> {
    if (workspaceIdParam && workspaceId !== workspaceIdParam) {
      throw new ForbiddenException(
        `Cross-workspace access denied: Repository "${repositoryId}" does not belong to workspace "${workspaceIdParam}"`,
      );
    }

    const membership = await this.workspacesService.getMembership(
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException(
        `Cross-workspace access denied: User "${userId}" does not have access to workspace "${workspaceId}"`,
      );
    }
  }
}
