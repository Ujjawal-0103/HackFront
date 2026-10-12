import { Injectable } from "@nestjs/common";
import { IGitHubClient } from "./github-client.interface";
import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";

@Injectable()
export class MockGitHubClient implements IGitHubClient {
  private authorizedRepos: Map<number, GitHubRepositoryMetadata[]> = new Map([
    [
      1001,
      [
        {
          id: 98765,
          fullName: "Ujjawal-0103/HackFront",
          owner: "Ujjawal-0103",
          repo: "HackFront",
          defaultBranch: "main",
          isPrivate: false,
          permissions: {
            contents: "read",
            issues: "read",
            pullRequests: "read",
          },
        },
        {
          id: 54321,
          fullName: "acme-corp/payment-service",
          owner: "acme-corp",
          repo: "payment-service",
          defaultBranch: "main",
          isPrivate: true,
          permissions: {
            contents: "read",
            issues: "read",
            pullRequests: "read",
          },
        },
      ],
    ],
  ]);

  isConfigured(): boolean {
    return true; // Mock client is operational
  }

  async getInstallationAccessToken(installationId: number): Promise<string> {
    return `mock-installation-token-${installationId}`;
  }

  async verifyRepositoryAccess(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<RepositoryAccessPermission> {
    const repos = this.authorizedRepos.get(installationId) || [];
    const targetFullName = `${owner}/${repo}`.toLowerCase();
    const matched = repos.find(
      (r) => r.fullName.toLowerCase() === targetFullName,
    );

    if (!matched) {
      return {
        authorized: false,
        fullName: `${owner}/${repo}`,
        readOnlyCompliant: false,
        reason: `Repository ${owner}/${repo} is not granted in GitHub App installation ${installationId}`,
      };
    }

    // Verify least-privilege read scopes compliance (ADR-007)
    const hasRead =
      matched.permissions.contents === "read" &&
      matched.permissions.issues === "read" &&
      matched.permissions.pullRequests === "read";

    return {
      authorized: true,
      fullName: matched.fullName,
      readOnlyCompliant: hasRead,
      reason: "Repository access verified with least-privilege read scopes",
    };
  }

  async listInstallationRepositories(
    installationId: number,
  ): Promise<GitHubRepositoryMetadata[]> {
    return this.authorizedRepos.get(installationId) || [];
  }

  async getRepository(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata> {
    const repos = this.authorizedRepos.get(installationId) || [];
    const target = repos.find(
      (r) =>
        r.owner.toLowerCase() === owner.toLowerCase() &&
        r.repo.toLowerCase() === repo.toLowerCase(),
    );
    if (!target) {
      throw new Error(
        `Repository ${owner}/${repo} not found in installation ${installationId}`,
      );
    }
    return target;
  }
}
