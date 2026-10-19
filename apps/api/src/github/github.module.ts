import { Module } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { MockGitHubClient } from "./mock-github.client";
import { GitHubAppAuthService } from "./github-app-auth.service";
import { GitHubAppClient } from "./github-app.client";
import { GitHubIngestionAdapter } from "./github-ingestion.adapter";
import { MockGitHubIngestionAdapter } from "./mock-github-ingestion.adapter";
import { GITHUB_INGESTION_ADAPTER_TOKEN } from "./github-adapter.interface";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [WorkspacesModule],
  controllers: [GitHubController],
  providers: [
    GitHubAppAuthService,
    GitHubAppClient,
    GitHubService,
    MockGitHubClient,
    GitHubIngestionAdapter,
    MockGitHubIngestionAdapter,
    {
      provide: GITHUB_INGESTION_ADAPTER_TOKEN,
      useFactory: (
        gitHubService: GitHubService,
        liveAdapter: GitHubIngestionAdapter,
        mockAdapter: MockGitHubIngestionAdapter,
      ) => {
        return gitHubService.isConfigured() ? liveAdapter : mockAdapter;
      },
      inject: [
        GitHubService,
        GitHubIngestionAdapter,
        MockGitHubIngestionAdapter,
      ],
    },
  ],
  exports: [
    GitHubAppAuthService,
    GitHubAppClient,
    GitHubService,
    GitHubIngestionAdapter,
    MockGitHubIngestionAdapter,
    GITHUB_INGESTION_ADAPTER_TOKEN,
  ],
})
export class GitHubModule {}
