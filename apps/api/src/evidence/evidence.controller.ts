import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { GraphRetrieverService } from "./graph-retriever.service";
import {
  EvidenceProjectionService,
  ProjectionSummary,
} from "./evidence-projection.service";
import { EvidenceSearchService } from "./evidence-search.service";
import { EvidenceSearchDto } from "./evidence.dto";
import {
  EvidenceSearchResponse,
  SourceRecordDto,
} from "@traceback/shared-types";

@Controller("workspaces/:workspaceId/repositories/:repositoryId/evidence")
@UseGuards(AuthGuard, WorkspaceGuard)
export class EvidenceController {
  constructor(
    private readonly retriever: GraphRetrieverService,
    private readonly searchService: EvidenceSearchService,
    private readonly projectionService: EvidenceProjectionService,
  ) {}

  /**
   * Searches historical evidence using PostgreSQL full-text search and optional graph expansion.
   */
  @Post("search")
  @HttpCode(HttpStatus.OK)
  async search(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: EvidenceSearchDto,
  ): Promise<EvidenceSearchResponse> {
    return this.retriever.retrieve({
      workspaceId,
      repositoryId,
      query: dto.query,
      sourceTypes: dto.sourceTypes,
      filePath: dto.filePath,
      since: dto.since,
      until: dto.until,
      limit: dto.limit,
      offset: dto.offset,
      includeGraph: dto.includeGraph,
    });
  }

  /**
   * Projects ingested repository entities into canonical SourceRecords in PostgreSQL.
   */
  @Post("project")
  @HttpCode(HttpStatus.OK)
  async project(
    @Param("workspaceId") _workspaceId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<ProjectionSummary> {
    return this.projectionService.projectAll(repositoryId);
  }

  /**
   * Retrieves a single canonical source record by ID.
   */
  @Get(":sourceRecordId")
  async getSourceRecord(
    @Param("workspaceId") workspaceId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("sourceRecordId") sourceRecordId: string,
  ): Promise<SourceRecordDto> {
    const record = await this.searchService.getSourceRecordById(
      workspaceId,
      repositoryId,
      sourceRecordId,
    );

    if (!record) {
      throw new NotFoundException(
        `SourceRecord "${sourceRecordId}" not found in repository "${repositoryId}"`,
      );
    }

    return record;
  }
}
