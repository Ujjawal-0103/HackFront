import { JobsOptions } from "bullmq";

/**
 * Dedicated BullMQ queue name for repository history ingestion (ADR-008)
 */
export const INGESTION_QUEUE_NAME = "repository-ingestion";

/**
 * Standard job names for the repository ingestion pipeline
 */
export const INGESTION_JOB_NAMES = {
  SYNC_REPOSITORY: "sync-repository-history",
} as const;

export type IngestionJobName =
  (typeof INGESTION_JOB_NAMES)[keyof typeof INGESTION_JOB_NAMES];

/**
 * Default BullMQ job options for repository ingestion:
 * - Exponential backoff with bounded retries (3 attempts, initial 5s delay)
 * - Automatic cleanup of completed and failed jobs to prevent Redis memory bloat
 */
export const DEFAULT_INGESTION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 3600, // Retain completed jobs for 24 hours
    count: 1000, // Retain last 1000 completed records
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Retain failed jobs for 7 days for audit and diagnostics
    count: 5000,
  },
};

/**
 * Rate limit delay boundaries:
 * - Minimum delay: 5 seconds (prevents tight retry loops)
 * - Maximum delay: 1 hour (prevents indefinite stalling)
 * - Default fallback delay: 60 seconds (used when resetAt and retryAfter are missing/invalid)
 */
export const MIN_RATE_LIMIT_DELAY_MS = 5_000;
export const MAX_RATE_LIMIT_DELAY_MS = 3_600_000;
export const DEFAULT_RATE_LIMIT_FALLBACK_DELAY_MS = 60_000;
