import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { VerificationSessionService } from "./verification-session.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  VerificationHistoryResponse,
  TracebackReportExport,
} from "@traceback/shared-types";
import { VerificationSessionResult } from "./verification.types";

@Controller("workspaces/:workspaceId/history")
@UseGuards(AuthGuard, WorkspaceGuard)
export class VerificationHistoryController {
  constructor(
    private readonly sessionService: VerificationSessionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lists past verification sessions across a workspace with pagination,
   * counts, and repository context.
   */
  @Get()
  async getWorkspaceHistory(
    @Param("workspaceId") workspaceId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("repositoryId") repositoryId?: string,
  ): Promise<VerificationHistoryResponse> {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    return this.sessionService.getWorkspaceHistory(workspaceId, {
      page: parsedPage,
      limit: parsedLimit,
      repositoryId,
    });
  }

  /**
   * Retrieves full details for a historical verification session in the workspace.
   */
  @Get(":sessionId")
  async getSessionDetails(
    @Param("workspaceId") workspaceId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<VerificationSessionResult> {
    const session = await this.prisma.verificationSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
      select: { repositoryId: true },
    });

    if (!session) {
      throw new NotFoundException(
        `Verification session "${sessionId}" not found in workspace "${workspaceId}"`,
      );
    }

    return this.sessionService.getSession(
      workspaceId,
      session.repositoryId,
      sessionId,
    );
  }

  /**
   * Exports historical verification report in standard JSON format.
   */
  @Get(":sessionId/export")
  async exportReport(
    @Param("workspaceId") workspaceId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<TracebackReportExport> {
    const session = await this.prisma.verificationSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
      select: { repositoryId: true },
    });

    if (!session) {
      throw new NotFoundException(
        `Verification session "${sessionId}" not found in workspace "${workspaceId}"`,
      );
    }

    return this.sessionService.exportReport(
      workspaceId,
      session.repositoryId,
      sessionId,
    );
  }
}
