import { Injectable, Logger } from "@nestjs/common";
import {
  EvidenceSearchService,
  EvidenceSearchOptions,
} from "./evidence-search.service";
import { GraphProjectionService } from "../graph/graph-projection.service";
import { Neo4jService } from "../graph/neo4j.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  EvidenceSearchResponse,
  EvidenceSearchResultItem,
} from "@traceback/shared-types";

@Injectable()
export class GraphRetrieverService {
  private readonly logger = new Logger(GraphRetrieverService.name);

  constructor(
    private readonly searchService: EvidenceSearchService,
    private readonly graphProjection: GraphProjectionService,
    private readonly neo4j: Neo4jService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Performs hybrid retrieval: PostgreSQL lexical baseline search + bounded graph-neighbour expansion.
   * Enforces repository authorization and falls back gracefully when Neo4j is unavailable.
   */
  async retrieve(
    options: EvidenceSearchOptions,
  ): Promise<EvidenceSearchResponse> {
    const startTime = Date.now();

    // 1. Step 1: Baseline PostgreSQL lexical search
    const baseline = await this.searchService.search(options);

    // If caller explicitly requested to exclude graph or if graph is unavailable, return baseline
    const graphRequested = options.includeGraph !== false;
    const isGraphAvailable = this.neo4j.isAvailable();

    if (!graphRequested || !isGraphAvailable || baseline.items.length === 0) {
      return {
        ...baseline,
        graphAvailable: isGraphAvailable,
        executionTimeMs: Date.now() - startTime,
        fallbackNotice:
          !isGraphAvailable && graphRequested
            ? "Neo4j graph database unavailable; operating in PostgreSQL lexical baseline mode"
            : undefined,
      };
    }

    try {
      // 2. Step 2: Select top seed candidates for graph expansion (max top 3)
      const topSeeds = baseline.items.slice(0, 3);
      const seedExternalIds = topSeeds.map((item) => item.source.externalId);

      // 3. Step 3: Expand neighbours in Neo4j (depth 1..2, max 10 neighbours)
      const neighbours = await this.graphProjection.findConnectedNeighbours(
        options.repositoryId,
        seedExternalIds,
        2,
        10,
      );

      if (neighbours.length === 0) {
        return {
          ...baseline,
          graphAvailable: true,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 4. Step 4: Resolve authoritative SourceRecords from PostgreSQL for neighbours
      const existingIds = new Set(baseline.items.map((i) => i.source.id));
      const existingExternalIds = new Set(
        baseline.items.map((i) => i.source.externalId),
      );

      const neighbourExternalIds = neighbours
        .map((n) => n.referenceKey.replace(/^#/, ""))
        .filter((id) => !existingExternalIds.has(id));

      const resolvedRecords = await this.prisma.sourceRecord.findMany({
        where: {
          repositoryId: options.repositoryId,
          OR: [
            { externalId: { in: neighbourExternalIds } },
            { referenceKey: { in: neighbours.map((n) => n.referenceKey) } },
          ],
        },
      });

      // 5. Step 5: Merge, score, and annotate graph expansion candidates
      const combinedItems: EvidenceSearchResultItem[] = [...baseline.items];

      for (const neighbour of neighbours) {
        const matchingRecord = resolvedRecords.find(
          (r) =>
            r.referenceKey === neighbour.referenceKey ||
            r.externalId === neighbour.referenceKey.replace(/^#/, ""),
        );

        if (!matchingRecord || existingIds.has(matchingRecord.id)) {
          // If already in baseline, upgrade retrievalMethod to "hybrid"
          const existingItem = combinedItems.find(
            (i) => matchingRecord && i.source.id === matchingRecord.id,
          );
          if (existingItem) {
            existingItem.retrievalMethod = "hybrid";
            existingItem.score =
              Math.round((existingItem.score + 1.5) * 100) / 100;
            existingItem.matchReasons.push(
              `Also connected via graph (${neighbour.relationship}, depth ${neighbour.depth}) from seed ${neighbour.seedSourceId}`,
            );
            existingItem.graphProximity = {
              seedSourceId: neighbour.seedSourceId,
              relationship: neighbour.relationship,
              depth: neighbour.depth,
            };
          }
          continue;
        }

        // Calculate decayed score based on depth
        const seedItem = topSeeds.find(
          (s) => s.source.externalId === neighbour.seedSourceId,
        );
        const baseScore = seedItem ? seedItem.score : 2.0;
        const decayFactor = 1 / (1 + neighbour.depth);
        const graphScore =
          Math.round(baseScore * decayFactor * 0.7 * 100) / 100;

        existingIds.add(matchingRecord.id);
        combinedItems.push({
          source: this.searchService.mapToDto(matchingRecord),
          score: graphScore,
          retrievalMethod: "graph_expansion",
          matchReasons: [
            `Graph expansion from seed ${neighbour.seedSourceId} via ${neighbour.relationship} (depth ${neighbour.depth})`,
          ],
          graphProximity: {
            seedSourceId: neighbour.seedSourceId,
            relationship: neighbour.relationship,
            depth: neighbour.depth,
          },
        });
      }

      // 6. Sort combined results by descending score
      combinedItems.sort((a, b) => b.score - a.score);

      const limit = options.limit || 10;
      const offset = options.offset || 0;

      return {
        query: baseline.query,
        totalCount: combinedItems.length,
        items: combinedItems.slice(offset, offset + limit),
        graphAvailable: true,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      this.logger.warn(
        `Graph retrieval expansion failed; falling back to baseline results: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        ...baseline,
        graphAvailable: false,
        executionTimeMs: Date.now() - startTime,
        fallbackNotice: `Graph expansion error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
