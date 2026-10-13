import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { EvidenceSearchService } from "./evidence-search.service";
import { EvidenceProjectionService } from "./evidence-projection.service";
import { GraphRetrieverService } from "./graph-retriever.service";
import { Neo4jService } from "../graph/neo4j.service";
import { GraphProjectionService } from "../graph/graph-projection.service";
import { EvidenceController } from "./evidence.controller";

@Module({
  imports: [PrismaModule, ConfigModule, WorkspacesModule],
  controllers: [EvidenceController],
  providers: [
    EvidenceSearchService,
    EvidenceProjectionService,
    GraphRetrieverService,
    Neo4jService,
    GraphProjectionService,
  ],
  exports: [
    EvidenceSearchService,
    EvidenceProjectionService,
    GraphRetrieverService,
    Neo4jService,
    GraphProjectionService,
  ],
})
export class EvidenceModule {}
