import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { WorkspaceGuard } from "./workspace.guard";
import { AuthGuard } from "../auth/auth.guard";

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard, AuthGuard],
  exports: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
