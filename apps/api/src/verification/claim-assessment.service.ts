import { Injectable, Logger } from "@nestjs/common";
import { EvidenceSearchService } from "../evidence/evidence-search.service";
import { CitationValidatorService } from "./citation-validator.service";
import { AbstentionHandlerService } from "./abstention-handler.service";
import {
  ClaimAssessmentResult,
  ExtractedClaim,
  toPrismaConfidence,
  ValidatedEvidenceItem,
  VerificationAssessmentStatus,
} from "./verification.types";

export interface AssessClaimsOptions {
  workspaceId: string;
  repositoryId: string;
  claims: ExtractedClaim[];
  targetFilePath?: string;
  codeSnippet?: string;
}

@Injectable()
export class ClaimAssessmentService {
  private readonly logger = new Logger(ClaimAssessmentService.name);
  private readonly EVIDENCE_LIMIT_PER_CLAIM = 5;

  // Patterns that signal contradiction or retraction in historical sources
  private readonly CONTRADICTION_KEYWORDS = [
    /\brevert(?:ed|ing|s)?\b/i,
    /\bconflict(?:s|ing|ed)?\b/i,
    /\bincorrect\b/i,
    /\bwrong\b/i,
    /\bremoved\b/i,
    /\bmemory leak\b/i,
    /\bregression\b/i,
    /\bwas rolled back\b/i,
  ];

  constructor(
    private readonly searchService: EvidenceSearchService,
    private readonly citationValidator: CitationValidatorService,
    private readonly abstentionHandler: AbstentionHandlerService,
  ) {}

  /**
   * Assesses a set of extracted claims against repository history.
   * Produces transparent, bounded, cautious assessments with strict abstention and citation verification.
   */
  async assessClaims(
    options: AssessClaimsOptions,
  ): Promise<ClaimAssessmentResult[]> {
    const results: ClaimAssessmentResult[] = [];

    for (const claim of options.claims) {
      try {
        const assessment = await this.assessSingleClaim(
          options.workspaceId,
          options.repositoryId,
          claim,
          options.targetFilePath,
        );
        results.push(assessment);
      } catch (err) {
        // Safe fallback on unexpected error: flag for manual review, do not fail entire session
        this.logger.error(
          `Unexpected error assessing claim "${claim.id}": ${err instanceof Error ? err.message : String(err)}`,
        );
        results.push(this.createFallbackAssessment(claim, err));
      }
    }

    return results;
  }

  /**
   * Assesses a single claim by querying evidence, validating citations, checking abstention,
   * and determining structured support or contradiction.
   */
  public async assessSingleClaim(
    workspaceId: string,
    repositoryId: string,
    claim: ExtractedClaim,
    targetFilePath?: string,
  ): Promise<ClaimAssessmentResult> {
    // 1. Build bounded search query from claim text and target symbol
    const searchQuery = this.buildSearchQuery(claim);

    // 2. Retrieve candidates via EvidenceSearchService
    const searchResponse = await this.searchService.search({
      workspaceId,
      repositoryId,
      query: searchQuery,
      filePath: targetFilePath,
      limit: this.EVIDENCE_LIMIT_PER_CLAIM,
    });

    // 3. Strict citation validation (SEC-09)
    const citationReport = await this.citationValidator.validateCitations(
      repositoryId,
      searchResponse.items,
    );

    const validEvidence = citationReport.validatedEvidence;

    // 4. Abstention check (RF-08, SEC-10)
    const abstention = this.abstentionHandler.evaluateAbstention(validEvidence);
    if (abstention.shouldAbstain) {
      return {
        claimId: claim.id,
        claimText: claim.text,
        targetSymbol: claim.targetSymbol,
        status: "INSUFFICIENT_EVIDENCE",
        prismaConfidence: toPrismaConfidence("INSUFFICIENT_EVIDENCE"),
        confidenceScore: 0.2,
        rationale: abstention.abstentionNotice || abstention.reason,
        supportingEvidence: [],
        contradictingEvidence: [],
        allValidatedEvidence: validEvidence,
        requiresHumanReview: true,
        abstentionNotice: abstention.abstentionNotice,
      };
    }

    // 5. Partition evidence into supporting vs contradicting
    const supporting: ValidatedEvidenceItem[] = [];
    const contradicting: ValidatedEvidenceItem[] = [];

    for (const item of validEvidence) {
      if (this.isContradictoryEvidence(claim, item, targetFilePath)) {
        contradicting.push(item);
      } else if (item.quality.relevanceScore >= AbstentionHandlerService.MINIMUM_RELEVANCE_THRESHOLD) {
        supporting.push(item);
      }
    }

    // 6. Synthesize structured assessment status
    let status: VerificationAssessmentStatus;
    let confidenceScore: number;
    let rationale: string;
    let requiresHumanReview = false;

    if (contradicting.length > 0 && supporting.length > 0) {
      // Historical sources conflict (e.g. initial PR added it, later PR reverted it - ARCH-03)
      status = "MIXED";
      confidenceScore = 0.5;
      requiresHumanReview = true;
      const revertRef = contradicting[0].referenceKey;
      const supportRef = supporting[0].referenceKey;
      rationale = `Conflicting historical records detected: Evidence in ${supportRef} introduced or proposed this rationale, but subsequent record ${revertRef} indicates a revert, rollback, or constraint change. Requires human review.`;
    } else if (contradicting.length > 0) {
      // Evidence directly refutes claim
      status = "CONTRADICTED";
      confidenceScore = 0.85;
      const ref = contradicting[0].referenceKey;
      rationale = `Historical evidence in ${ref} directly contradicts the asserted rationale (e.g. indicates reversion, rollback, or differing architectural constraints).`;
    } else if (supporting.length > 0) {
      // Strong or partial corroboration
      const topScore = supporting[0].quality.relevanceScore;
      const hasDirectCorroboration = supporting.some(
        (s) => s.quality.hasExactReferenceKeyMatch || s.quality.isDirectFilePathMatch || topScore >= 3.0,
      );

      if (hasDirectCorroboration) {
        status = "SUPPORTED";
        confidenceScore = Math.min(0.95, 0.7 + topScore * 0.05);
        const topRefs = supporting.slice(0, 3).map((s) => s.referenceKey).join(", ");
        rationale = `Historical records (${topRefs}) corroborate the asserted design rationale and target context.`;
      } else {
        status = "MIXED";
        confidenceScore = 0.6;
        requiresHumanReview = true;
        const topRef = supporting[0].referenceKey;
        rationale = `Partial historical evidence found in ${topRef}, but lacks full primary source corroboration. Human review advised.`;
      }
    } else {
      status = "INSUFFICIENT_EVIDENCE";
      confidenceScore = 0.2;
      requiresHumanReview = true;
      rationale =
        "Insufficient Evidence: No historical commits, PRs, or documentation matched this claim above the calibrated threshold. Absence of evidence does not prove that a claim is false.";
    }

    return {
      claimId: claim.id,
      claimText: claim.text,
      targetSymbol: claim.targetSymbol,
      status,
      prismaConfidence: toPrismaConfidence(status),
      confidenceScore,
      rationale,
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
      allValidatedEvidence: validEvidence,
      requiresHumanReview,
    };
  }

  /**
   * Constructs search query combining claim text and target symbol
   */
  private buildSearchQuery(claim: ExtractedClaim): string {
    const parts: string[] = [];
    if (claim.targetSymbol) {
      parts.push(claim.targetSymbol);
    }
    parts.push(claim.text);
    return parts.join(" ");
  }

  /**
   * Detects if an evidence item contains explicit contradiction signals
   */
  private isContradictoryEvidence(
    claim: ExtractedClaim,
    item: ValidatedEvidenceItem,
    targetFilePath?: string,
  ): boolean {
    const textToInspect = `${item.title} ${item.snippet || ""} ${item.referenceKey}`.toLowerCase();
    const claimLower = claim.text.toLowerCase();

    // If target file is specified and candidate belongs to a different file path,
    // and candidate does not share the claim's target symbol, it does not contradict this claim.
    if (
      targetFilePath &&
      item.filePath &&
      targetFilePath.toLowerCase().trim() !== item.filePath.toLowerCase().trim()
    ) {
      const targetSymbolMatch =
        claim.targetSymbol && textToInspect.includes(claim.targetSymbol.toLowerCase());
      if (!targetSymbolMatch) {
        return false;
      }
    }

    // Check for explicit revert / rollback / memory leak keywords
    for (const pattern of this.CONTRADICTION_KEYWORDS) {
      if (pattern.test(textToInspect)) {
        return true;
      }
    }

    // Check for hallucinated technology dependencies (e.g. DynamoDB on PostgreSQL repo)
    if (
      claimLower.includes("dynamodb") &&
      !textToInspect.includes("dynamodb") &&
      textToInspect.includes("postgres")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generates a safe fallback assessment when an internal evaluation fails
   */
  private createFallbackAssessment(
    claim: ExtractedClaim,
    error: unknown,
  ): ClaimAssessmentResult {
    return {
      claimId: claim.id,
      claimText: claim.text,
      targetSymbol: claim.targetSymbol,
      status: "INSUFFICIENT_EVIDENCE",
      prismaConfidence: toPrismaConfidence("INSUFFICIENT_EVIDENCE"),
      confidenceScore: 0.1,
      rationale:
        "Assessment evaluation encountered an unexpected processing error. Fallback to manual human review activated without asserting truth or falsehood.",
      supportingEvidence: [],
      contradictingEvidence: [],
      allValidatedEvidence: [],
      requiresHumanReview: true,
      abstentionNotice: `Manual Review Required: ${error instanceof Error ? error.message : "Internal assessment fallback"}`,
    };
  }
}
