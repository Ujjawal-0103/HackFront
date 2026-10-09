import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { WorkspaceGuard } from './workspace.guard';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceSummary } from '@traceback/shared-types';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async listWorkspaces(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceSummary[]> {
    return this.workspacesService.listUserWorkspaces(user.id);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  async getWorkspace(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceSummary> {
    return this.workspacesService.getWorkspaceDetails(workspaceId);
  }
}
