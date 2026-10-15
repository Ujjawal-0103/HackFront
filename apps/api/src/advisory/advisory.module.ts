import { Module } from "@nestjs/common";
import { AdvisoryService } from "./advisory.service";
import { AdvisoryController } from "./advisory.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EvidenceModule } from "../evidence/evidence.module";
import { AuthModule } from "../auth/auth.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [PrismaModule, EvidenceModule, AuthModule, WorkspacesModule],
  controllers: [AdvisoryController],
  providers: [AdvisoryService],
  exports: [AdvisoryService],
})
export class AdvisoryModule {}
