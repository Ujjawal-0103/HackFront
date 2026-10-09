import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { WorkspaceGuard } from './workspace.guard';
import { WorkspacesService } from './workspaces.service';

describe('WorkspaceGuard (Multi-Tenant Cross-Workspace Isolation)', () => {
  let guard: WorkspaceGuard;
  let service: WorkspacesService;

  beforeEach(() => {
    service = new WorkspacesService();
    guard = new WorkspaceGuard(service);
  });

  it('should allow access when user is an authorized member of the requested workspace', async () => {
    const mockRequest: any = {
      user: { id: 'user_1', email: 'user1@example.com', name: 'User 1' },
      params: { workspaceId: 'ws_alpha' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(mockRequest.workspaceContext).toEqual({
      workspaceId: 'ws_alpha',
      role: 'OWNER',
    });
  });

  it('should throw ForbiddenException when user attempts to access a different workspace (Cross-Tenant Leakage Prevention)', async () => {
    // user_1 only has membership in ws_alpha, NOT ws_beta
    const mockRequest: any = {
      user: { id: 'user_1', email: 'user1@example.com', name: 'User 1' },
      params: { workspaceId: 'ws_beta' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      /Cross-workspace access denied: User user_1 does not have access to workspace ws_beta/,
    );
  });

  it('should throw UnauthorizedException when request lacks user authentication context', async () => {
    const mockRequest: any = {
      params: { workspaceId: 'ws_alpha' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });
});
