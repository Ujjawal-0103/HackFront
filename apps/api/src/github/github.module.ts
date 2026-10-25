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

import { DelegatingGitHubIngestionAdapter } from "./delegating-github-ingestion.adapter";

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
    DelegatingGitHubIngestionAdapter,
    {
      provide: GITHUB_INGESTION_ADAPTER_TOKEN,
      useClass: DelegatingGitHubIngestionAdapter,
    },
  ],
  exports: [
    GitHubAppAuthService,
    GitHubAppClient,
    GitHubService,
    GitHubIngestionAdapter,
    MockGitHubIngestionAdapter,
    DelegatingGitHubIngestionAdapter,
    GITHUB_INGESTION_ADAPTER_TOKEN,
  ],
})
export class GitHubModule {}
