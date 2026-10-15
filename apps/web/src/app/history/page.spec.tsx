import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import HistoryPage from "./page";
import { api } from "../../lib/api";

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
      getWorkspaceHistory: jest.fn(),
      exportReport: jest.fn(),
    },
  };
});

describe("HistoryPage Component (Sprint 6 Saved History & Reports)", () => {
  const mockHistoryItems = [
    {
      id: "sess-hist-001",
      workspaceId: "ws_alpha",
      repositoryId: "repo-1",
      repositoryFullName: "traceback/core-engine",
      explanation: "Added mutex lock for cache operations",
      targetFilePath: "src/cache/lock.ts",
      status: "COMPLETED",
      claimsCount: 2,
      assessedCount: 2,
      humanReviewedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getRepositories as jest.Mock).mockResolvedValue([
      { id: "repo-1", fullName: "traceback/core-engine" },
    ]);
    (api.getWorkspaceHistory as jest.Mock).mockResolvedValue({
      items: mockHistoryItems,
      total: 1,
      page: 1,
      limit: 10,
    });
    (api.exportReport as jest.Mock).mockResolvedValue({
      schemaVersion: "traceback.report.v1",
      verificationId: "sess-hist-001",
      summary: { totalClaims: 2 },
    });
  });

  it("renders history header, filters, and past verifications list", async () => {
    render(<HistoryPage />);

    expect(
      screen.getByText("Verification History & Reports"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "traceback/core-engine" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Added mutex lock for cache operations/i),
      ).toBeInTheDocument();
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
    });

    const openLink = screen.getByRole("link", { name: /open verification/i });
    expect(openLink).toHaveAttribute(
      "href",
      "/verify?sessionId=sess-hist-001&repoId=repo-1",
    );
  });

  it("renders empty state when workspace has no past verifications", async () => {
    (api.getWorkspaceHistory as jest.Mock).mockReset();
    (api.getWorkspaceHistory as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No Verifications Found")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /start your first verification/i }),
      ).toHaveAttribute("href", "/verify");
    });
  });
});
