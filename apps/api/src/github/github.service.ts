import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { IGitHubClient } from "./github-client.interface";
import { MockGitHubClient } from "./mock-github.client";
import { GitHubAppClient } from "./github-app.client";
import { GitHubAppAuthService } from "./github-app-auth.service";
import { GitHubAuthError } from "./github.errors";
import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";
import { GitHubIntegrationStatusDto } from "@traceback/shared-types";

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private client: IGitHubClient;
  private isLiveConfigured = false;
  private isMockMode = false;
  private readonly appSlug?: string;
  private readonly hmacSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private authService?: GitHubAppAuthService,
  ) {
    const appId =
      this.configService.get<string>("GITHUB_APP_ID") ||
      this.configService.get<string>("github.appId");
    const privateKey =
      this.configService.get<string>("GITHUB_APP_PRIVATE_KEY") ||
      this.configService.get<string>("github.privateKey");

    const rawSecret =
      this.configService.get<string>("GITHUB_WEBHOOK_SECRET") ||
      this.configService.get<string>("app.githubWebhookSecret") ||
      "traceback_github_connect_state_secret";
    this.hmacSecret = String(rawSecret);

    const nodeEnv =
      this.configService.get<string>("app.nodeEnv") ||
      process.env.NODE_ENV ||
      "development";
    const isProduction = nodeEnv === "production";

    if (!this.authService) {
      this.authService = new GitHubAppAuthService(this.configService);
    }

    const isLiveReady = Boolean(appId && this.authService.isConfigured());

    this.appSlug =
      this.configService.get<string>("GITHUB_APP_SLUG") ||
      this.configService.get<string>("github.appSlug") ||
      (isLiveReady ? "traceback-code-verification" : undefined);

    if (isLiveReady) {
      this.isLiveConfigured = true;
      this.isMockMode = false;
      const baseUrl =
        this.configService.get<string>("GITHUB_API_BASE_URL") ||
        this.configService.get<string>("github.baseUrl") ||
        "https://api.github.com";
      this.client = new GitHubAppClient(this.authService, baseUrl);
      this.logger.log("GitHub App live configuration detected and loaded");
    } else if (isProduction) {
      this.isLiveConfigured = false;
      this.isMockMode = false;
      this.logger.warn(
        "GitHub App credentials are unconfigured in production. Mock sandbox fallback is disabled in production.",
      );
      this.client = {
        isConfigured: () => false,
        verifyRepositoryAccess: async () => {
          throw new ForbiddenException(
            "GitHub App is unconfigured in production environment.",
          );
        },
        listInstallationRepositories: async () => {
          throw new ForbiddenException(
            "GitHub App is unconfigured in production environment.",
          );
        },
        getRepository: async () => {
          throw new ForbiddenException(
            "GitHub App is unconfigured in production environment.",
          );
        },
      };
    } else {
      this.isLiveConfigured = false;
      this.isMockMode = true;
      this.client = new MockGitHubClient();
      this.logger.log(
        "GitHub App running in development mock sandbox mode (live credentials unconfigured)",
      );
    }
  }

  isConfigured(): boolean {
    return this.isLiveConfigured;
  }

  isMock(): boolean {
    return this.isMockMode;
  }

  getAppSlug(): string | undefined {
    return this.appSlug;
  }

  /**
   * Generates a tamper-resistant signed state token bound to workspace and user.
   * Valid for 15 minutes.
   */
  createConnectState(workspaceId: string, userId: string): string {
    const timestamp = Date.now();
    const payload = `${workspaceId}:${userId}:${timestamp}`;
    const hmac = crypto
      .createHmac("sha256", this.hmacSecret)
      .update(payload)
      .digest("hex");
    return Buffer.from(`${payload}:${hmac}`).toString("base64url");
  }

  /**
   * Validates state token signature and expiration.
   */
  verifyConnectState(
    state: string,
    expectedWorkspaceId: string,
  ): { workspaceId: string; userId: string } {
    try {
      const decoded = Buffer.from(state, "base64url").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length !== 4) {
        throw new BadRequestException("Malformed GitHub App connect state");
      }
      const [workspaceId, userId, timestampStr, hmac] = parts;
      const payload = `${workspaceId}:${userId}:${timestampStr}`;
      const expectedHmac = crypto
        .createHmac("sha256", this.hmacSecret)
        .update(payload)
        .digest("hex");

      const hmacBuf = Buffer.from(hmac, "hex");
      const expectedBuf = Buffer.from(expectedHmac, "hex");
      if (
        hmacBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(hmacBuf, expectedBuf)
      ) {
        throw new BadRequestException(
          "Invalid GitHub App connect state signature",
        );
      }

      const timestamp = parseInt(timestampStr, 10);
      const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
      if (Date.now() - timestamp > MAX_AGE_MS) {
        throw new BadRequestException("GitHub App connect state has expired");
      }

      if (workspaceId !== expectedWorkspaceId) {
        throw new BadRequestException(
          "Connect state workspace mismatch: state was generated for another workspace",
        );
      }

      return { workspaceId, userId };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException("Failed to decode or verify connect state");
    }
  }

  /**
   * Verifies an installation ID with GitHub (or mock client) and returns account metadata.
   */
  async getInstallationDetails(installationId: number): Promise<{
    id: number;
    accountLogin: string;
    accountType: string;
    permissions: Record<string, string>;
  }> {
    if (this.client.getInstallation) {
      return this.client.getInstallation(installationId);
    }
    // Fallback if client lacks getInstallation method
    return {
      id: installationId,
      accountLogin: "unknown",
      accountType: "User",
      permissions: {
        contents: "read",
        issues: "read",
        pullRequests: "read",
      },
    };
  }

  /**
   * Returns a complete integration status representation for a workspace.
   */
  getStatus(
    workspaceId: string,
    userId: string,
    installationSummary: any | null,
  ): GitHubIntegrationStatusDto {
    const installUrl = this.appSlug
      ? `https://github.com/apps/${this.appSlug}/installations/new?state=${this.createConnectState(workspaceId, userId)}`
      : undefined;

    return {
      isConfigured: this.isLiveConfigured,
      isMockMode: this.isMockMode,
      appSlug: this.appSlug,
      installation: installationSummary,
      installUrl,
    };
  }

  async getInstallationAccessToken(installationId: number): Promise<string> {
    if (this.authService && this.isLiveConfigured) {
      return this.authService.getInstallationAccessToken(installationId);
    }
    if (this.client.getInstallationAccessToken) {
      return this.client.getInstallationAccessToken(installationId);
    }
    throw new GitHubAuthError(
      "GitHub client does not support installation access token generation",
    );
  }

  async verifyRepositoryAccess(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<RepositoryAccessPermission> {
    const access = await this.client.verifyRepositoryAccess(
      installationId,
      owner,
      repo,
    );

    if (!access.authorized) {
      throw new ForbiddenException(
        access.reason ||
          `Repository ${owner}/${repo} is not accessible in installation ${installationId}`,
      );
    }

    return access;
  }

  async getRepository(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata> {
    return this.client.getRepository(installationId, owner, repo);
  }

  async listAuthorizedRepositories(
    installationId: number,
  ): Promise<GitHubRepositoryMetadata[]> {
    return this.client.listInstallationRepositories(installationId);
  }

  // Exposed for testing
  setClient(customClient: IGitHubClient) {
    this.client = customClient;
  }

  getAuthService(): GitHubAppAuthService | undefined {
    return this.authService;
  }
}
