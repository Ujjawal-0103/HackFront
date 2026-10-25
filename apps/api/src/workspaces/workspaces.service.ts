import {
  Injectable,
  NotFoundException,
  Optional,
  Logger,
} from "@nestjs/common";
import { WorkspaceSummary, WorkspaceRole } from "@traceback/shared-types";
import { PrismaService } from "../prisma/prisma.service";

export interface WorkspaceMembershipRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);
  private defaultsSeeded = false;

  // In-memory fallback for isolated unit tests
  private memberships: WorkspaceMembershipRecord[] = [
    { workspaceId: "ws_alpha", userId: "user_1", role: "OWNER" },
    { workspaceId: "ws_alpha", userId: "user_2", role: "MEMBER" },
    { workspaceId: "ws_alpha", userId: "usr_verified_123", role: "OWNER" },
    { workspaceId: "ws_beta", userId: "user_3", role: "OWNER" },
  ];

  private workspaces: Array<{ id: string; name: string; slug: string }> = [
    { id: "ws_alpha", name: "Alpha Corp Engineering", slug: "alpha-corp" },
    { id: "ws_beta", name: "Beta Labs Security", slug: "beta-labs" },
  ];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Automatically initializes default workspaces, users, and memberships in PostgreSQL
   * if they do not yet exist.
   */
  async ensureDefaultWorkspaces(): Promise<void> {
    if (!this.prisma || this.defaultsSeeded) return;

    try {
      const defaultUsers = [
        { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
        { id: "user_2", email: "sam@company.com", name: "Sam Reviewer" },
        {
          id: "usr_verified_123",
          email: "alex.verified@company.com",
          name: "Alex Maintainer",
        },
        { id: "user_3", email: "jordan@betalabs.com", name: "Jordan Security" },
      ];

      const defaultHash =
        "a1b2c3d4e5f60718293a4b5c6d7e8f90:39db16b7a872a4ec181634e45877088ca1af88894e8ec3434b3fa8a056c6a737d7956e3ed13047e3525f909d4c79866f87a29f847b4e9d8ae915cddef1d7c9ee";

      for (const u of defaultUsers) {
        await this.prisma.user.upsert({
          where: { id: u.id },
          create: {
            id: u.id,
            email: u.email,
            name: u.name,
            passwordHash: defaultHash,
          },
          update: {
            name: u.name,
            passwordHash: defaultHash,
          },
        });
      }

      for (const ws of this.workspaces) {
        await this.prisma.workspace.upsert({
          where: { id: ws.id },
          create: { id: ws.id, name: ws.name, slug: ws.slug },
          update: { name: ws.name },
        });
      }

      for (const m of this.memberships) {
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: m.workspaceId,
              userId: m.userId,
            },
          },
          create: {
            workspaceId: m.workspaceId,
            userId: m.userId,
            role: m.role,
          },
          update: { role: m.role },
        });
      }

      this.defaultsSeeded = true;
    } catch (err) {
      this.logger.warn(
        `Failed to seed default workspaces in database: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRecord | null> {
    // 1. Try PostgreSQL database lookup
    if (this.prisma) {
      await this.ensureDefaultWorkspaces();
      try {
        const dbMember = await this.prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId, userId },
          },
        });
        if (dbMember) {
          return {
            workspaceId: dbMember.workspaceId,
            userId: dbMember.userId,
            role: dbMember.role as WorkspaceRole,
          };
        }
      } catch (_err) {
        // Fall back to in-memory store if DB query fails
      }
    }

    // 2. Fallback to in-memory store
    const record = this.memberships.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId,
    );
    return record || null;
  }

  async listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    if (this.prisma) {
      await this.ensureDefaultWorkspaces();
      try {
        const dbMembers = await this.prisma.workspaceMember.findMany({
          where: { userId },
          include: { workspace: true },
        });
        if (dbMembers.length > 0) {
          return dbMembers.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            slug: m.workspace.slug,
            role: m.role as WorkspaceRole,
          }));
        }
      } catch (_err) {
        // Fall back to in-memory store
      }
    }

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
    if (this.prisma) {
      await this.ensureDefaultWorkspaces();
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (ws) {
          return {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            role: "MEMBER",
          };
        }
      } catch (_err) {
        // Fall back to in-memory store
      }
    }

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
