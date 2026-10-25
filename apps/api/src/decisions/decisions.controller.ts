import {
  Controller,
  Get,
  Post,
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
import { DecisionsService } from "./decisions.service";
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  ReviewDecisionDto,
  SupersedeDecisionDto,
  ProposeFromClaimDto,
} from "./decisions.dto";
import { DecisionStatus, EngineeringDecisionDto } from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/repositories/:repositoryId/decisions")
@UseGuards(AuthGuard, WorkspaceGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  async listDecisions(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Query("status") status?: DecisionStatus,
  ): Promise<EngineeringDecisionDto[]> {
    return this.decisionsService.listDecisions(workspaceId, repositoryId, status);
  }

  @Get(":id")
  async getDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.getDecisionById(workspaceId, repositoryId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: CreateDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.createDecision(workspaceId, repositoryId, dto, user);
  }

  @Post("propose-from-claim")
  @HttpCode(HttpStatus.CREATED)
  async proposeFromClaim(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: ProposeFromClaimDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.proposeFromClaim(workspaceId, repositoryId, dto, user);
  }

  @Patch(":id")
  async updateDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.updateDecision(workspaceId, repositoryId, id, dto, user);
  }

  @Post(":id/accept")
  async acceptDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.acceptDecision(workspaceId, repositoryId, id, dto, user);
  }

  @Post(":id/reject")
  async rejectDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.rejectDecision(workspaceId, repositoryId, id, dto, user);
  }

  @Post(":id/dispute")
  async disputeDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.disputeDecision(workspaceId, repositoryId, id, dto, user);
  }

  @Post(":id/supersede")
  async supersedeDecision(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("id") id: string,
    @Body() dto: SupersedeDecisionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    return this.decisionsService.supersedeDecision(workspaceId, repositoryId, id, dto, user);
  }
}
