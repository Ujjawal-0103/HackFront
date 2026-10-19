import {
  GitHubRepositoryMetadata,
  RepositoryAccessPermission,
} from "./github.types";

export const GITHUB_CLIENT_TOKEN = "IGitHubClient";

export interface IGitHubClient {
  isConfigured(): boolean;
  verifyRepositoryAccess(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<RepositoryAccessPermission>;
  listInstallationRepositories(
    installationId: number,
  ): Promise<GitHubRepositoryMetadata[]>;
  getRepository(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata>;
  getInstallation?(installationId: number): Promise<{
    id: number;
    accountLogin: string;
    accountType: string;
    permissions: Record<string, string>;
  }>;
  getInstallationAccessToken?(installationId: number): Promise<string>;
}
