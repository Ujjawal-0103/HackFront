import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { VerificationSessionService } from "./verification-session.service";
import { VerifyExplanationDto } from "./verification.dto";
import { VerificationSessionResult } from "./verification.types";

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
  ): Promise<VerificationSessionResult> {
    return this.sessionService.verifyExplanation({
      workspaceId,
      repositoryId,
      explanation: dto.explanation,
      codeSnippet: dto.codeSnippet,
      targetFilePath: dto.targetFilePath,
      targetSymbol: dto.targetSymbol,
      maxClaims: dto.maxClaims,
    });
  }

  /**
   * Retrieves an existing verification session with claims, preliminary assessments,
   * and evidence citations.
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
}
