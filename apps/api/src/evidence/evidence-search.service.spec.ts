import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EvidenceSearchService } from "./evidence-search.service";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";

describe("EvidenceSearchService", () => {
  let service: EvidenceSearchService;
  let prisma: any;

  const mockRepository = {
    id: "repo-123",
    workspaceId: "ws-456",
    fullName: "test-org/test-repo",
  };

  const mockRecords = [
    {
      id: "source-1",
      repositoryId: "repo-123",
      sourceType: EvidenceSourceType.COMMIT,
      externalId: "commit-sha-1234567890",
      referenceKey: "1234567",
      title: "fix: resolve memory leak in websocket reconnection buffer",
      author: "Jane Doe",
      url: "https://github.com/test-org/test-repo/commit/1234567",
      content:
        "Buffer allocation is capped to prevent memory leak during repeated socket reconnections.\nFile: src/socket.ts",
      snippet: "Buffer allocation is capped",
      filePath: "src/socket.ts",
      metadata: { sha: "1234567890" },
      recordedAt: new Date("2026-05-01T12:00:00Z"),
    },
    {
      id: "source-2",
      repositoryId: "repo-123",
      sourceType: EvidenceSourceType.PULL_REQUEST,
      externalId: "42",
      referenceKey: "#42",
      title: "Introduce camelCase config normalization",
      author: "John Smith",
      url: "https://github.com/test-org/test-repo/pull/42",
      content:
        "Normalizes snake_case options to camelCase. Deprecated in v2.0 as per ADR-002.\n[Comment]: LGTM",
      snippet: "Normalizes snake_case options",
      filePath: "src/config.ts",
      metadata: { number: 42 },
      recordedAt: new Date("2026-06-01T12:00:00Z"),
    },
    {
      id: "source-3",
      repositoryId: "repo-123",
      sourceType: EvidenceSourceType.ADR,
      externalId: "docs/ADR-002.md",
      referenceKey: "ADR-002",
      title: "ADR-002: Configuration Normalization Migration",
      author: "Maintainers",
      url: "https://github.com/test-org/test-repo/blob/main/docs/ADR-002.md",
      content: "Decision: Migrate legacy config options to camelCase.",
      snippet: "Migrate legacy config options",
      filePath: "docs/ADR-002.md",
      metadata: { isAdr: true },
      recordedAt: new Date("2026-04-15T10:00:00Z"),
    },
  ];

  beforeEach(async () => {
    prisma = {
      repository: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "repo-123") return Promise.resolve(mockRepository);
          if (where.id === "foreign-repo") {
            return Promise.resolve({
              id: "foreign-repo",
              workspaceId: "other-workspace",
            });
          }
          return Promise.resolve(null);
        }),
      },
      sourceRecord: {
        findMany: jest.fn().mockResolvedValue(mockRecords),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const match = mockRecords.find(
            (r) => r.id === where.id && r.repositoryId === where.repositoryId,
          );
          return Promise.resolve(match || null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceSearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EvidenceSearchService>(EvidenceSearchService);
  });

  describe("Authorization Boundaries", () => {
    it("should throw NotFoundException if repository does not exist", async () => {
      await expect(
        service.search({
          workspaceId: "ws-456",
          repositoryId: "nonexistent-repo",
          query: "memory leak",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if repository belongs to another workspace", async () => {
      await expect(
        service.search({
          workspaceId: "ws-456",
          repositoryId: "foreign-repo",
          query: "memory leak",
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("Query Validation and Boundaries", () => {
    it("should return empty result safely when query is empty or whitespace", async () => {
      const result = await service.search({
        workspaceId: "ws-456",
        repositoryId: "repo-123",
        query: "   ",
      });

      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
      expect(prisma.sourceRecord.findMany).not.toHaveBeenCalled();
    });

    it("should truncate excessively long queries and proceed safely", async () => {
      const longQuery = "word ".repeat(300);
      const result = await service.search({
        workspaceId: "ws-456",
        repositoryId: "repo-123",
        query: longQuery,
      });

      expect(result.query.length).toBeLessThanOrEqual(1000);
      expect(prisma.sourceRecord.findMany).toHaveBeenCalled();
    });
  });

  describe("Lexical Search and Ranking Explanations", () => {
    it("should rank exact reference key matches highest with explanation", async () => {
      const result = await service.search({
        workspaceId: "ws-456",
        repositoryId: "repo-123",
        query: "#42 config",
      });

      expect(result.items.length).toBeGreaterThan(0);
      const topItem = result.items[0];
      expect(topItem.source.referenceKey).toBe("#42");
      expect(topItem.matchReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Exact match on reference key "#42"'),
        ]),
      );
      expect(topItem.score).toBeGreaterThan(5.0);
    });

    it("should apply target file path proximity boost", async () => {
      const result = await service.search({
        workspaceId: "ws-456",
        repositoryId: "repo-123",
        query: "normalization",
        filePath: "src/config.ts",
      });

      const configPr = result.items.find(
        (item) => item.source.filePath === "src/config.ts",
      );
      expect(configPr).toBeDefined();
      expect(configPr?.matchReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Direct file path match on "src/config.ts"'),
        ]),
      );
    });

    it("should expose canonical source identity, URL, and provenance on every result", async () => {
      const result = await service.search({
        workspaceId: "ws-456",
        repositoryId: "repo-123",
        query: "memory leak socket",
      });

      for (const item of result.items) {
        expect(item.source.id).toBeDefined();
        expect(item.source.url).toMatch(/^https:\/\/github\.com\//);
        expect(item.source.referenceKey).toBeDefined();
        expect(item.source.author).toBeDefined();
        expect(item.retrievalMethod).toBe("lexical");
        expect(item.matchReasons.length).toBeGreaterThan(0);
      }
    });

    it("should retrieve a single SourceRecord by ID within workspace scope", async () => {
      const record = await service.getSourceRecordById(
        "ws-456",
        "repo-123",
        "source-1",
      );

      expect(record).toBeDefined();
      expect(record?.id).toBe("source-1");
      expect(record?.title).toContain("memory leak");
    });
  });
});
