import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { GitHubService } from './github.service';
import { GitHubRepositoryMetadata, RepositoryAccessPermission } from './github.types';

@Controller('workspaces/:workspaceId/github')
@UseGuards(AuthGuard, WorkspaceGuard)
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @Get('repositories')
  async listRepositories(
    @Query('installationId') installationIdParam?: string,
  ): Promise<GitHubRepositoryMetadata[]> {
    const installationId = installationIdParam ? parseInt(installationIdParam, 10) : 1001;
    return this.githubService.listAuthorizedRepositories(installationId);
  }

  @Get('verify')
  async verifyRepository(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('installationId') installationIdParam?: string,
  ): Promise<RepositoryAccessPermission> {
    if (!owner || !repo) {
      throw new BadRequestException('Both "owner" and "repo" query parameters are required');
    }

    const installationId = installationIdParam ? parseInt(installationIdParam, 10) : 1001;
    return this.githubService.verifyRepositoryAccess(installationId, owner, repo);
  }
}
