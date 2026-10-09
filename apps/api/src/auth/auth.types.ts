import { WorkspaceRole } from '@traceback/shared-types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedWorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
}
