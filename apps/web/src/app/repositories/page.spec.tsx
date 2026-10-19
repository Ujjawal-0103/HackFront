import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RepositoriesPage from "./page";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

jest.mock("../../lib/api");
jest.mock("../../context/AuthContext");

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

describe("RepositoriesPage (Sprint 3 & GitHub Hardening)", () => {
  const defaultAuthContext = {
    user: { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
    workspaces: [
      { id: "ws_alpha", name: "Alpha Corp", slug: "alpha-corp", role: "OWNER" },
    ],
    activeWorkspace: {
      id: "ws_alpha",
      name: "Alpha Corp",
      slug: "alpha-corp",
      role: "OWNER",
    },
    token: "mock-token",
    isLoading: false,
    error: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    switchWorkspace: jest.fn(),
    refreshSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(defaultAuthContext);
    (api.getRepositories as jest.Mock).mockResolvedValue(mockRepositories);
    (api.getAuthorizedGitHubRepositories as jest.Mock).mockResolvedValue(
      mockAuthorizedRepos,
    );
    (api.getGitHubStatus as jest.Mock).mockResolvedValue({
      isConfigured: true,
      isMockMode: false,
      appSlug: "traceback-app",
      installation: {
        id: "inst-1",
        workspaceId: "ws_alpha",
        installationId: 1001,
        accountLogin: "acme-corp",
        accountType: "Organization",
        createdAt: "2026-10-18T10:00:00Z",
      },
    });
  });

  it("renders unauthenticated state with sign in prompt when user is not logged in", () => {
    (useAuth as jest.Mock).mockReturnValue({
      ...defaultAuthContext,
      user: null,
      activeWorkspace: null,
    });

    render(<RepositoriesPage />);

    expect(screen.getByText("Authentication Required")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in to continue/i }),
    ).toHaveAttribute("href", "/login?returnTo=/repositories");
  });

  it("renders initializing session placeholder while auth is loading", () => {
    (useAuth as jest.Mock).mockReturnValue({
      ...defaultAuthContext,
      isLoading: true,
    });

    render(<RepositoriesPage />);

    expect(screen.getByText("Initializing Session...")).toBeInTheDocument();
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

  it("renders unconfigured state banner in modal when GitHub App credentials are missing", async () => {
    (api.getGitHubStatus as jest.Mock).mockResolvedValue({
      isConfigured: false,
      isMockMode: false,
      installation: null,
    });

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /\+ connect repository/i }),
    );

    expect(screen.getByText("GitHub App Not Configured")).toBeInTheDocument();
  });

  it("renders zero accessible repositories message when installation has no repos granted", async () => {
    (api.getAuthorizedGitHubRepositories as jest.Mock).mockResolvedValue([]);

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /\+ connect repository/i }),
    );

    expect(
      screen.getByText(
        /No accessible repositories found in GitHub installation #1001/,
      ),
    ).toBeInTheDocument();
  });

  it("displays API error in modal when fetching authorized repositories fails", async () => {
    (api.getAuthorizedGitHubRepositories as jest.Mock).mockRejectedValue(
      new Error("GitHub API rate limit exceeded"),
    );

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText("Ujjawal-0103/HackFront")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /\+ connect repository/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/GitHub API rate limit exceeded/),
      ).toBeInTheDocument();
    });
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

  it("displays actionable error banner when repository loading fails with an authorization error", async () => {
    (api.getRepositories as jest.Mock).mockRejectedValue(
      new Error("Cross-workspace access denied: User does not have access"),
    );

    render(<RepositoriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/API Connection Warning:/)).toBeInTheDocument();
      expect(
        screen.getByText(/Cross-workspace access denied/),
      ).toBeInTheDocument();
    });
  });
});
