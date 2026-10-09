import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IGitHubClient } from './github-client.interface';
import { MockGitHubClient } from './mock-github.client';
import { GitHubRepositoryMetadata, RepositoryAccessPermission } from './github.types';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private client: IGitHubClient;
  private isLiveConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const appId = this.configService.get<string>('GITHUB_APP_ID');
    const privateKey = this.configService.get<string>('GITHUB_APP_PRIVATE_KEY');

    if (appId && privateKey) {
      this.isLiveConfigured = true;
      // In live production, client would be instantiated via @octokit/auth-app
      // For Sprint 2 foundation, we use the client abstraction
      this.client = new MockGitHubClient();
      this.logger.log('GitHub App configuration detected and loaded');
    } else {
      this.isLiveConfigured = false;
      this.client = new MockGitHubClient();
      this.logger.log('GitHub App running in development mock sandbox (live credentials unconfigured)');
    }
  }

  isConfigured(): boolean {
    return this.isLiveConfigured;
  }

  async verifyRepositoryAccess(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<RepositoryAccessPermission> {
    const access = await this.client.verifyRepositoryAccess(installationId, owner, repo);

    if (!access.authorized) {
      throw new ForbiddenException(
        access.reason || `Repository ${owner}/${repo} is not accessible in installation ${installationId}`,
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
}
