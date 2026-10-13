import { Test, TestingModule } from "@nestjs/testing";
import { GraphProjectionService } from "./graph-projection.service";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "./neo4j.service";

describe("GraphProjectionService", () => {
  let service: GraphProjectionService;
  let prisma: any;
  let neo4j: any;

  const mockRepo = {
    id: "repo-1",
    fullName: "test-org/test-repo",
    commits: [
      {
        id: "commit-1",
        sha: "a1b2c3d",
        authorName: "Alice",
        committedAt: new Date("2026-01-01T00:00:00Z"),
        diffs: [
          {
            id: "diff-1",
            filePath: "src/auth.ts",
            status: "modified",
            additions: 10,
            deletions: 2,
          },
        ],
      },
    ],
    pullRequests: [
      {
        id: "pr-1",
        number: 42,
        title: "Fix auth issues (fixes #15)",
        body: "Addresses issue #15 cleanly",
        state: "closed",
        isMerged: true,
      },
    ],
    issues: [
      {
        id: "issue-1",
        number: 15,
        title: "Auth bug report",
        state: "closed",
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      repository: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "repo-1") return Promise.resolve(mockRepo);
          return Promise.resolve(null);
        }),
      },
    };

    neo4j = {
      isAvailable: jest.fn().mockReturnValue(true),
      runQuery: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphProjectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: Neo4jService, useValue: neo4j },
      ],
    }).compile();

    service = module.get<GraphProjectionService>(GraphProjectionService);
  });

  describe("Schema Initialization", () => {
    it("should execute constraint queries when Neo4j is available", async () => {
      await service.initializeSchema();
      expect(neo4j.runQuery).toHaveBeenCalled();
    });

    it("should skip schema initialization safely when Neo4j is offline", async () => {
      neo4j.isAvailable.mockReturnValue(false);
      await service.initializeSchema();
      expect(neo4j.runQuery).not.toHaveBeenCalled();
    });
  });

  describe("Repository Graph Synchronization", () => {
    it("should project commits, files, PRs, and issues into Neo4j", async () => {
      const result = await service.syncRepository("repo-1");
      expect(result.repositoryId).toBe("repo-1");
      expect(result.commitsMerged).toBe(1);
      expect(result.filesMerged).toBe(1);
      expect(result.pullRequestsMerged).toBe(1);
      expect(result.issuesMerged).toBe(1);
      expect(result.relationshipsMerged).toBeGreaterThan(0);
      expect(neo4j.runQuery).toHaveBeenCalledWith(
        expect.stringContaining("MERGE (r:Repository"),
        expect.anything(),
      );
    });

    it("should return zero counts gracefully when Neo4j is offline", async () => {
      neo4j.isAvailable.mockReturnValue(false);
      const result = await service.syncRepository("repo-1");
      expect(result.commitsMerged).toBe(0);
      expect(result.filesMerged).toBe(0);
      expect(neo4j.runQuery).not.toHaveBeenCalled();
    });
  });

  describe("Connected Neighbour Traversal", () => {
    it("should query Neo4j within bounded depth and return mapped neighbours", async () => {
      neo4j.runQuery.mockResolvedValue([
        {
          get: jest.fn().mockImplementation((key) => {
            const data: Record<string, any> = {
              targetId: "pr-1",
              targetType: "PullRequest",
              referenceKey: "#42",
              relationship: "MODIFIES_FILE",
              depth: 1,
              seedSourceId: "a1b2c3d",
            };
            return data[key];
          }),
        },
      ]);

      const neighbours = await service.findConnectedNeighbours(
        "repo-1",
        ["a1b2c3d"],
        2,
        5,
      );

      expect(neighbours.length).toBe(1);
      expect(neighbours[0].referenceKey).toBe("#42");
      expect(neighbours[0].relationship).toBe("MODIFIES_FILE");
      expect(neighbours[0].depth).toBe(1);
    });

    it("should return empty array when Neo4j is offline without throwing", async () => {
      neo4j.isAvailable.mockReturnValue(false);
      const neighbours = await service.findConnectedNeighbours("repo-1", [
        "a1b2c3d",
      ]);
      expect(neighbours).toEqual([]);
      expect(neo4j.runQuery).not.toHaveBeenCalled();
    });
  });
});
