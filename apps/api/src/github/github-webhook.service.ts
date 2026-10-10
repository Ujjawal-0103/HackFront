import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  INGESTION_QUEUE_NAME,
  INGESTION_JOB_NAMES,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from "../ingestion/ingestion.constants";
import { IngestionJobPayload } from "../ingestion/ingestion.types";
import { sanitizeErrorMessage } from "./github.errors";

export interface GitHubWebhookHeaders {
  event?: string;
  deliveryId?: string;
  signature?: string;
}

/**
 * Validates HMAC-SHA256 signature against raw request body using constant-time comparison.
 */
export function verifyGitHubWebhookSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHex = signatureHeader.substring(7);
  if (!providedHex || !/^[a-f0-9]{64}$/i.test(providedHex)) {
    return false;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : typeof rawBody === "string"
      ? Buffer.from(rawBody, "utf8")
      : Buffer.from(JSON.stringify(rawBody || {}), "utf8");

  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(bodyBuffer)
    .digest("hex");

  const providedBuf = Buffer.from(providedHex, "hex");
  const computedBuf = Buffer.from(computedHex, "hex");

  if (providedBuf.length !== computedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, computedBuf);
}

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);
  private readonly recentDeliveries = new Set<string>();
  private readonly MAX_DELIVERY_CACHE_SIZE = 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(INGESTION_QUEUE_NAME)
    private readonly ingestionQueue: Queue<IngestionJobPayload>,
  ) {}

  /**
   * Processes an incoming GitHub webhook delivery:
   * 1. Verifies HMAC-SHA256 signature with constant-time equality
   * 2. Validates event and delivery headers
   * 3. Checks in-memory delivery ID deduplication
   * 4. Resolves repository against database (never trusting client-supplied IDs)
   * 5. Creates RepositorySyncJob and enqueues ingestion job
   * 6. Handles installation revocation
   */
  async handleWebhookDelivery(
    headers: GitHubWebhookHeaders,
    rawBody: Buffer | string | undefined,
    payload: any,
  ): Promise<{
    status: "ok" | "enqueued" | "ignored" | "duplicate" | "revoked" | "unsupported_revocation_state" | "handled";
    message?: string;
    jobId?: string;
    repositoryId?: string;
    deliveryId?: string;
    action?: string;
    installationId?: number;
  }> {
    // 1. Signature Verification
    this.verifySignature(rawBody, headers.signature);

    const event = headers.event;
    if (!event || typeof event !== "string" || !event.trim()) {
      throw new BadRequestException("Missing or invalid X-GitHub-Event header");
    }

    const deliveryId = headers.deliveryId;
    if (!deliveryId || typeof deliveryId !== "string" || !deliveryId.trim()) {
      throw new BadRequestException("Missing or invalid X-GitHub-Delivery header");
    }

    // 2. Delivery ID Deduplication (in-memory LRU cache + BullMQ queue check)
    if (this.recentDeliveries.has(deliveryId)) {
      this.logger.log(`Ignoring duplicate delivery ID (in-memory): ${deliveryId}`);
      return {
        status: "duplicate",
        message: `Delivery ${deliveryId} already processed`,
        deliveryId,
      };
    }

    try {
      const existingJob = await this.ingestionQueue.getJob(`delivery_${deliveryId}`);
      if (existingJob) {
        this.logger.log(
          `Ignoring duplicate delivery ID from active queue state: ${deliveryId}`,
        );
        this.recordDeliveryId(deliveryId);
        return {
          status: "duplicate" as const,
          message: `Delivery ${deliveryId} already enqueued or processed in queue`,
          deliveryId,
        };
      }
    } catch {
      // Non-fatal if queue check is temporarily unavailable
    }

    this.recordDeliveryId(deliveryId);

    // 3. Handle Ping Event
    if (event === "ping") {
      this.logger.log(`Received GitHub webhook ping (hookId: ${payload?.hook_id})`);
      return { status: "ok", message: "pong" };
    }

    // 4. Handle Installation Lifecycle & Revocation
    if (event === "installation") {
      return this.handleInstallationEvent(payload);
    }

    // 5. Handle Supported Sync Events (push, pull_request, issues)
    const supportedSyncEvents = ["push", "pull_request", "issues"];
    if (supportedSyncEvents.includes(event)) {
      return this.handleRepositorySyncEvent(event, deliveryId, payload);
    }

    // 6. Safely ignore unsupported event types
    this.logger.log(`Ignoring unsupported GitHub event type: "${event}"`);
    return {
      status: "ignored",
      message: `Event "${event}" is not handled for ingestion`,
    };
  }

  /**
   * Verifies the HMAC-SHA256 signature against the raw request body.
   */
  public verifySignature(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
  ): void {
    const nodeEnv =
      this.configService.get<string>("app.nodeEnv") ||
      process.env.NODE_ENV ||
      "development";
    const isProduction = nodeEnv === "production";

    const secret =
      this.configService.get<string>("app.githubWebhookSecret") ||
      (isProduction
        ? process.env.GITHUB_WEBHOOK_SECRET?.trim()
        : process.env.GITHUB_WEBHOOK_SECRET?.trim() || "development-webhook-secret") ||
      "";

    if (isProduction && (!secret || secret === "development-webhook-secret")) {
      this.logger.error(
        "GitHub webhook verification rejected: GITHUB_WEBHOOK_SECRET is unconfigured or insecure in production environment",
      );
      throw new UnauthorizedException("GitHub webhook secret is unconfigured in production");
    }

    if (!secret) {
      this.logger.warn("GitHub webhook secret is not configured in environment");
      throw new UnauthorizedException("GitHub webhook secret is unconfigured");
    }

    if (!signatureHeader) {
      throw new UnauthorizedException("Missing X-Hub-Signature-256 header");
    }

    const isValid = verifyGitHubWebhookSignature(rawBody, signatureHeader, secret);
    if (!isValid) {
      throw new UnauthorizedException("Invalid X-Hub-Signature-256 webhook signature");
    }
  }

  private async handleInstallationEvent(payload: any) {
    const action = payload?.action;
    const installationId = payload?.installation?.id
      ? Number(payload.installation.id)
      : undefined;

    if (action === "deleted" && installationId) {
      // Installation Revocation: Delete installation record so future lookups cannot use it
      const existing = await this.prisma.gitHubInstallation.findUnique({
        where: { installationId },
      });

      if (existing) {
        await this.prisma.gitHubInstallation.delete({
          where: { installationId },
        });
        this.logger.log(
          `Removed GitHubInstallation ${installationId} following installation.deleted webhook`,
        );
        return {
          status: "revoked" as const,
          action: "deleted",
          installationId,
          message: `Installation ${installationId} removed from persisted state`,
        };
      }
    }

    if (action === "suspend" && installationId) {
      // Schema Limitation: GitHubInstallation model has no status or suspendedAt column.
      // Report safely without inventing unpersisted fields.
      this.logger.warn(
        `Installation ${installationId} suspended, but schema lacks status field for suspension state`,
      );
      return {
        status: "unsupported_revocation_state" as const,
        action: "suspend",
        installationId,
        message:
          "Installation suspension cannot be explicitly persisted without schema status field",
      };
    }

    return {
      status: "handled" as const,
      action: action || "unknown",
      installationId,
    };
  }

  private async handleRepositorySyncEvent(
    event: string,
    deliveryId: string,
    payload: any,
  ) {
    const githubRepoId = payload?.repository?.id
      ? Number(payload.repository.id)
      : undefined;
    const fullName = payload?.repository?.full_name
      ? String(payload.repository.full_name).trim()
      : undefined;

    if (!githubRepoId && !fullName) {
      return {
        status: "ignored" as const,
        message: "Webhook event payload missing repository identification",
      };
    }

    // Resolve repository strictly from database by githubRepoId or fullName
    let repository = githubRepoId
      ? await this.prisma.repository.findUnique({
          where: { githubRepoId },
        })
      : null;

    if (!repository && fullName) {
      repository = await this.prisma.repository.findFirst({
        where: { fullName },
      });
    }

    if (!repository) {
      this.logger.log(
        `Ignoring "${event}" webhook for untracked repository: "${fullName || githubRepoId}"`,
      );
      return {
        status: "ignored" as const,
        message: `Repository "${fullName || githubRepoId}" is not registered in Traceback`,
      };
    }

    // Validate installation identification strictly from webhook payload (no dummy 1001 fallback)
    const rawInstallationId = payload?.installation?.id;
    const installationId = rawInstallationId ? Number(rawInstallationId) : undefined;

    if (!installationId || isNaN(installationId)) {
      this.logger.warn(
        `Ignoring "${event}" webhook for "${repository.fullName}": missing or invalid installation ID`,
      );
      return {
        status: "ignored" as const,
        message: "Webhook payload missing valid installation identification",
      };
    }

    // Verify installation exists in database
    const installation = await this.prisma.gitHubInstallation.findUnique({
      where: { installationId },
    });

    if (!installation) {
      this.logger.warn(
        `Ignoring "${event}" webhook for "${repository.fullName}": installation ${installationId} not found in database`,
      );
      return {
        status: "ignored" as const,
        message: `Installation ${installationId} is not registered in Traceback`,
      };
    }

    // Verify installation belongs to the repository's workspace
    if (installation.workspaceId !== repository.workspaceId) {
      this.logger.warn(
        `Ignoring "${event}" webhook for "${repository.fullName}": installation ${installationId} belongs to workspace "${installation.workspaceId}", not repository workspace "${repository.workspaceId}"`,
      );
      return {
        status: "ignored" as const,
        message: `Installation ${installationId} does not belong to repository's workspace`,
      };
    }

    // Create tracking job with WEBHOOK trigger
    const syncJob = await this.prisma.repositorySyncJob.create({
      data: {
        repositoryId: repository.id,
        status: "PENDING",
        trigger: "WEBHOOK",
        commitsCount: 0,
        pullRequestsCount: 0,
        issuesCount: 0,
      },
    });

    const queuePayload: IngestionJobPayload = {
      repositoryId: repository.id,
      syncJobId: syncJob.id,
      installationId,
      fullName: repository.fullName,
      trigger: "WEBHOOK",
      enqueuedAt: new Date().toISOString(),
    };

    try {
      await this.ingestionQueue.add(
        INGESTION_JOB_NAMES.SYNC_REPOSITORY,
        queuePayload,
        {
          ...DEFAULT_INGESTION_JOB_OPTIONS,
          jobId: `delivery_${deliveryId}`,
        },
      );

      this.logger.log(
        `Enqueued webhook sync job ${syncJob.id} for "${repository.fullName}" (event: ${event}, delivery: ${deliveryId})`,
      );

      return {
        status: "enqueued" as const,
        jobId: syncJob.id,
        repositoryId: repository.id,
        deliveryId,
      };
    } catch (queueErr: any) {
      const sanitized = sanitizeErrorMessage(
        queueErr instanceof Error ? queueErr.message : String(queueErr),
      );

      await this.prisma.repositorySyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "FAILED",
          errorMessage: `Webhook queue enqueue failure: ${sanitized}`,
          completedAt: new Date(),
        },
      });

      throw new ServiceUnavailableException(
        `Failed to enqueue webhook sync job: ${sanitized}`,
      );
    }
  }

  private recordDeliveryId(deliveryId: string): void {
    if (this.recentDeliveries.size >= this.MAX_DELIVERY_CACHE_SIZE) {
      const oldestKey = this.recentDeliveries.values().next().value;
      if (oldestKey) {
        this.recentDeliveries.delete(oldestKey);
      }
    }
    this.recentDeliveries.add(deliveryId);
  }
}
