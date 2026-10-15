import { z } from "zod";
import { TracebackApiClient } from "../client";
import { CheckChangeAgainstDecisionsResponse } from "@traceback/shared-types";

export const checkChangeAgainstDecisionsSchema = {
  workspaceId: z.string().min(1).describe("Authorized workspace ID"),
  repositoryId: z.string().min(1).describe("Authorized repository ID"),
  diff: z
    .string()
    .max(20000, "Diff exceeds 20,000 character limit. Please supply a smaller patch or targeted description.")
    .optional()
    .describe("Proposed git diff or unified patch to evaluate against historical constraints"),
  changeDescription: z
    .string()
    .max(5000, "Change description exceeds 5,000 character limit.")
    .optional()
    .describe("Natural language summary of the proposed code change"),
  targetFilePaths: z
    .array(z.string())
    .optional()
    .describe("Specific files modified or affected by this change"),
  pullRequestId: z
    .string()
    .max(100)
    .optional()
    .describe("Optional pull request number or ID if reviewing a pull request"),
  apiToken: z
    .string()
    .optional()
    .describe("Optional explicit API session token (overrides environment variable)"),
};

export async function handleCheckChangeAgainstDecisions(
  args: z.infer<z.ZodObject<typeof checkChangeAgainstDecisionsSchema>>,
  client: TracebackApiClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    if (!args.diff?.trim() && !args.changeDescription?.trim()) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: true,
                message: "Either 'diff' or 'changeDescription' must be provided for advisory change evaluation.",
                code: "INVALID_ARGUMENTS",
                statusCode: 400,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const result = await client.checkChangeAgainstDecisions({
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      diff: args.diff,
      changeDescription: args.changeDescription,
      targetFilePaths: args.targetFilePaths,
      pullRequestId: args.pullRequestId,
      token: args.apiToken,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const errorPayload = {
      error: true,
      message: error.message || "Failed to evaluate change against historical decisions",
      code: error.code || "ADVISORY_CHECK_ERROR",
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
