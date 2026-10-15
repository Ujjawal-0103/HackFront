import React from "react";
import "@testing-library/jest-dom";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import VerifyPage from "./page";
import { api } from "../../lib/api";

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null),
  }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    activeWorkspace: { id: "ws_alpha", name: "Alpha Corp" },
    user: { id: "user_1", name: "Alex" },
  }),
}));

jest.mock("../../lib/api", () => {
  const original = jest.requireActual("../../lib/api");
  return {
    ...original,
    api: {
      ...original.api,
      getRepositories: jest.fn(),
      verifyExplanation: jest.fn(),
      getVerificationSession: jest.fn(),
      recordVerdict: jest.fn(),
      updateClaim: jest.fn(),
      exportReport: jest.fn(),
    },
  };
});

describe("VerifyPage Component (Sprint 6 Verification Workspace)", () => {
  const mockRepos = [
    {
      id: "repo-1",
      workspaceId: "ws_alpha",
      fullName: "traceback/core-engine",
      defaultBranch: "main",
      isPrivate: false,
      indexedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      counts: { commits: 10, pullRequests: 2, issues: 1, sourceRecords: 13 },
    },
  ];

  const mockVerificationResult = {
    sessionId: "sess-test-101",
    workspaceId: "ws_alpha",
    repositoryId: "repo-1",
    status: "REVIEWING",
    explanation:
      "Atomic locks were added to avoid cache concurrency race conditions",
    claimsCount: 1,
    assessments: [
      {
        claimId: "claim-101",
        claimText:
          "Atomic locks were added to avoid cache concurrency race conditions",
        status: "SUPPORTED",
        confidenceScore: 0.95,
        rationale: "Validated against commit 7f8a9b",
        supportingEvidence: [
          {
            sourceType: "COMMIT",
            referenceKey: "7f8a9b",
            title: "fix: use mutex lock for cache operations",
            author: "dev@company.com",
            timestamp: new Date().toISOString(),
            url: "https://github.com/org/repo/commit/7f8a9b",
            snippet: "+ const lock = new Mutex();",
          },
        ],
        contradictingEvidence: [],
        allValidatedEvidence: [
          {
            sourceType: "COMMIT",
            referenceKey: "7f8a9b",
            title: "fix: use mutex lock for cache operations",
            author: "dev@company.com",
            timestamp: new Date().toISOString(),
            url: "https://github.com/org/repo/commit/7f8a9b",
            snippet: "+ const lock = new Mutex();",
          },
        ],
        requiresHumanReview: false,
        humanVerdict: null,
        reviewNotes: null,
      },
    ],
    citationValidityRate: 1.0,
    executionTimeMs: 140,
    estimatedTokensUsed: 55,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getRepositories as jest.Mock).mockResolvedValue(mockRepos);
    (api.verifyExplanation as jest.Mock).mockResolvedValue(
      mockVerificationResult,
    );
    (api.getVerificationSession as jest.Mock).mockResolvedValue({
      ...mockVerificationResult,
      assessments: [
        {
          ...mockVerificationResult.assessments[0],
          humanVerdict: "SUPPORTED",
          reviewNotes: "Confirmed against PR #42",
        },
      ],
    });
    (api.recordVerdict as jest.Mock).mockResolvedValue({ success: true });
  });

  it("renders verification form and loads repositories", async () => {
    render(<VerifyPage />);

    expect(screen.getByText("Verification Workspace")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
    expect(
      screen.getByLabelText(/ai-generated explanation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify explanation/i }),
    ).toBeInTheDocument();
  });

  it("submits explanation, renders decomposed claims and machine assessment badges", async () => {
    render(<VerifyPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/ai-generated explanation/i), {
      target: {
        value:
          "Atomic locks were added to avoid cache concurrency race conditions",
      },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /verify explanation/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Machine: SUPPORTED/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Validated against commit 7f8a9b/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/7f8a9b: fix: use mutex lock for cache operations/i),
      ).toBeInTheDocument();
    });

    expect(api.verifyExplanation).toHaveBeenCalledWith(
      "repo-1",
      {
        explanation:
          "Atomic locks were added to avoid cache concurrency race conditions",
        targetFilePath: undefined,
        targetSymbol: undefined,
        codeSnippet: undefined,
      },
      "ws_alpha",
    );
  });

  it("records human reviewer verdict when button is clicked", async () => {
    render(<VerifyPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/ai-generated explanation/i), {
      target: {
        value:
          "Atomic locks were added to avoid cache concurrency race conditions",
      },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /verify explanation/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Machine: SUPPORTED/i)).toBeInTheDocument();
    });

    // Record human verdict
    const markSupportedBtn = screen.getByRole("button", {
      name: /mark supported/i,
    });
    await act(async () => {
      fireEvent.click(markSupportedBtn);
    });

    expect(api.recordVerdict).toHaveBeenCalledWith(
      "repo-1",
      "sess-test-101",
      "claim-101",
      { verdict: "SUPPORTED", reviewNotes: undefined },
      "ws_alpha",
    );
  });
});
