import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { IGitHubClient } from "./github-client.interface";
import { GitHubAppAuthService } from "./github-app-auth.service";
import { GITHUB_BASE_URL_TOKEN } from "./github-adapter.interface";
import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";
import {
  GitHubNotFoundError,
  GitHubForbiddenError,
  GitHubValidationError,
} from "./github.errors";

@Injectable()
export class GitHubAppClient implements IGitHubClient {
  private readonly logger = new Logger(GitHubAppClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly authService: GitHubAppAuthService,
    @Optional() @Inject(GITHUB_BASE_URL_TOKEN) baseUrl?: string,
  ) {
    this.baseUrl = baseUrl || "https://api.github.com";
  }

  isConfigured(): boolean {
    return this.authService.isConfigured();
  }

  async getInstallationAccessToken(installationId: number): Promise<string> {
    return this.authService.getInstallationAccessToken(installationId);
  }

  async verifyRepositoryAccess(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<RepositoryAccessPermission> {
    try {
      const repository = await this.getRepository(installationId, owner, repo);
      // ADR-007 compliance check: read scopes must be satisfied
      const isReadOnly =
        repository.permissions.contents === "read" &&
        repository.permissions.issues === "read" &&
        repository.permissions.pullRequests === "read";

      return {
        authorized: true,
        fullName: repository.fullName,
        readOnlyCompliant: isReadOnly,
        reason: isReadOnly
          ? "Repository access verified with least-privilege read scopes"
          : "Repository access verified but permissions exceed read-only scopes",
      };
    } catch (err: any) {
      if (err instanceof GitHubNotFoundError) {
        return {
          authorized: false,
          fullName: `${owner}/${repo}`,
          readOnlyCompliant: false,
          reason: `Repository ${owner}/${repo} is not granted in GitHub App installation ${installationId}`,
        };
      }
      throw err;
    }
  }

  async listInstallationRepositories(
    installationId: number,
  ): Promise<GitHubRepositoryMetadata[]> {
    const token =
      await this.authService.getInstallationAccessToken(installationId);
    const response = await fetch(
      `${this.baseUrl}/installation/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Traceback-GitHub-App-Client/1.0",
        },
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new GitHubForbiddenError(
        `Failed to list installation repositories: ${err.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as { repositories: any[] };
    return (data.repositories || []).map((r) => this.mapRepoMetadata(r));
  }

  async getRepository(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata> {
    if (!owner || !repo) {
      throw new GitHubValidationError("Owner and repo parameters are required");
    }

    const token =
      await this.authService.getInstallationAccessToken(installationId);
    const response = await fetch(
      `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Traceback-GitHub-App-Client/1.0",
        },
      },
    );

    if (response.status === 404) {
      throw new GitHubNotFoundError(
        `Repository ${owner}/${repo} not found in installation ${installationId}`,
      );
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new GitHubForbiddenError(
        `Access to repository ${owner}/${repo} denied: ${err.message || response.statusText}`,
      );
    }

    const data = await response.json();
    return this.mapRepoMetadata(data);
  }

  async getInstallation(installationId: number): Promise<{
    id: number;
    accountLogin: string;
    accountType: string;
    permissions: Record<string, string>;
  }> {
    const jwt = this.authService.generateAppJwt();
    const response = await fetch(
      `${this.baseUrl}/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Traceback-GitHub-App-Client/1.0",
        },
      },
    );

    if (response.status === 404) {
      throw new GitHubNotFoundError(
        `GitHub App installation ${installationId} not found on GitHub`,
      );
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new GitHubForbiddenError(
        `Failed to verify installation ${installationId}: ${err.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      accountLogin: data.account?.login || "unknown",
      accountType: data.account?.type || "User",
      permissions: data.permissions || {},
    };
  }

  private mapRepoMetadata(data: any): GitHubRepositoryMetadata {
    const permissions = data.permissions || {};
    return {
      id: data.id,
      fullName: data.full_name || `${data.owner?.login}/${data.name}`,
      owner: data.owner?.login || "",
      repo: data.name || "",
      defaultBranch: data.default_branch || "main",
      isPrivate: Boolean(data.private),
      permissions: {
        contents: permissions.push
          ? "write"
          : permissions.pull
            ? "read"
            : "none",
        issues: permissions.push ? "write" : permissions.pull ? "read" : "none",
        pullRequests: permissions.push
          ? "write"
          : permissions.pull
            ? "read"
            : "none",
      },
    };
  }
}
