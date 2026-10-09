export interface GitHubAppConfig {
  appId?: string;
  clientId?: string;
  clientSecret?: string;
  privateKey?: string;
  webhookSecret?: string;
}

export interface GitHubRepositoryMetadata {
  id: number;
  fullName: string; // e.g. "org/repo"
  owner: string;
  repo: string;
  defaultBranch: string;
  isPrivate: boolean;
  permissions: {
    contents: 'read' | 'write' | 'none';
    issues: 'read' | 'write' | 'none';
    pullRequests: 'read' | 'write' | 'none';
  };
}

export interface RepositoryAccessPermission {
  authorized: boolean;
  fullName: string;
  readOnlyCompliant: boolean;
  reason?: string;
}
