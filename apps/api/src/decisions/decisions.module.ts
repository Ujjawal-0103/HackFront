import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DecisionsService } from "./decisions.service";
import { DecisionsController } from "./decisions.controller";
import { AuthModule } from "../auth/auth.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [PrismaModule, AuthModule, WorkspacesModule],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
