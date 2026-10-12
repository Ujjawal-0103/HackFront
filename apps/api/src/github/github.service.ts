import {
  Injectable,
  Logger,
  ForbiddenException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IGitHubClient } from "./github-client.interface";
import { MockGitHubClient } from "./mock-github.client";
import { GitHubAppClient } from "./github-app.client";
import { GitHubAppAuthService } from "./github-app-auth.service";
import { GitHubAuthError } from "./github.errors";
import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private client: IGitHubClient;
  private isLiveConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private authService?: GitHubAppAuthService,
  ) {
    const appId = this.configService.get<string>("GITHUB_APP_ID");
    const privateKey = this.configService.get<string>("GITHUB_APP_PRIVATE_KEY");

    if (appId && privateKey) {
      this.isLiveConfigured = true;
      if (!this.authService) {
        this.authService = new GitHubAppAuthService(this.configService);
      }
      const baseUrl =
        this.configService.get<string>("GITHUB_API_BASE_URL") ||
        this.configService.get<string>("github.baseUrl") ||
        "https://api.github.com";
      this.client = new GitHubAppClient(this.authService, baseUrl);
      this.logger.log("GitHub App configuration detected and loaded");
    } else {
      this.isLiveConfigured = false;
      this.client = new MockGitHubClient();
      this.logger.log(
        "GitHub App running in development mock sandbox (live credentials unconfigured)",
      );
    }
  }

  isConfigured(): boolean {
    return this.isLiveConfigured;
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
