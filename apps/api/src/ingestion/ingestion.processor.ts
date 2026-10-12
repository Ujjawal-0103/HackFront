import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { DelayedError, Job } from "bullmq";
import {
  INGESTION_QUEUE_NAME,
  MIN_RATE_LIMIT_DELAY_MS,
  MAX_RATE_LIMIT_DELAY_MS,
  DEFAULT_RATE_LIMIT_FALLBACK_DELAY_MS,
} from "./ingestion.constants";
import { IngestionJobPayload } from "./ingestion.types";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";
import { GitHubRateLimitError } from "../github/github.errors";

/**
 * BullMQ processor consuming jobs from the repository-ingestion queue.
 * Delegates lifecycle execution, bounded batching, and error classification to IngestionOrchestratorService.
 * Handles rate-limit rescheduling via job.moveToDelayed() and DelayedError.
 */
@Processor(INGESTION_QUEUE_NAME)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly orchestrator: IngestionOrchestratorService) {
    super();
  }

  async process(job: Job<IngestionJobPayload>, token?: string): Promise<any> {
    this.logger.log(
      `Processing ingestion job #${job.id} for "${job.data?.fullName}" (syncJobId: ${job.data?.syncJobId})`,
    );

    try {
      return await this.orchestrator.orchestrateSync(job.data, job);
    } catch (err: unknown) {
      if (err instanceof GitHubRateLimitError) {
        await this.handleRateLimitReschedule(job, err, token);
      }
      throw err;
    }
  }

  /**
   * Reschedules the active job until the GitHub rate-limit reset window without consuming retry attempts.
   * Uses BullMQ's native job.moveToDelayed() API and throws DelayedError for worker control-flow.
   */
  async handleRateLimitReschedule(
    job: Job<IngestionJobPayload>,
    err: GitHubRateLimitError,
    token?: string,
  ): Promise<void> {
    const now = Date.now();
    const targetTimestamp = this.calculateTargetTimestamp(err, now);
    const delayMs = targetTimestamp - now;

    this.logger.warn(
      `Rate limit exceeded for "${job.data?.fullName}" (job #${job.id}). Rescheduling job until ${new Date(targetTimestamp).toISOString()} (${Math.round(delayMs / 1000)}s delay).`,
    );

    if (typeof job?.moveToDelayed === "function") {
      const effectiveToken = token || (job as any)?.token || "0";
      await job.moveToDelayed(targetTimestamp, effectiveToken);
      throw new DelayedError();
    }
  }

  /**
   * Safely calculates the target epoch timestamp (ms) from GitHubRateLimitError.
   * Clamps delay to prevent tight retry loops (minimum 5s) and indefinite delays (maximum 1h).
   */
  calculateTargetTimestamp(err: GitHubRateLimitError, now: number): number {
    let targetTimestamp: number;

    if (err.resetAt instanceof Date && !isNaN(err.resetAt.getTime())) {
      targetTimestamp = err.resetAt.getTime();
    } else if (
      typeof err.retryAfterSeconds === "number" &&
      Number.isFinite(err.retryAfterSeconds) &&
      err.retryAfterSeconds > 0
    ) {
      targetTimestamp = now + Math.round(err.retryAfterSeconds * 1000);
    } else {
      targetTimestamp = now + DEFAULT_RATE_LIMIT_FALLBACK_DELAY_MS;
    }

    // Clamp: minimum 5s into the future to avoid tight loops; maximum 1 hour into the future to avoid indefinite delays
    const minTimestamp = now + MIN_RATE_LIMIT_DELAY_MS;
    const maxTimestamp = now + MAX_RATE_LIMIT_DELAY_MS;

    if (targetTimestamp < minTimestamp) {
      targetTimestamp = minTimestamp;
    } else if (targetTimestamp > maxTimestamp) {
      targetTimestamp = maxTimestamp;
    }

    return targetTimestamp;
  }
}
