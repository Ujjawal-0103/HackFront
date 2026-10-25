import { z } from "zod";
import { TracebackApiClient } from "../client";

export const getEngineeringDecisionsSchema = {
  workspaceId: z.string().min(1).describe("Authorized workspace ID"),
  repositoryId: z.string().min(1).describe("Authorized repository ID"),
  status: z
    .enum([
      "CANDIDATE",
      "IN_REVIEW",
      "ACCEPTED",
      "SUPERSEDED",
      "DISPUTED",
      "ARCHIVED",
    ])
    .optional()
    .describe("Filter decisions by lifecycle status"),
};

export async function handleGetEngineeringDecisions(
  args: z.infer<z.ZodObject<typeof getEngineeringDecisionsSchema>>,
  client: TracebackApiClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const decisions = await client.getEngineeringDecisions({
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      status: args.status,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              repositoryId: args.repositoryId,
              decisionsCount: decisions.length,
              decisions,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: true,
              message:
                error.message || "Failed to retrieve engineering decisions",
              code: error.code || "DECISION_RETRIEVAL_ERROR",
              statusCode: error.statusCode || 500,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

export const proposeEngineeringDecisionSchema = {
  workspaceId: z.string().min(1).describe("Authorized workspace ID"),
  repositoryId: z.string().min(1).describe("Authorized repository ID"),
  title: z
    .string()
    .min(3)
    .max(200)
    .describe("Concise title of the engineering decision or constraint"),
  summary: z
    .string()
    .min(5)
    .describe("Brief summary of the architectural context"),
  decision: z
    .string()
    .min(5)
    .describe("The concrete engineering decision, invariant, or constraint"),
  rationale: z
    .string()
    .min(5)
    .describe(
      "Historical or technical rationale explaining why this decision was established",
    ),
  targetFilePath: z
    .string()
    .optional()
    .describe("Primary file path governed by this decision"),
  targetSymbol: z
    .string()
    .optional()
    .describe(
      "Specific code symbol (class, function, type) governed by this decision",
    ),
  severity: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "ADVISORY"])
    .optional()
    .describe("Constraint severity"),
};

export async function handleProposeEngineeringDecision(
  args: z.infer<z.ZodObject<typeof proposeEngineeringDecisionSchema>>,
  client: TracebackApiClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const result = await client.proposeEngineeringDecision({
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      title: args.title,
      summary: args.summary,
      decision: args.decision,
      rationale: args.rationale,
      targetFilePath: args.targetFilePath,
      targetSymbol: args.targetSymbol,
      severity: args.severity,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message:
                "Candidate engineering decision proposed successfully. Requires human review before becoming an active constraint.",
              decision: result,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: true,
              message:
                error.message || "Failed to propose engineering decision",
              code: error.code || "DECISION_PROPOSAL_ERROR",
              statusCode: error.statusCode || 500,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
