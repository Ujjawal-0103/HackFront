import { ClaimAssessmentService } from "./claim-assessment.service";
import { EvidenceSearchService } from "../evidence/evidence-search.service";
import { CitationValidatorService } from "./citation-validator.service";
import { AbstentionHandlerService } from "./abstention-handler.service";
import { EvidenceSourceType } from "@prisma/client";
import { ExtractedClaim } from "./verification.types";

describe("ClaimAssessmentService (Sprint 5 - Grounding Assessment)", () => {
  let assessmentService: ClaimAssessmentService;
  let mockSearchService: Partial<EvidenceSearchService>;
  let mockValidator: Partial<CitationValidatorService>;
  let abstentionHandler: AbstentionHandlerService;

  beforeEach(() => {
    abstentionHandler = new AbstentionHandlerService();
    mockValidator = {
      validateCitations: jest.fn().mockImplementation((_repoId, items) => {
        return Promise.resolve({
          totalCitations: items.length,
          validCitationsCount: items.length,
          invalidCitationsCount: 0,
          validityRate: 1.0,
          validatedEvidence: items.map((it: any) => ({
            sourceRecordId: it.source.id,
            sourceType: it.source.sourceType,
            referenceKey: it.source.referenceKey,
            title: it.source.title,
            author: it.source.author,
            timestamp: new Date(it.source.recordedAt),
            url: it.source.url,
            snippet: it.source.snippet,
            filePath: it.source.filePath,
            quality: {
              relevanceScore: it.score,
              isDirectFilePathMatch: it.matchReasons.some((r: string) =>
                r.includes("direct match"),
              ),
              isProximityFilePathMatch: false,
              hasExactReferenceKeyMatch: it.matchReasons.some((r: string) =>
                r.includes("Exact match"),
              ),
              matchReasons: it.matchReasons,
              recordedAt: it.source.recordedAt,
            },
            isValidCitation: true,
          })),
          invalidCitations: [],
        });
      }),
    };
  });

  it("should assess claim as SUPPORTED when strong evidence corroborates rationale", async () => {
    mockSearchService = {
      search: jest.fn().mockResolvedValue({
        items: [
          {
            source: {
              id: "src-1",
              repositoryId: "repo-1",
              sourceType: EvidenceSourceType.COMMIT,
              referenceKey: "9a4f21d",
              title: "refactor: normalizeConfig options to camelCase",
              author: "Alice",
              url: "https://github.com/owner/repo/commit/9a4f21d",
              snippet: "normalizes legacy snake_case options to camelCase",
              filePath: "src/config.ts",
              recordedAt: "2026-01-10T00:00:00Z",
            },
            score: 4.5,
            retrievalMethod: "lexical",
            matchReasons: [
              "Exact match on reference key",
              "direct match on target file",
            ],
          },
        ],
      }),
    };

    assessmentService = new ClaimAssessmentService(
      mockSearchService as EvidenceSearchService,
      mockValidator as CitationValidatorService,
      abstentionHandler,
    );

    const claim: ExtractedClaim = {
      id: "claim-1",
      text: "normalizeConfig normalizes legacy snake_case options to camelCase",
      targetSymbol: "normalizeConfig",
      order: 1,
      rawSentence:
        "normalizeConfig normalizes legacy snake_case options to camelCase",
    };

    const result = await assessmentService.assessSingleClaim(
      "ws-1",
      "repo-1",
      claim,
      "src/config.ts",
    );

    expect(result.status).toBe("SUPPORTED");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(result.supportingEvidence.length).toBe(1);
    expect(result.contradictingEvidence.length).toBe(0);
    expect(result.rationale).toContain("9a4f21d");
  });

  it("should assess claim as MIXED when contradictory revert records exist (ARCH-03)", async () => {
    mockSearchService = {
      search: jest.fn().mockResolvedValue({
        items: [
          {
            source: {
              id: "src-revert",
              repositoryId: "repo-1",
              sourceType: EvidenceSourceType.COMMIT,
              referenceKey: "e11200a",
              title: "revert: remove memoization due to memory leak regression",
              author: "Charlie",
              url: "https://github.com/owner/repo/commit/e11200a",
              snippet: "reverted table memoization",
              filePath: "src/hooks.ts",
              recordedAt: "2026-02-15T00:00:00Z",
            },
            score: 3.5,
            retrievalMethod: "lexical",
            matchReasons: ["Keyword matches in title"],
          },
          {
            source: {
              id: "src-pr",
              repositoryId: "repo-1",
              sourceType: EvidenceSourceType.PULL_REQUEST,
              referenceKey: "#89",
              title: "feat: add table memoization for rows > 100",
              author: "Bob",
              url: "https://github.com/owner/repo/pull/89",
              snippet: "added useMemoizedState",
              filePath: "src/hooks.ts",
              recordedAt: "2026-02-01T00:00:00Z",
            },
            score: 3.0,
            retrievalMethod: "lexical",
            matchReasons: ["direct match on target file"],
          },
        ],
      }),
    };

    assessmentService = new ClaimAssessmentService(
      mockSearchService as EvidenceSearchService,
      mockValidator as CitationValidatorService,
      abstentionHandler,
    );

    const claim: ExtractedClaim = {
      id: "claim-1",
      text: "Memoization was introduced to prevent re-renders when table size exceeds 100 rows",
      order: 1,
      rawSentence: "Memoization was introduced",
    };

    const result = await assessmentService.assessSingleClaim(
      "ws-1",
      "repo-1",
      claim,
      "src/hooks.ts",
    );

    expect(result.status).toBe("MIXED");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.contradictingEvidence.length).toBe(1);
    expect(result.supportingEvidence.length).toBe(1);
    expect(result.rationale).toContain(
      "Conflicting historical records detected",
    );
  });

  it("should abstain with INSUFFICIENT_EVIDENCE on missing evidence and NEVER mark CONTRADICTED", async () => {
    mockSearchService = {
      search: jest.fn().mockResolvedValue({
        items: [],
      }),
    };

    assessmentService = new ClaimAssessmentService(
      mockSearchService as EvidenceSearchService,
      mockValidator as CitationValidatorService,
      abstentionHandler,
    );

    const claim: ExtractedClaim = {
      id: "claim-1",
      text: "Buffer allocation is limited to 1024 bytes to mitigate an undocumented Linux kernel socket overflow bug",
      order: 1,
      rawSentence: "Buffer allocation is limited",
    };

    const result = await assessmentService.assessSingleClaim(
      "ws-1",
      "repo-1",
      claim,
      "src/buffer.ts",
    );

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.status).not.toBe("CONTRADICTED");
    expect(result.rationale).toContain(
      "Absence of evidence does not prove that this claim is false",
    );
    expect(result.requiresHumanReview).toBe(true);
  });

  it("should activate safe fallback when an internal search error occurs", async () => {
    mockSearchService = {
      search: jest
        .fn()
        .mockRejectedValue(new Error("Database connection timeout")),
    };

    assessmentService = new ClaimAssessmentService(
      mockSearchService as EvidenceSearchService,
      mockValidator as CitationValidatorService,
      abstentionHandler,
    );

    const claims: ExtractedClaim[] = [
      {
        id: "claim-1",
        text: "Some rationale",
        order: 1,
        rawSentence: "Some rationale",
      },
    ];

    const results = await assessmentService.assessClaims({
      workspaceId: "ws-1",
      repositoryId: "repo-1",
      claims,
    });

    expect(results.length).toBe(1);
    expect(results[0].status).toBe("INSUFFICIENT_EVIDENCE");
    expect(results[0].requiresHumanReview).toBe(true);
    expect(results[0].rationale).toContain(
      "Fallback to manual human review activated",
    );
  });
});
