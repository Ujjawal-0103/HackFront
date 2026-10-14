import {
  AIAssessmentConfidence,
  EvidenceSourceType,
  HumanVerdict,
  SessionStatus,
} from "@prisma/client";

/**
 * Sprint 5 Structured Assessment Status
 * Strict separation of machine assessment from human verdicts.
 */
export type VerificationAssessmentStatus =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "INSUFFICIENT_EVIDENCE"
  | "MIXED";

/**
 * Maps structured assessment status to Prisma AIAssessmentConfidence enum
 */
export function toPrismaConfidence(
  status: VerificationAssessmentStatus,
): AIAssessmentConfidence {
  switch (status) {
    case "SUPPORTED":
      return AIAssessmentConfidence.HIGH_SUPPORT;
    case "CONTRADICTED":
      return AIAssessmentConfidence.CONTRADICTED;
    case "MIXED":
      return AIAssessmentConfidence.PARTIAL_SUPPORT;
    case "INSUFFICIENT_EVIDENCE":
    default:
      return AIAssessmentConfidence.SPARSE_EVIDENCE;
  }
}

/**
 * Maps Prisma AIAssessmentConfidence enum to structured assessment status
 */
export function fromPrismaConfidence(
  confidence: AIAssessmentConfidence,
): VerificationAssessmentStatus {
  switch (confidence) {
    case AIAssessmentConfidence.HIGH_SUPPORT:
      return "SUPPORTED";
    case AIAssessmentConfidence.CONTRADICTED:
      return "CONTRADICTED";
    case AIAssessmentConfidence.PARTIAL_SUPPORT:
      return "MIXED";
    case AIAssessmentConfidence.SPARSE_EVIDENCE:
    default:
      return "INSUFFICIENT_EVIDENCE";
  }
}

export interface ExtractedClaim {
  id: string;
  text: string;
  targetSymbol?: string;
  order: number;
  rawSentence: string;
}

export interface LlmClaimExtractionAdapter {
  isAvailable(): boolean;
  extractClaims(prompt: {
    explanation: string;
    codeSnippet?: string;
    targetSymbol?: string;
    targetFilePath?: string;
  }): Promise<ExtractedClaim[]>;
}

export interface EvidenceQualityMetadata {
  relevanceScore: number;
  isDirectFilePathMatch: boolean;
  isProximityFilePathMatch: boolean;
  hasExactReferenceKeyMatch: boolean;
  matchReasons: string[];
  recordedAt: string;
}

export interface ValidatedEvidenceItem {
  sourceRecordId?: string;
  sourceType: EvidenceSourceType;
  referenceKey: string;
  title: string;
  author: string;
  timestamp: Date;
  url: string;
  snippet?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  quality: EvidenceQualityMetadata;
  isValidCitation: boolean;
  validationError?: string;
  verifiedQuotes?: string[];
  invalidQuotes?: string[];
}

export interface ClaimAssessmentResult {
  claimId: string;
  claimText: string;
  targetSymbol?: string;
  status: VerificationAssessmentStatus;
  prismaConfidence: AIAssessmentConfidence;
  confidenceScore: number; // 0.0 to 1.0
  rationale: string;
  supportingEvidence: ValidatedEvidenceItem[];
  contradictingEvidence: ValidatedEvidenceItem[];
  allValidatedEvidence: ValidatedEvidenceItem[];
  requiresHumanReview: boolean;
  abstentionNotice?: string;
}

export interface VerificationSessionResult {
  sessionId: string;
  workspaceId: string;
  repositoryId: string;
  status: SessionStatus;
  explanation: string;
  codeSnippet?: string;
  targetFilePath?: string;
  claimsCount: number;
  assessments: ClaimAssessmentResult[];
  citationValidityRate: number; // 0.0 to 1.0 (1.0 = 100%)
  executionTimeMs: number;
  estimatedTokensUsed: number;
  fallbackNotice?: string;
}

export interface VerificationGoldCase {
  caseId: string;
  archetype: string;
  inputExplanation: string;
  targetSymbol?: string;
  targetFilePath?: string;
  expectedClaimsCount: number;
  expectedStatus: VerificationAssessmentStatus;
  expectedReferenceKeys: string[];
  shouldAbstain: boolean;
  adversarialPayload?: string;
  notes: string;
}
