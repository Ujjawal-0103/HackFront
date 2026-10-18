import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AuthGuard, RequestWithUser } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { GitHubService } from "./github.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";
import {
  GitHubIntegrationStatusDto,
  GitHubInstallationSummaryDto,
  ConnectInstallationDto,
} from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/github")
@UseGuards(AuthGuard, WorkspaceGuard)
export class GitHubController {
  constructor(
    private readonly githubService: GitHubService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Retrieves GitHub integration and installation status for a workspace.
   */
  @Get("status")
  async getStatus(
    @Param("workspaceId") workspaceId: string,
    @Req() req: RequestWithUser,
  ): Promise<GitHubIntegrationStatusDto> {
    let installationSummary: GitHubInstallationSummaryDto | null = null;

    if (this.prisma) {
      const inst = await this.prisma.gitHubInstallation.findFirst({
        where: { workspaceId },
      });
      if (inst) {
        installationSummary = {
          id: inst.id,
          workspaceId: inst.workspaceId,
          installationId: inst.installationId,
          accountLogin: inst.accountLogin,
          accountType: inst.accountType,
          createdAt: inst.createdAt.toISOString(),
        };
      }
    }

    return this.githubService.getStatus(
      workspaceId,
      req.user?.id || "anonymous",
      installationSummary,
    );
  }

  /**
   * Generates a signed installation/setup URL with anti-tamper state token.
   */
  @Get("install-url")
  async getInstallUrl(
    @Param("workspaceId") workspaceId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ installUrl: string | null; state: string }> {
    const state = this.githubService.createConnectState(
      workspaceId,
      req.user?.id || "anonymous",
    );
    const appSlug = this.githubService.getAppSlug();
    const installUrl = appSlug
      ? `https://github.com/apps/${appSlug}/installations/new?state=${state}`
      : null;
    return { installUrl, state };
  }

  /**
   * Associates an authorized GitHub App installation with the workspace.
   * Requires OWNER or ADMIN workspace role.
   */
  @Post("installation")
  async connectInstallation(
    @Param("workspaceId") workspaceId: string,
    @Req() req: RequestWithUser,
    @Body() body: ConnectInstallationDto,
  ): Promise<GitHubInstallationSummaryDto> {
    const userRole = req.workspaceContext?.role;
    if (userRole && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException(
        "Only workspace OWNER or ADMIN members can connect a GitHub App installation",
      );
    }

    if (!body.installationId || isNaN(Number(body.installationId))) {
      throw new BadRequestException("Valid numeric installationId is required");
    }

    const installationId = Number(body.installationId);

    if (body.state) {
      this.githubService.verifyConnectState(body.state, workspaceId);
    }

    const details =
      await this.githubService.getInstallationDetails(installationId);

    if (this.prisma) {
      const record = await this.prisma.gitHubInstallation.upsert({
        where: { installationId },
        create: {
          workspaceId,
          installationId,
          accountLogin: details.accountLogin,
          accountType: details.accountType,
          permissions: details.permissions,
        },
        update: {
          workspaceId,
          accountLogin: details.accountLogin,
          accountType: details.accountType,
          permissions: details.permissions,
        },
      });

      return {
        id: record.id,
        workspaceId: record.workspaceId,
        installationId: record.installationId,
        accountLogin: record.accountLogin,
        accountType: record.accountType,
        createdAt: record.createdAt.toISOString(),
      };
    }

    return {
      id: `inst-${installationId}`,
      workspaceId,
      installationId,
      accountLogin: details.accountLogin,
      accountType: details.accountType,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Disconnects a GitHub App installation from the workspace.
   * Requires OWNER or ADMIN workspace role.
   */
  @Delete("installation")
  async disconnectInstallation(
    @Param("workspaceId") workspaceId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; message: string }> {
    const userRole = req.workspaceContext?.role;
    if (userRole && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException(
        "Only workspace OWNER or ADMIN members can disconnect a GitHub App installation",
      );
    }

    if (this.prisma) {
      await this.prisma.gitHubInstallation.deleteMany({
        where: { workspaceId },
      });
    }

    return {
      success: true,
      message: `GitHub App installation disconnected from workspace ${workspaceId}`,
    };
  }

  /**
   * Lists repositories authorized in the workspace's GitHub App installation.
   */
  @Get("repositories")
  async listRepositories(
    @Param("workspaceId") workspaceId: string,
    @Query("installationId") installationIdParam?: string,
  ): Promise<GitHubRepositoryMetadata[]> {
    let installationId: number | undefined = installationIdParam
      ? parseInt(installationIdParam, 10)
      : undefined;

    if (this.prisma && !installationId) {
      const inst = await this.prisma.gitHubInstallation.findFirst({
        where: { workspaceId },
      });
      if (inst) {
        installationId = inst.installationId;
      }
    }

    if (!installationId) {
      if (this.githubService.isMock()) {
        installationId = 1001;
      } else {
        throw new NotFoundException(
          `Workspace "${workspaceId}" has no active GitHub App installation. Please connect an installation first.`,
        );
      }
    }

    return this.githubService.listAuthorizedRepositories(installationId);
  }

  @Get("verify")
  async verifyRepository(
    @Param("workspaceId") workspaceId: string,
    @Query("owner") owner: string,
    @Query("repo") repo: string,
    @Query("installationId") installationIdParam?: string,
  ): Promise<RepositoryAccessPermission> {
    if (!owner || !repo) {
      throw new BadRequestException(
        'Both "owner" and "repo" query parameters are required',
      );
    }

    let installationId: number | undefined = installationIdParam
      ? parseInt(installationIdParam, 10)
      : undefined;

    if (this.prisma && !installationId) {
      const inst = await this.prisma.gitHubInstallation.findFirst({
        where: { workspaceId },
      });
      if (inst) {
        installationId = inst.installationId;
      }
    }

    if (!installationId) {
      if (this.githubService.isMock()) {
        installationId = 1001;
      } else {
        throw new NotFoundException(
          `Workspace "${workspaceId}" has no active GitHub App installation.`,
        );
      }
    }

    return this.githubService.verifyRepositoryAccess(
      installationId,
      owner,
      repo,
    );
  }
}
