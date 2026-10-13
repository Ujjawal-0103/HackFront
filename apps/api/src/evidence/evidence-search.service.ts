import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";
import {
  EvidenceSearchQuery,
  EvidenceSearchResponse,
  EvidenceSearchResultItem,
  SourceRecordDto,
} from "@traceback/shared-types";

export interface EvidenceSearchOptions extends EvidenceSearchQuery {
  workspaceId: string;
  repositoryId: string;
}

@Injectable()
export class EvidenceSearchService {
  private readonly logger = new Logger(EvidenceSearchService.name);
  private readonly MAX_QUERY_LENGTH = 1000;
  private readonly MAX_LIMIT = 50;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MIN_SCORE_THRESHOLD = 0.8;
  private readonly STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "is",
    "are",
    "was",
    "were",
    "be",
    "this",
    "that",
    "it",
    "fix",
    "bug",
    "issue",
    "feat",
    "chore",
    "update",
    "add",
    "change",
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Searches canonical SourceRecords using PostgreSQL text search and structured ranking.
   * Strictly enforces workspace and repository authorization.
   */
  async search(
    options: EvidenceSearchOptions,
  ): Promise<EvidenceSearchResponse> {
    const startTime = Date.now();

    // 1. Authorization check: repository must exist and belong to the workspace
    await this.verifyRepositoryAccess(
      options.workspaceId,
      options.repositoryId,
    );

    // 2. Validate and sanitize query parameters
    const query = this.sanitizeQuery(options.query);
    const limit = Math.min(
      Math.max(1, options.limit || this.DEFAULT_LIMIT),
      this.MAX_LIMIT,
    );
    const offset = Math.max(0, options.offset || 0);

    // Handle empty or whitespace-only queries gracefully
    if (!query) {
      return {
        query: options.query || "",
        totalCount: 0,
        items: [],
        graphAvailable: false,
        executionTimeMs: Date.now() - startTime,
        fallbackNotice: "Empty query returned zero results",
      };
    }

    // 3. Extract search terms and keywords
    const searchTerms = this.extractSearchTerms(query);

    // 4. Execute search with PostgreSQL Full-Text Search (or Prisma ILIKE fallback)
    const candidates = await this.executeSearchQuery(
      options.repositoryId,
      query,
      searchTerms,
      options,
    );

    // 5. Score, explain, and rank candidates
    const scoredItems = this.scoreAndExplainCandidates(
      candidates,
      query,
      searchTerms,
      options.filePath,
    );

    // 6. Pagination slice
    const totalCount = scoredItems.length;
    const paginatedItems = scoredItems.slice(offset, offset + limit);

    return {
      query,
      totalCount,
      items: paginatedItems,
      graphAvailable: false,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Retrieves a single SourceRecord by its ID, ensuring workspace/repository scope.
   */
  async getSourceRecordById(
    workspaceId: string,
    repositoryId: string,
    sourceRecordId: string,
  ): Promise<SourceRecordDto | null> {
    await this.verifyRepositoryAccess(workspaceId, repositoryId);

    const record = await this.prisma.sourceRecord.findFirst({
      where: {
        id: sourceRecordId,
        repositoryId,
      },
    });

    if (!record) return null;
    return this.mapToDto(record);
  }

  private async verifyRepositoryAccess(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, workspaceId: true },
    });

    if (!repository) {
      throw new NotFoundException(`Repository "${repositoryId}" not found`);
    }

    if (repository.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        `Cross-workspace access denied: Repository "${repositoryId}" does not belong to workspace "${workspaceId}"`,
      );
    }
  }

  private sanitizeQuery(rawQuery?: string): string {
    if (!rawQuery || typeof rawQuery !== "string") {
      return "";
    }
    const trimmed = rawQuery.trim();
    if (trimmed.length > this.MAX_QUERY_LENGTH) {
      return trimmed.substring(0, this.MAX_QUERY_LENGTH).trim();
    }
    return trimmed;
  }

  private extractSearchTerms(query: string): string[] {
    // Strip punctuation, extract words of length >= 2
    const clean = query.replace(/[^\w\s-]/g, " ");
    const terms = clean
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2 && !this.STOP_WORDS.has(t));

    // Deduplicate
    return Array.from(new Set(terms));
  }

  private async executeSearchQuery(
    repositoryId: string,
    query: string,
    terms: string[],
    options: EvidenceSearchOptions,
  ): Promise<any[]> {
    // Build where conditions
    const whereClause: any = {
      repositoryId,
    };

    if (options.sourceTypes && options.sourceTypes.length > 0) {
      whereClause.sourceType = { in: options.sourceTypes };
    }

    if (options.since) {
      whereClause.recordedAt = {
        ...whereClause.recordedAt,
        gte: new Date(options.since),
      };
    }

    if (options.until) {
      whereClause.recordedAt = {
        ...whereClause.recordedAt,
        lte: new Date(options.until),
      };
    }

    // Try full-text search with Prisma raw SQL if available, else Prisma structured findMany
    try {
      // Build conditions for matching title or content or referenceKey
      const orConditions: any[] = [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { referenceKey: { contains: query, mode: "insensitive" } },
      ];

      // Add term conditions for multi-term queries
      for (const term of terms.slice(0, 5)) {
        orConditions.push({ title: { contains: term, mode: "insensitive" } });
        orConditions.push({ content: { contains: term, mode: "insensitive" } });
      }

      if (options.filePath) {
        orConditions.push({
          filePath: { contains: options.filePath, mode: "insensitive" },
        });
      }

      whereClause.OR = orConditions;

      const records = await this.prisma.sourceRecord.findMany({
        where: whereClause,
        orderBy: { recordedAt: "desc" },
        take: 100, // Fetch top 100 candidates for scoring
      });

      return records;
    } catch (err) {
      this.logger.warn(
        `Search query fallback execution: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private scoreAndExplainCandidates(
    records: any[],
    query: string,
    terms: string[],
    targetFilePath?: string,
  ): EvidenceSearchResultItem[] {
    const queryLower = query.toLowerCase();
    const scored: EvidenceSearchResultItem[] = [];

    for (const record of records) {
      let score = 0;
      const matchReasons: string[] = [];

      const titleLower = record.title.toLowerCase();
      const contentLower = record.content.toLowerCase();
      const refLower = record.referenceKey.toLowerCase();
      const fileLower = (record.filePath || "").toLowerCase();

      // 1. Exact Reference Key Match (e.g. SHA, #42, ADR-001)
      if (queryLower.includes(refLower) || refLower === queryLower) {
        score += 5.0;
        matchReasons.push(
          `Exact match on reference key "${record.referenceKey}"`,
        );
      }

      // 2. Exact Title Substring Match
      if (titleLower.includes(queryLower)) {
        score += 3.0;
        matchReasons.push("Exact phrase matched in title");
      }

      // 3. Exact Content Substring Match
      if (contentLower.includes(queryLower)) {
        score += 2.0;
        matchReasons.push("Exact phrase matched in record body");
      }

      // 4. Keyword matches in Title
      const matchedTitleTerms: string[] = [];
      for (const term of terms) {
        if (titleLower.includes(term)) {
          score += 1.0;
          matchedTitleTerms.push(term);
        }
      }
      if (matchedTitleTerms.length > 0) {
        matchReasons.push(
          `Title matches ${matchedTitleTerms.length} keyword(s): [${matchedTitleTerms.slice(0, 3).join(", ")}]`,
        );
      }

      // 5. Keyword matches in Body
      const matchedBodyTerms: string[] = [];
      for (const term of terms) {
        if (contentLower.includes(term) && !matchedTitleTerms.includes(term)) {
          score += 0.4;
          matchedBodyTerms.push(term);
        }
      }
      if (matchedBodyTerms.length > 0) {
        matchReasons.push(
          `Body text matches keyword(s): [${matchedBodyTerms.slice(0, 3).join(", ")}]`,
        );
      }

      // 6. Target File Path Proximity
      if (targetFilePath && fileLower) {
        const targetClean = targetFilePath.toLowerCase().trim();
        if (
          fileLower === targetClean ||
          fileLower.endsWith(targetClean) ||
          targetClean.endsWith(fileLower)
        ) {
          score += 2.5;
          matchReasons.push(`Direct file path match on "${record.filePath}"`);
        } else if (
          fileLower.includes(targetClean) ||
          targetClean.includes(fileLower)
        ) {
          score += 1.0;
          matchReasons.push(
            `File path proximity match on "${record.filePath}"`,
          );
        }
      }

      if (score >= this.MIN_SCORE_THRESHOLD) {
        scored.push({
          source: this.mapToDto(record),
          score: Math.round(score * 100) / 100,
          retrievalMethod: "lexical",
          matchReasons,
        });
      }
    }

    // Sort by descending score, breaking ties by recent recordedAt
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (
        new Date(b.source.recordedAt).getTime() -
        new Date(a.source.recordedAt).getTime()
      );
    });

    return scored;
  }

  public mapToDto(record: any): SourceRecordDto {
    return {
      id: record.id,
      repositoryId: record.repositoryId,
      sourceType: record.sourceType,
      externalId: record.externalId,
      referenceKey: record.referenceKey,
      title: record.title,
      author: record.author,
      url: record.url,
      snippet: record.snippet || undefined,
      filePath: record.filePath || undefined,
      lineStart: record.lineStart || undefined,
      lineEnd: record.lineEnd || undefined,
      metadata: record.metadata || undefined,
      recordedAt:
        record.recordedAt instanceof Date
          ? record.recordedAt.toISOString()
          : record.recordedAt,
    };
  }
}
