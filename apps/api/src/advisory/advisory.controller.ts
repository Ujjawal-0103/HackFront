import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { AdvisoryService } from "./advisory.service";
import { CheckChangeAgainstDecisionsDto } from "./advisory.dto";
import { CheckChangeAgainstDecisionsResponse } from "@traceback/shared-types";

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
}
