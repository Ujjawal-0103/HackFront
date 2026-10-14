import { CitationValidatorService } from "./citation-validator.service";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";
import { EvidenceSearchResultItem } from "@traceback/shared-types";

describe("CitationValidatorService (Sprint 5 - Citation Verification)", () => {
  let validator: CitationValidatorService;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      sourceRecord: {
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (
            args.where.id === "real-src-id" ||
            args.where.externalId === "9a4f21d"
          ) {
            return Promise.resolve({
              id: "real-src-id",
              externalId: "9a4f21d",
              referenceKey: "9a4f21d",
            });
          }
          return Promise.resolve(null);
        }),
      } as any,
    };

    validator = new CitationValidatorService(mockPrisma as PrismaService);
  });

  it("should validate and confirm genuine citations (100% CVR)", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "real-src-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "9a4f21d",
          referenceKey: "9a4f21d",
          title: "refactor: config schema",
          author: "Alice",
          url: "https://github.com/owner/repo/commit/9a4f21d",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 3.5,
        retrievalMethod: "lexical",
        matchReasons: ["Exact match on reference key"],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates);

    expect(report.validityRate).toBe(1.0);
    expect(report.validCitationsCount).toBe(1);
    expect(report.invalidCitationsCount).toBe(0);
    expect(report.validatedEvidence[0].isValidCitation).toBe(true);
  });

  it("should reject citations with invalid or non-HTTP URLs", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "real-src-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "9a4f21d",
          referenceKey: "9a4f21d",
          title: "Bad URL commit",
          author: "Mallory",
          url: "javascript:alert(1)",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 2.0,
        retrievalMethod: "lexical",
        matchReasons: [],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates);

    expect(report.validCitationsCount).toBe(0);
    expect(report.invalidCitationsCount).toBe(1);
    expect(report.invalidCitations[0].reason).toContain(
      "Missing or non-HTTP URL",
    );
    expect(report.validityRate).toBe(0.0);
  });

  it("should reject citations with malformed commit SHAs", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "fake-sha-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "not-a-hex-sha",
          referenceKey: "not-a-hex-sha",
          title: "Malformed SHA",
          author: "Bob",
          url: "https://github.com/owner/repo/commit/xyz",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 1.5,
        retrievalMethod: "lexical",
        matchReasons: [],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates);

    expect(report.validCitationsCount).toBe(0);
    expect(report.invalidCitationsCount).toBe(1);
    expect(report.invalidCitations[0].reason).toContain(
      "Invalid commit SHA format",
    );
  });

  it("should reject citations that do not exist in the database (SEC-09)", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "fabricated-src-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "abcdef1234567890abcdef1234567890abcdef12",
          referenceKey: "abcdef1",
          title: "Fabricated Commit",
          author: "Ghost",
          url: "https://github.com/owner/repo/commit/abcdef1",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 2.0,
        retrievalMethod: "lexical",
        matchReasons: [],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates);

    expect(report.validCitationsCount).toBe(0);
    expect(report.invalidCitationsCount).toBe(1);
    expect(report.invalidCitations[0].reason).toContain(
      "does not exist in repository",
    );
  });

  it("should return 1.0 validity rate when candidate set is empty", async () => {
    const report = await validator.validateCitations("repo-1", []);
    expect(report.validityRate).toBe(1.0);
    expect(report.totalCitations).toBe(0);
  });

  it("should verify quotations that exist in cited source text (SEC-09)", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "real-src-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "9a4f21d",
          referenceKey: "9a4f21d",
          title: "refactor: config schema",
          author: "Alice",
          url: "https://github.com/owner/repo/commit/9a4f21d",
          snippet: "normalizes legacy snake_case options to camelCase",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 3.5,
        retrievalMethod: "lexical",
        matchReasons: ["Exact match on reference key"],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates, {
      claimedQuotes: ["normalizes legacy snake_case options to camelCase"],
    });

    expect(report.verifiedQuotes).toContain(
      "normalizes legacy snake_case options to camelCase",
    );
    expect(report.inventedQuotes?.length).toBe(0);
    expect(report.validatedEvidence[0].verifiedQuotes).toBeDefined();
  });

  it("should reject invented quotations that do not exist in cited source content", async () => {
    const candidates: EvidenceSearchResultItem[] = [
      {
        source: {
          id: "real-src-id",
          repositoryId: "repo-1",
          sourceType: EvidenceSourceType.COMMIT,
          externalId: "9a4f21d",
          referenceKey: "9a4f21d",
          title: "refactor: config schema",
          author: "Alice",
          url: "https://github.com/owner/repo/commit/9a4f21d",
          snippet: "normalizes legacy snake_case options to camelCase",
          recordedAt: "2026-01-10T00:00:00Z",
        },
        score: 3.5,
        retrievalMethod: "lexical",
        matchReasons: ["Exact match on reference key"],
      },
    ];

    const report = await validator.validateCitations("repo-1", candidates, {
      claimedQuotes: ["invented quote about postgres performance optimization"],
    });

    expect(report.inventedQuotes).toContain(
      "invented quote about postgres performance optimization",
    );
    expect(report.verifiedQuotes?.length).toBe(0);

    const directCheck = validator.validateQuotation(
      "invented quote about postgres performance optimization",
      candidates[0].source,
    );
    expect(directCheck.isValid).toBe(false);
    expect(directCheck.reason).toContain(
      "does not exist in cited source content",
    );
  });
});
