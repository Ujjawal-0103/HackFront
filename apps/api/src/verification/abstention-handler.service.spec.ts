import { AbstentionHandlerService } from "./abstention-handler.service";
import { ValidatedEvidenceItem } from "./verification.types";
import { EvidenceSourceType } from "@prisma/client";

describe("AbstentionHandlerService (Sprint 5 - Calibrated Abstention)", () => {
  let handler: AbstentionHandlerService;

  beforeEach(() => {
    handler = new AbstentionHandlerService();
  });

  const createEvidenceItem = (
    score: number,
    exactKey = false,
    directFile = false,
  ): ValidatedEvidenceItem => ({
    sourceRecordId: "src-1",
    sourceType: EvidenceSourceType.COMMIT,
    referenceKey: "9a4f21d",
    title: "Test commit",
    author: "Alice",
    timestamp: new Date("2026-01-10T00:00:00Z"),
    url: "https://github.com/owner/repo/commit/9a4f21d",
    quality: {
      relevanceScore: score,
      isDirectFilePathMatch: directFile,
      isProximityFilePathMatch: false,
      hasExactReferenceKeyMatch: exactKey,
      matchReasons: [],
      recordedAt: "2026-01-10T00:00:00Z",
    },
    isValidCitation: true,
  });

  it("should abstain when evidence candidate list is empty (ARCH-04)", () => {
    const evaluation = handler.evaluateAbstention([]);

    expect(evaluation.shouldAbstain).toBe(true);
    expect(evaluation.isSparseEvidence).toBe(true);
    expect(evaluation.abstentionNotice).toContain(
      "Absence of evidence does not prove that this claim is false",
    );
  });

  it("should abstain when all candidates score below minimum relevance threshold (< 0.8)", () => {
    const lowScoreEvidence = [createEvidenceItem(0.4), createEvidenceItem(0.7)];

    const evaluation = handler.evaluateAbstention(lowScoreEvidence);

    expect(evaluation.shouldAbstain).toBe(true);
    expect(evaluation.abstentionNotice).toContain("Insufficient Evidence");
    expect(evaluation.abstentionNotice).toContain(
      "Absence of evidence does not prove that this claim is false",
    );
  });

  it("should abstain on single weak score without strong signals (sparse evidence - ARCH-02)", () => {
    const sparseEvidence = [createEvidenceItem(1.1, false, false)];

    const evaluation = handler.evaluateAbstention(sparseEvidence);

    expect(evaluation.shouldAbstain).toBe(true);
    expect(evaluation.isSparseEvidence).toBe(true);
    expect(evaluation.abstentionNotice).toContain("Sparse Evidence");
  });

  it("should NOT abstain when strong evidence above threshold exists", () => {
    const strongEvidence = [
      createEvidenceItem(3.2, true, true),
      createEvidenceItem(2.1, false, true),
    ];

    const evaluation = handler.evaluateAbstention(strongEvidence);

    expect(evaluation.shouldAbstain).toBe(false);
    expect(evaluation.isSparseEvidence).toBe(false);
    expect(evaluation.abstentionNotice).toBeUndefined();
  });
});
