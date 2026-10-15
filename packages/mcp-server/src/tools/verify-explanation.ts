import { z } from "zod";
import { TracebackApiClient } from "../client";
import {
  VerifyExplanationMcpResponse,
  VerifyExplanationMcpClaim,
  VerificationAssessmentStatus,
} from "@traceback/shared-types";

export const verifyExplanationSchema = {
  workspaceId: z.string().min(1).describe("Authorized workspace ID"),
  repositoryId: z.string().min(1).describe("Authorized repository ID"),
  explanation: z
    .string()
    .min(5, "Explanation must be at least 5 characters")
    .max(10000, "Explanation exceeds 10,000 character maximum")
    .describe("The AI-generated code explanation to verify against historical records"),
  codeSnippet: z
    .string()
    .max(20000, "Code snippet exceeds 20,000 character maximum")
    .optional()
    .describe("Optional code snippet that the explanation describes"),
  targetFilePath: z
    .string()
    .max(500)
    .optional()
    .describe("Optional path to the source file being explained"),
  targetSymbol: z
    .string()
    .max(200)
    .optional()
    .describe("Optional function, method, or class name"),
  maxClaims: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum number of claims to extract and verify (default: 5, max: 10)"),
  apiToken: z
    .string()
    .optional()
    .describe("Optional explicit API session token (overrides environment variable)"),
};

export async function handleVerifyExplanation(
  args: z.infer<z.ZodObject<typeof verifyExplanationSchema>>,
  client: TracebackApiClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const rawResult = await client.verifyExplanation({
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      explanation: args.explanation,
      codeSnippet: args.codeSnippet,
      targetFilePath: args.targetFilePath,
      targetSymbol: args.targetSymbol,
      maxClaims: args.maxClaims ?? 5,
      token: args.apiToken,
    });

    const mcpClaims: VerifyExplanationMcpClaim[] = (rawResult.assessments || []).map((assessment) => {
      const citations = (assessment.allValidatedEvidence || []).map((ev: any) => ({
        sourceId: ev.sourceRecordId || ev.id || "unknown",
        sourceType: ev.sourceType || "UNKNOWN",
        referenceKey: ev.referenceKey || "unknown",
        title: ev.title || "Evidence Record",
        url: ev.url || "",
        relevanceScore: ev.quality?.relevanceScore ?? 0.5,
      }));

      return {
        claimId: assessment.claimId,
        claimText: assessment.claimText,
        status: assessment.status || "INSUFFICIENT_EVIDENCE",
        confidenceScore: assessment.confidenceScore ?? 0,
        rationale: assessment.rationale || "No rationale generated.",
        citations,
        limitations: assessment.abstentionNotice,
      };
    });

    let overallStatus: VerificationAssessmentStatus = "INSUFFICIENT_EVIDENCE";
    if (mcpClaims.length > 0) {
      const allSupported = mcpClaims.every((c) => c.status === "SUPPORTED");
      const anyContradicted = mcpClaims.some((c) => c.status === "CONTRADICTED");
      const anySupported = mcpClaims.some((c) => c.status === "SUPPORTED");

      if (allSupported) {
        overallStatus = "SUPPORTED";
      } else if (anyContradicted) {
        overallStatus = "CONTRADICTED";
      } else if (anySupported) {
        overallStatus = "MIXED";
      } else {
        overallStatus = "INSUFFICIENT_EVIDENCE";
      }
    }

    const avgConfidence =
      mcpClaims.length > 0
        ? mcpClaims.reduce((sum, c) => sum + c.confidenceScore, 0) / mcpClaims.length
        : 0;

    const responsePayload: VerifyExplanationMcpResponse = {
      sessionId: rawResult.sessionId,
      status: overallStatus,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      claimsCount: mcpClaims.length,
      claims: mcpClaims,
      abstentionNotice:
        overallStatus === "INSUFFICIENT_EVIDENCE"
          ? "Historical evidence in this repository neither confirms nor refutes one or more claims. (Absence of evidence is not evidence of falsehood)."
          : undefined,
      citationValidityRate: rawResult.citationValidityRate ?? 1.0,
      advisoryNotice:
        "Traceback AI assessments are preliminary and strictly advisory. Never treat unverified claims as historical truth.",
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(responsePayload, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const errorPayload = {
      error: true,
      message: error.message || "Failed to verify explanation",
      code: error.code || "VERIFICATION_ERROR",
      statusCode: error.statusCode || 500,
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorPayload, null, 2),
        },
      ],
    };
  }
}
