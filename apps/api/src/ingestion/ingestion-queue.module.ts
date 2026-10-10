import { Module, Logger } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  INGESTION_QUEUE_NAME,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from "./ingestion.constants";
import { IngestionPersistenceService } from "./ingestion-persistence.service";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";
import { IngestionProcessor } from "./ingestion.processor";
import { IngestionSyncService } from "./ingestion-sync.service";
import { IngestionSyncController } from "./ingestion-sync.controller";
import { GitHubWebhookService } from "../github/github-webhook.service";
import { GitHubWebhookController } from "../github/github-webhook.controller";
import { GitHubModule } from "../github/github.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";

const logger = new Logger("IngestionQueueModule");

@Module({
  imports: [
    GitHubModule,
    WorkspacesModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>("app.redisHost") || "localhost";
        const port = configService.get<number>("app.redisPort") || 6379;
        const password = configService.get<string>("app.redisPassword");

        return {
          connection: {
            host,
            port,
            password: password || undefined,
            maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
            enableReadyCheck: false,
            lazyConnect: true,
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn(
                  `Redis connection deferred: reached max reconnect attempts (${times}) for ${host}:${port}`,
                );
                return null; // Bounded retry: halt automated reconnect loop if Redis is unreachable
              }
              return Math.min(times * 500, 2000);
            },
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: INGESTION_QUEUE_NAME,
      defaultJobOptions: DEFAULT_INGESTION_JOB_OPTIONS,
    }),
  ],
  controllers: [IngestionSyncController, GitHubWebhookController],
  providers: [
    IngestionPersistenceService,
    IngestionOrchestratorService,
    IngestionProcessor,
    IngestionSyncService,
    GitHubWebhookService,
  ],
  exports: [
    BullModule,
    IngestionPersistenceService,
    IngestionOrchestratorService,
    IngestionProcessor,
    IngestionSyncService,
    GitHubWebhookService,
  ],
})
export class IngestionQueueModule {}
