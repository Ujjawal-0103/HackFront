import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { INGESTION_QUEUE_NAME } from "./ingestion.constants";
import { IngestionJobPayload } from "./ingestion.types";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";

/**
 * BullMQ processor consuming jobs from the repository-ingestion queue.
 * Delegates lifecycle execution, bounded batching, and error classification to IngestionOrchestratorService.
 */
@Processor(INGESTION_QUEUE_NAME)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly orchestrator: IngestionOrchestratorService) {
    super();
  }

  async process(job: Job<IngestionJobPayload>): Promise<any> {
    this.logger.log(
      `Processing ingestion job #${job.id} for "${job.data?.fullName}" (syncJobId: ${job.data?.syncJobId})`,
    );

    return this.orchestrator.orchestrateSync(job.data, job);
  }
}
