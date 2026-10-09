import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { WorkspacesService } from './workspaces.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const rawWorkspaceId = request.params?.['workspaceId'];
    if (!rawWorkspaceId) {
      // If endpoint is not scoped to a specific workspace ID param, allow
      return true;
    }

    const workspaceId = Array.isArray(rawWorkspaceId) ? rawWorkspaceId[0] : rawWorkspaceId;
    if (!workspaceId) {
      return true;
    }

    const membership = await this.workspacesService.getMembership(workspaceId, user.id);
    if (!membership) {
      throw new ForbiddenException(
        `Cross-workspace access denied: User ${user.id} does not have access to workspace ${workspaceId}`,
      );
    }

    request.workspaceContext = {
      workspaceId,
      role: membership.role,
    };

    return true;
  }
}
