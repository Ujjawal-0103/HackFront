import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import {
  RepositoriesService,
  RepositoryDetailsDto,
  RepositoryActivityDto,
} from "./repositories.service";
import { CreateRepositoryDto } from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/repositories")
@UseGuards(AuthGuard, WorkspaceGuard)
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  async listRepositories(
    @Param("workspaceId") workspaceId: string,
  ): Promise<RepositoryDetailsDto[]> {
    return this.repositoriesService.listRepositories(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRepository(
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateRepositoryDto,
  ): Promise<RepositoryDetailsDto> {
    return this.repositoriesService.createRepository(workspaceId, dto);
  }

  @Get(":repositoryId")
  async getRepository(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<RepositoryDetailsDto> {
    return this.repositoriesService.getRepository(workspaceId, repositoryId);
  }

  @Get(":repositoryId/activity")
  async getRepositoryActivity(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<RepositoryActivityDto> {
    return this.repositoriesService.getRepositoryActivity(
      workspaceId,
      repositoryId,
    );
  }

  @Delete(":repositoryId")
  async deleteRepository(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.repositoriesService.deleteRepository(workspaceId, repositoryId);
  }
}
