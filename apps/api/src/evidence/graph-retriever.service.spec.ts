import { Test, TestingModule } from "@nestjs/testing";
import { GraphRetrieverService } from "./graph-retriever.service";
import { EvidenceSearchService } from "./evidence-search.service";
import { GraphProjectionService } from "../graph/graph-projection.service";
import { Neo4jService } from "../graph/neo4j.service";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";

describe("GraphRetrieverService", () => {
  let service: GraphRetrieverService;
  let searchService: any;
  let graphProjection: any;
  let neo4j: any;
  let prisma: any;

  const mockBaselineItem = {
    source: {
      id: "src-1",
      repositoryId: "repo-1",
      sourceType: EvidenceSourceType.COMMIT,
      externalId: "commit-sha-1",
      referenceKey: "commit-sha-1",
      title: "fix: socket memory leak",
      author: "Alice",
      url: "https://github.com/org/repo/commit/1",
      recordedAt: new Date().toISOString(),
    },
    score: 4.0,
    retrievalMethod: "lexical" as const,
    matchReasons: ["Exact phrase matched"],
  };

  const mockNeighbourRecord = {
    id: "src-2",
    repositoryId: "repo-1",
    sourceType: EvidenceSourceType.PULL_REQUEST,
    externalId: "42",
    referenceKey: "#42",
    title: "PR #42: Socket improvements",
    author: "Bob",
    url: "https://github.com/org/repo/pull/42",
    content: "PR discussion body",
    snippet: "PR snippet",
    filePath: "src/socket.ts",
    recordedAt: new Date(),
  };

  beforeEach(async () => {
    searchService = {
      search: jest.fn().mockResolvedValue({
        query: "socket leak",
        totalCount: 1,
        items: [mockBaselineItem],
        graphAvailable: false,
        executionTimeMs: 10,
      }),
      mapToDto: jest.fn().mockImplementation((r) => ({
        id: r.id,
        repositoryId: r.repositoryId,
        sourceType: r.sourceType,
        externalId: r.externalId,
        referenceKey: r.referenceKey,
        title: r.title,
        author: r.author,
        url: r.url,
        recordedAt:
          r.recordedAt instanceof Date
            ? r.recordedAt.toISOString()
            : r.recordedAt,
      })),
    };

    graphProjection = {
      findConnectedNeighbours: jest.fn().mockResolvedValue([
        {
          sourceId: "pr-42",
          sourceType: "PullRequest",
          referenceKey: "#42",
          relationship: "MODIFIES_FILE",
          depth: 1,
          seedSourceId: "commit-sha-1",
        },
      ]),
    };

    neo4j = {
      isAvailable: jest.fn().mockReturnValue(true),
    };

    prisma = {
      sourceRecord: {
        findMany: jest.fn().mockResolvedValue([mockNeighbourRecord]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphRetrieverService,
        { provide: EvidenceSearchService, useValue: searchService },
        { provide: GraphProjectionService, useValue: graphProjection },
        { provide: Neo4jService, useValue: neo4j },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GraphRetrieverService>(GraphRetrieverService);
  });

  it("should return baseline results with notice when Neo4j is offline", async () => {
    neo4j.isAvailable.mockReturnValue(false);

    const result = await service.retrieve({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      query: "socket leak",
    });

    expect(result.graphAvailable).toBe(false);
    expect(result.fallbackNotice).toContain("Neo4j graph database unavailable");
    expect(result.items.length).toBe(1);
    expect(graphProjection.findConnectedNeighbours).not.toHaveBeenCalled();
  });

  it("should return baseline results when includeGraph is explicitly false", async () => {
    const result = await service.retrieve({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      query: "socket leak",
      includeGraph: false,
    });

    expect(graphProjection.findConnectedNeighbours).not.toHaveBeenCalled();
    expect(result.items.length).toBe(1);
  });

  it("should perform graph expansion and merge discovered neighbours with provenance", async () => {
    const result = await service.retrieve({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      query: "socket leak",
      includeGraph: true,
    });

    expect(result.graphAvailable).toBe(true);
    expect(result.items.length).toBe(2);

    const graphItem = result.items.find(
      (i) => i.retrievalMethod === "graph_expansion",
    );
    expect(graphItem).toBeDefined();
    expect(graphItem?.source.referenceKey).toBe("#42");
    expect(graphItem?.graphProximity?.relationship).toBe("MODIFIES_FILE");
    expect(graphItem?.matchReasons[0]).toContain("Graph expansion from seed");
  });

  it("should upgrade an existing baseline result to hybrid if also discovered via graph", async () => {
    // Return the same source-1 as neighbour
    graphProjection.findConnectedNeighbours.mockResolvedValue([
      {
        sourceId: "commit-1",
        sourceType: "Commit",
        referenceKey: "commit-sha-1",
        relationship: "CONTAINS_COMMIT",
        depth: 1,
        seedSourceId: "commit-sha-1",
      },
    ]);
    prisma.sourceRecord.findMany.mockResolvedValue([
      {
        ...mockNeighbourRecord,
        id: "src-1",
        externalId: "commit-sha-1",
        referenceKey: "commit-sha-1",
      },
    ]);

    const result = await service.retrieve({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      query: "socket leak",
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].retrievalMethod).toBe("hybrid");
    expect(result.items[0].matchReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Also connected via graph"),
      ]),
    );
  });

  it("should fall back gracefully to baseline if graph expansion throws", async () => {
    graphProjection.findConnectedNeighbours.mockRejectedValue(
      new Error("Simulated Neo4j socket timeout"),
    );

    const result = await service.retrieve({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      query: "socket leak",
    });

    expect(result.graphAvailable).toBe(false);
    expect(result.fallbackNotice).toContain("Graph expansion error");
    expect(result.items.length).toBe(1);
  });
});
