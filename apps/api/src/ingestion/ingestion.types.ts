import { SyncTrigger } from "@traceback/shared-types";

/**
 * Minimal, typed ingestion job payload linking to repository and sync job records.
 * Security notice (ADR-008): Stored strictly with IDs, never raw GitHub tokens or secrets.
 */
export interface IngestionJobPayload {
  /**
   * Internal database UUID of the target repository
   */
  repositoryId: string;

  /**
   * Internal database UUID of the sync job tracking record
   */
  syncJobId: string;

  /**
   * GitHub App installation ID authorized to access this repository
   */
  installationId: number;

  /**
   * Full repository name (e.g. "owner/repo")
   */
  fullName: string;

  /**
   * Trigger source for this sync run ("MANUAL" | "WEBHOOK")
   */
  trigger: SyncTrigger;

  /**
   * Timestamp when the job was enqueued (ISO 8601)
   */
  enqueuedAt: string;
}
