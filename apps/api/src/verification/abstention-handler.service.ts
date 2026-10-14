import { Injectable, Logger } from "@nestjs/common";
import { ValidatedEvidenceItem } from "./verification.types";

export interface AbstentionEvaluation {
  shouldAbstain: boolean;
  reason: string;
  isSparseEvidence: boolean;
  abstentionNotice?: string;
}

@Injectable()
export class AbstentionHandlerService {
  private readonly logger = new Logger(AbstentionHandlerService.name);
  public static readonly MINIMUM_RELEVANCE_THRESHOLD = 0.8;
  public static readonly HIGH_CONFIDENCE_THRESHOLD = 2.5;

  /**
   * Evaluates whether the system must abstain from making a positive or negative claim assertion.
   * Core principle: Absence of evidence is not proof of falsehood (SEC-10, RF-08).
   */
  evaluateAbstention(
    evidence: ValidatedEvidenceItem[],
  ): AbstentionEvaluation {
    // 1. Zero evidence candidates found
    if (!evidence || evidence.length === 0) {
      return {
        shouldAbstain: true,
        reason: "No historical records matched the claim query.",
        isSparseEvidence: true,
        abstentionNotice:
          "Insufficient Evidence: No matching historical commits, PR discussions, or documentation records were found. Absence of evidence does not prove that this claim is false.",
      };
    }

    // 2. All candidates fall below the minimum relevance threshold
    const validScoredEvidence = evidence.filter(
      (e) => e.quality.relevanceScore >= AbstentionHandlerService.MINIMUM_RELEVANCE_THRESHOLD,
    );

    if (validScoredEvidence.length === 0) {
      return {
        shouldAbstain: true,
        reason: `All retrieved candidates scored below the minimum relevance threshold (${AbstentionHandlerService.MINIMUM_RELEVANCE_THRESHOLD}).`,
        isSparseEvidence: true,
        abstentionNotice:
          "Insufficient Evidence: Retrieved records lacked sufficient lexical or architectural similarity. Absence of evidence does not prove that this claim is false.",
      };
    }

    // 3. Sparse evidence: candidate matches lack strong signals (no direct file match, no exact key match, and score < 2.5)
    const hasStrongSignals = validScoredEvidence.some(
      (e) =>
        e.quality.hasExactReferenceKeyMatch ||
        e.quality.isDirectFilePathMatch ||
        e.quality.relevanceScore >= AbstentionHandlerService.HIGH_CONFIDENCE_THRESHOLD,
    );

    if (!hasStrongSignals) {
      return {
        shouldAbstain: true,
        reason: "Sparse historical evidence with weak confidence signals.",
        isSparseEvidence: true,
        abstentionNotice:
          "Sparse Evidence: Historical matches lack strong direct grounding or target file confirmation. The system abstains from asserting rationale correctness.",
      };
    }

    // Sufficient grounding evidence exists to perform structured assessment
    return {
      shouldAbstain: false,
      reason: `Found ${validScoredEvidence.length} relevant historical records above threshold.`,
      isSparseEvidence: false,
    };
  }
}
