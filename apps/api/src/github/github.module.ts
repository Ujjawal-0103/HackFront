import { Module } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { MockGitHubClient } from "./mock-github.client";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Module({
  imports: [WorkspacesModule],
  controllers: [GitHubController],
  providers: [GitHubService, MockGitHubClient],
  exports: [GitHubService],
})
export class GitHubModule {}
