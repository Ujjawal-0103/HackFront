import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RepositoriesPage from "./page";
import { api } from "../../lib/api";

jest.mock("../../lib/api");

const mockRepositories = [
  {
    id: "repo-123",
    workspaceId: "ws_alpha",
    fullName: "Ujjawal-0103/HackFront",
    defaultBranch: "main",
    isPrivate: false,
    indexedAt: "2026-10-13T10:00:00Z",
    createdAt: "2026-10-13T09:00:00Z",
    updatedAt: "2026-10-13T10:00:00Z",
    counts: {
      commits: 12,
      pullRequests: 3,
      issues: 5,
      sourceRecords: 20,
    },
    latestSyncJob: {
      id: "job-1",
      status: "COMPLETED",
      trigger: "MANUAL",
      commitsCount: 12,
      pullRequestsCount: 3,
      issuesCount: 5,
      errorMessage: null,
      startedAt: "2026-10-13T09:55:00Z",
      completedAt: "2026-10-13T10:00:00Z",
      createdAt: "2026-10-13T09:55:00Z",
    },
  },
];

const mockAuthorizedRepos = [
  {
    id: 98765,
    fullName: "Ujjawal-0103/HackFront",
    owner: "Ujjawal-0103",
    repo: "HackFront",
    defaultBranch: "main",
    isPrivate: false,
    permissions: { contents: "read", issues: "read", pullRequests: "read" },
  },
  {
    id: 54321,
    fullName: "acme-corp/payment-service",
    owner: "acme-corp",
    repo: "payment-service",
    defaultBranch: "main",
    isPrivate: true,
    permissions: { contents: "read", issues: "read", pullRequests: "read" },
  },
];

describe("RepositoriesPage (Sprint 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getRepositories as jest.Mock).mockResolvedValue(mockRepositories);
    (api.getAuthorizedGitHubRepositories as jest.Mock).mockResolvedValue(
      mockAuthorizedRepos,
    );
  });

  it("renders repository list with metadata, branch, and counts", async () => {
    render(<RepositoriesPage />);

    expect(
      screen.getByText("Loading repository records..."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // commits
    expect(screen.getByText("20")).toBeInTheDocument(); // source records
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("renders empty state when no repositories are connected", async () => {
    (api.getRepositories as jest.Mock).mockResolvedValue([]);

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No Repositories Connected Yet"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /import authorized repository/i }),
    ).toBeInTheDocument();
  });

  it("triggers manual sync on button click", async () => {
    (api.triggerSync as jest.Mock).mockResolvedValue({
      jobId: "job-2",
      status: "PENDING",
      message: "Sync enqueued",
    });

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    const syncButton = screen.getByRole("button", { name: /trigger sync/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.triggerSync).toHaveBeenCalledWith("repo-123");
    });
  });

  it("opens connect modal and displays authorized GitHub repositories", async () => {
    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    const connectButton = screen.getByRole("button", {
      name: /\+ connect repository/i,
    });
    fireEvent.click(connectButton);

    expect(
      screen.getByText("Connect Authorized Repository"),
    ).toBeInTheDocument();
    expect(screen.getByText("acme-corp/payment-service")).toBeInTheDocument();
  });

  it("expands activity details when View Details button is clicked", async () => {
    (api.getRepositoryActivity as jest.Mock).mockResolvedValue({
      repositoryId: "repo-123",
      fullName: "Ujjawal-0103/HackFront",
      commits: [
        {
          sha: "abcdef123456",
          message: "fix: prevent memory leak in reconnection buffer",
          authorName: "Alex Dev",
          committedAt: "2026-10-13T09:00:00Z",
          url: "https://github.com/Ujjawal-0103/HackFront/commit/abcdef123456",
        },
      ],
      pullRequests: [],
      issues: [],
    });

    (api.getSyncStatus as jest.Mock).mockResolvedValue({
      repositoryId: "repo-123",
      recentJobs: [],
    });

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByRole("button", {
      name: /view details/i,
    });
    fireEvent.click(viewDetailsButton);

    await waitFor(() => {
      expect(api.getRepositoryActivity).toHaveBeenCalledWith("repo-123");
      expect(
        screen.getByText("fix: prevent memory leak in reconnection buffer"),
      ).toBeInTheDocument();
    });
  });
});
