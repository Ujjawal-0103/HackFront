import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { GitHubModule } from "../github/github.module";
import { RepositoriesController } from "./repositories.controller";
import { RepositoriesService } from "./repositories.service";

@Module({
  imports: [PrismaModule, WorkspacesModule, GitHubModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
