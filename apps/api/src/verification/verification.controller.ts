import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { VerificationSessionService } from "./verification-session.service";
import {
  VerifyExplanationDto,
  SubmitVerdictDto,
  UpdateClaimDto,
} from "./verification.dto";
import { VerificationSessionResult } from "./verification.types";
import {
  HumanVerdictHistoryItem,
  TracebackReportExport,
} from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/repositories/:repositoryId/verify")
@UseGuards(AuthGuard, WorkspaceGuard)
export class VerificationController {
  constructor(private readonly sessionService: VerificationSessionService) {}

  /**
   * Submits an external AI explanation to extract claims, retrieve historical evidence,
   * validate citations, and generate preliminary grounding assessments.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async verifyExplanation(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: VerifyExplanationDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<VerificationSessionResult> {
    return this.sessionService.verifyExplanation({
      workspaceId,
      repositoryId,
      userId: user?.id,
      explanation: dto.explanation,
      codeSnippet: dto.codeSnippet,
      targetFilePath: dto.targetFilePath,
      targetSymbol: dto.targetSymbol,
      maxClaims: dto.maxClaims,
    });
  }

  /**
   * Retrieves an existing verification session with claims, preliminary assessments,
   * human verdicts, and evidence citations.
   */
  @Get(":sessionId")
  async getSession(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<VerificationSessionResult> {
    return this.sessionService.getSession(workspaceId, repositoryId, sessionId);
  }

  /**
   * Lists past verification sessions for a repository.
   */
  @Get()
  async listSessions(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.sessionService.listSessions(
      workspaceId,
      repositoryId,
      parsedLimit,
    );
  }

  /**
   * Records or revises a human reviewer verdict for a claim, preserving an audit trail.
   */
  @Post(":sessionId/claims/:claimId/verdict")
  @HttpCode(HttpStatus.OK)
  async recordVerdict(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
    @Param("claimId") claimId: string,
    @Body() dto: SubmitVerdictDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.sessionService.recordVerdict({
      workspaceId,
      repositoryId,
      sessionId,
      claimId,
      userId: user?.id || "user_1",
      verdict: dto.verdict,
      reviewNotes: dto.reviewNotes,
    });
  }

  /**
   * Retrieves append-only verdict change history for a claim.
   */
  @Get(":sessionId/claims/:claimId/verdicts")
  async getVerdictHistory(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
    @Param("claimId") claimId: string,
  ): Promise<HumanVerdictHistoryItem[]> {
    return this.sessionService.getClaimVerdictHistory(
      workspaceId,
      repositoryId,
      sessionId,
      claimId,
    );
  }

  /**
   * Allows reviewer to edit claim text.
   */
  @Patch(":sessionId/claims/:claimId")
  async updateClaim(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
    @Param("claimId") claimId: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.sessionService.updateClaimText(
      workspaceId,
      repositoryId,
      sessionId,
      claimId,
      dto.text,
    );
  }

  /**
   * Exports verification report adhering to traceback.report.v1 JSON schema.
   */
  @Get(":sessionId/export")
  async exportReport(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<TracebackReportExport> {
    return this.sessionService.exportReport(
      workspaceId,
      repositoryId,
      sessionId,
    );
  }
}
