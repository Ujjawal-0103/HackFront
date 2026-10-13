import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { configuration } from "./config/configuration";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { GitHubModule } from "./github/github.module";
import { IngestionQueueModule } from "./ingestion/ingestion-queue.module";
import { EvidenceModule } from "./evidence/evidence.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    HealthModule,
    WorkspacesModule,
    GitHubModule,
    IngestionQueueModule,
    EvidenceModule,
  ],
})
export class AppModule {}
