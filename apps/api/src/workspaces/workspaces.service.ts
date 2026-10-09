import { Injectable, NotFoundException } from "@nestjs/common";
import { WorkspaceSummary, WorkspaceRole } from "@traceback/shared-types";

export interface WorkspaceMembershipRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

@Injectable()
export class WorkspacesService {
  // Foundational in-memory store for isolated tenant checks during Sprint 2 development
  private memberships: WorkspaceMembershipRecord[] = [
    { workspaceId: "ws_alpha", userId: "user_1", role: "OWNER" },
    { workspaceId: "ws_alpha", userId: "user_2", role: "MEMBER" },
    { workspaceId: "ws_beta", userId: "user_3", role: "OWNER" },
  ];

  private workspaces: Array<{ id: string; name: string; slug: string }> = [
    { id: "ws_alpha", name: "Alpha Corp Engineering", slug: "alpha-corp" },
    { id: "ws_beta", name: "Beta Labs Security", slug: "beta-labs" },
  ];

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRecord | null> {
    const record = this.memberships.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId,
    );
    return record || null;
  }

  async listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const userMemberships = this.memberships.filter((m) => m.userId === userId);
    return userMemberships.map((m) => {
      const ws = this.workspaces.find((w) => w.id === m.workspaceId);
      return {
        id: m.workspaceId,
        name: ws ? ws.name : "Unknown Workspace",
        slug: ws ? ws.slug : m.workspaceId,
        role: m.role,
      };
    });
  }

  async getWorkspaceDetails(workspaceId: string): Promise<WorkspaceSummary> {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role: "MEMBER",
    };
  }

  // Helper for test isolation
  registerMembership(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole = "MEMBER",
  ) {
    this.memberships.push({ workspaceId, userId, role });
  }
}
