import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { IngestionSyncService } from "./ingestion-sync.service";
import { TriggerSyncDto } from "./ingestion-sync.dto";
import {
  TriggerSyncResponse,
  RepositorySyncStatusResponse,
  RepositorySyncSummary,
} from "@traceback/shared-types";

/**
 * Controller exposing authenticated endpoints to trigger and monitor repository history syncs.
 * Supports both scoped workspace routes and direct repository sync paths.
 */
@Controller([
  "workspaces/:workspaceId/repositories/:repositoryId/sync",
  "repositories/:repositoryId/sync",
])
@UseGuards(AuthGuard, WorkspaceGuard)
export class IngestionSyncController {
  constructor(private readonly syncService: IngestionSyncService) {}

  /**
   * Triggers a manual sync job for the specified repository.
   * Route: POST /workspaces/:workspaceId/repositories/:repositoryId/sync OR POST /repositories/:repositoryId/sync
   */
  @Post(["", "trigger"])
  async triggerSync(
    @Param("repositoryId") repositoryId: string,
    @Param("workspaceId") workspaceId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body?: TriggerSyncDto,
  ): Promise<TriggerSyncResponse> {
    return this.syncService.triggerManualSync(
      repositoryId,
      user.id,
      workspaceId,
      body?.trigger || "MANUAL",
    );
  }

  /**
   * Retrieves overall sync progress, active running job, and history of recent syncs.
   * Route: GET /workspaces/:workspaceId/repositories/:repositoryId/sync OR GET /repositories/:repositoryId/sync
   */
  @Get(["", "status"])
  async getSyncStatus(
    @Param("repositoryId") repositoryId: string,
    @Param("workspaceId") workspaceId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RepositorySyncStatusResponse> {
    return this.syncService.getSyncStatus(
      repositoryId,
      user.id,
      workspaceId,
    );
  }

  /**
   * Retrieves progress details and diagnostic status for a specific sync job.
   * Route: GET .../jobs/:jobId
   */
  @Get("jobs/:jobId")
  async getJobDetails(
    @Param("jobId") jobId: string,
    @Param("workspaceId") workspaceId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RepositorySyncSummary> {
    return this.syncService.getSyncJobDetails(
      jobId,
      user.id,
      workspaceId,
    );
  }
}
