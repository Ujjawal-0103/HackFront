import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { AdvisoryService } from "./advisory.service";
import {
  CheckChangeAgainstDecisionsDto,
  RunHistoricalIntentCheckDto,
  RecordIntentDispositionDto,
} from "./advisory.dto";
import {
  CheckChangeAgainstDecisionsResponse,
  HistoricalIntentCheckSessionDto,
} from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/repositories/:repositoryId/advisory")
@UseGuards(AuthGuard, WorkspaceGuard)
export class AdvisoryController {
  constructor(private readonly advisoryService: AdvisoryService) {}

  /**
   * Evaluates proposed code diffs or change descriptions against historical ADRs,
   * past commits, and recorded constraints. Purely advisory and read-only.
   */
  @Post("check-change")
  @HttpCode(HttpStatus.OK)
  async checkChange(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: CheckChangeAgainstDecisionsDto,
  ): Promise<CheckChangeAgainstDecisionsResponse> {
    return this.advisoryService.checkChangeAgainstDecisions({
      ...dto,
      workspaceId,
      repositoryId,
    });
  }

  /**
   * Flagship Feature: Run and persist a Historical Intent Check session.
   */
  @Post("intent-check")
  @HttpCode(HttpStatus.CREATED)
  async runIntentCheck(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: RunHistoricalIntentCheckDto,
  ): Promise<HistoricalIntentCheckSessionDto> {
    return this.advisoryService.runHistoricalIntentCheck({
      workspaceId,
      repositoryId,
      diff: dto.diff,
      filePath: dto.filePath,
      changeDescription: dto.changeDescription,
    });
  }

  @Get("intent-checks")
  async listIntentChecks(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<HistoricalIntentCheckSessionDto[]> {
    return this.advisoryService.listIntentCheckSessions(workspaceId, repositoryId);
  }

  @Get("intent-checks/:sessionId")
  async getIntentCheck(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<HistoricalIntentCheckSessionDto> {
    return this.advisoryService.getIntentCheckSession(
      workspaceId,
      repositoryId,
      sessionId,
    );
  }

  @Post("intent-checks/:sessionId/disposition")
  @HttpCode(HttpStatus.OK)
  async recordDisposition(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: RecordIntentDispositionDto,
  ): Promise<HistoricalIntentCheckSessionDto> {
    return this.advisoryService.recordIntentDisposition(
      workspaceId,
      repositoryId,
      sessionId,
      dto.disposition,
      dto.notes,
    );
  }
}
