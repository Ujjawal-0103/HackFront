"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import {
  RepositoryDetailsDto,
  GitHubAuthorizedRepositoryDto,
  GitHubIntegrationStatusDto,
  RepositoryActivityDto,
  RepositorySyncStatusResponse,
} from "@traceback/shared-types";

export default function RepositoriesPage() {
  const { user, activeWorkspace, isLoading: authLoading } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [authorizedRepos, setAuthorizedRepos] = useState<
    GitHubAuthorizedRepositoryDto[]
  >([]);
  const [gitHubStatus, setGitHubStatus] =
    useState<GitHubIntegrationStatusDto | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorizedError, setAuthorizedError] = useState<string | null>(null);

  // Syncing states per repository ID
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [projectingMap, setProjectingMap] = useState<Record<string, boolean>>(
    {},
  );

  // Expandable activity preview per repository ID
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [activityData, setActivityData] =
    useState<RepositoryActivityDto | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Sync details modal/panel
  const [syncStatusData, setSyncStatusData] =
    useState<RepositorySyncStatusResponse | null>(null);

  // Connect repository modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState(false);
  const [manualInstallationId, setManualInstallationId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchRepositories = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      setError(null);
      const repos = await api.getRepositories(workspaceId);
      setRepositories(repos);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const fetchStatus = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setStatusLoading(true);
      const status = await api.getGitHubStatus(workspaceId);
      setGitHubStatus(status);
    } catch {
      // Non-fatal if status endpoint fails
    } finally {
      setStatusLoading(false);
    }
  }, [workspaceId]);

  const fetchAuthorizedRepos = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setAuthorizedError(null);
      const list = await api.getAuthorizedGitHubRepositories(workspaceId);
      setAuthorizedRepos(list);
    } catch (err: any) {
      const msg =
        (typeof err === "string" ? err : null) ||
        err?.message ||
        (err ? String(err) : "Failed to load authorized repositories");
      setAuthorizedError(msg);
      setAuthorizedRepos([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      fetchRepositories();
      fetchStatus();
      fetchAuthorizedRepos();
    }
  }, [workspaceId, fetchRepositories, fetchStatus, fetchAuthorizedRepos]);

  // Handle manual installation ID link
  const handleLinkInstallation = async (instId: number) => {
    if (!workspaceId || !instId) return;
    try {
      setIsLinking(true);
      await api.connectGitHubInstallation(workspaceId, {
        installationId: instId,
      });
      await fetchStatus();
      await fetchAuthorizedRepos();
    } catch (err: any) {
      alert(
        `Failed to link GitHub App installation: ${err.message || String(err)}`,
      );
    } finally {
      setIsLinking(false);
    }
  };

  // Handle installation disconnect
  const handleDisconnectInstallation = async () => {
    if (!workspaceId) return;
    if (
      !confirm(
        "Are you sure you want to disconnect this GitHub App installation from this workspace?",
      )
    ) {
      return;
    }
    try {
      setIsDisconnecting(true);
      await api.disconnectGitHubInstallation(workspaceId);
      setAuthorizedRepos([]);
      await fetchStatus();
    } catch (err: any) {
      alert(
        `Failed to disconnect installation: ${err.message || String(err)}`,
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle manual sync trigger
  const handleTriggerSync = async (repoId: string) => {
    setSyncingMap((prev) => ({ ...prev, [repoId]: true }));
    try {
      await api.triggerSync(repoId);
      // Refresh status after triggering
      await fetchRepositories();
    } catch (err) {
      alert(
        `Failed to trigger sync: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSyncingMap((prev) => ({ ...prev, [repoId]: false }));
    }
  };

  // Handle canonical SourceRecord projection
  const handleProjectEvidence = async (repoId: string) => {
    setProjectingMap((prev) => ({ ...prev, [repoId]: true }));
    try {
      const res = await api.projectEvidence(repoId);
      alert(
        `Projection complete: ${res.totalProjected} canonical SourceRecords generated (${res.commitsProjected} commits, ${res.pullRequestsProjected} PRs, ${res.issuesProjected} issues).`,
      );
      await fetchRepositories();
    } catch (err) {
      alert(
        `Projection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setProjectingMap((prev) => ({ ...prev, [repoId]: false }));
    }
  };

  // View activity preview
  const handleViewActivity = async (repoId: string) => {
    if (selectedRepoId === repoId) {
      setSelectedRepoId(null);
      setActivityData(null);
      return;
    }
    setSelectedRepoId(repoId);
    setLoadingActivity(true);
    try {
      const data = await api.getRepositoryActivity(repoId);
      setActivityData(data);
      const syncStatus = await api.getSyncStatus(repoId);
      setSyncStatusData(syncStatus);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Connect / Import repository
  const handleImportRepo = async (ghRepo: GitHubAuthorizedRepositoryDto) => {
    setConnectingRepo(true);
    try {
      await api.createRepository({
        fullName: ghRepo.fullName,
        defaultBranch: ghRepo.defaultBranch,
        isPrivate: ghRepo.isPrivate,
      });
      setShowConnectModal(false);
      await fetchRepositories();
    } catch (err) {
      alert(
        `Failed to import repository: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setConnectingRepo(false);
    }
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "COMPLETED":
        return {
          label: "Synced",
          color: "var(--color-success)",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "SYNCING":
        return {
          label: "Syncing...",
          color: "var(--color-primary)",
          bg: "rgba(37, 99, 235, 0.12)",
        };
      case "FAILED":
        return {
          label: "Failed",
          color: "var(--color-error)",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      default:
        return {
          label: "Pending Initial Sync",
          color: "var(--color-warning)",
          bg: "rgba(245, 158, 11, 0.12)",
        };
    }
  };

  if (authLoading) {
    return (
      <main
        id="main-content"
        style={{
          padding: "4rem 2rem",
          maxWidth: "800px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            color: "var(--color-text)",
          }}
        >
          Initializing Session...
        </h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Verifying authentication state and workspace credentials.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        id="main-content"
        style={{
          padding: "4rem 2rem",
          maxWidth: "800px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            padding: "3rem 2rem",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              marginBottom: "0.5rem",
              color: "var(--color-text)",
            }}
          >
            Authentication Required
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              maxWidth: "500px",
              margin: "0 auto 2rem auto",
              fontSize: "0.9375rem",
              lineHeight: 1.5,
            }}
          >
            You must be signed in to manage, synchronize, and connect repositories
            for a workspace.
          </p>
          <Link
            href="/login?returnTo=/repositories"
            style={{
              display: "inline-block",
              padding: "0.75rem 2rem",
              borderRadius: "8px",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.9375rem",
            }}
          >
            Sign In to Continue
          </Link>
        </div>
      </main>
    );
  }

  if (!workspaceId) {
    return (
      <main
        id="main-content"
        style={{
          padding: "4rem 2rem",
          maxWidth: "800px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            padding: "3rem 2rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              marginBottom: "0.5rem",
              color: "var(--color-text)",
            }}
          >
            No Active Workspace
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Please select an active workspace from the navigation bar or settings
            to manage repositories.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      style={{
        padding: "2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Page Title & Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--color-text)",
              marginBottom: "0.25rem",
            }}
          >
            Repositories & Ingestion
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Workspace: <strong>{activeWorkspace?.name || workspaceId}</strong> (
            <code>{workspaceId}</code>)
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => {
              fetchRepositories();
              fetchStatus();
              fetchAuthorizedRepos();
            }}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              backgroundColor: "var(--color-card-muted)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "0.875rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowConnectModal(true)}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary)",
              border: "none",
              color: "#FFFFFF",
              fontSize: "0.875rem",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            + Connect Repository
          </button>
        </div>
      </div>

      {/* GitHub App Integration Status Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.25rem",
          backgroundColor: gitHubStatus?.installation
            ? "rgba(34, 197, 94, 0.08)"
            : gitHubStatus?.isMockMode
              ? "rgba(245, 158, 11, 0.08)"
              : "var(--color-card-muted)",
          border: `1px solid ${
            gitHubStatus?.installation
              ? "var(--color-success)"
              : gitHubStatus?.isMockMode
                ? "var(--color-warning)"
                : "var(--color-border)"
          }`,
          borderRadius: "8px",
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>
            {gitHubStatus?.installation
              ? "🟢"
              : gitHubStatus?.isMockMode
                ? "🟡"
                : "⚪"}
          </span>
          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
            {gitHubStatus?.installation
              ? `GitHub App Connected: ${gitHubStatus.installation.accountLogin} (#${gitHubStatus.installation.installationId})`
              : gitHubStatus?.isMockMode
                ? "Development Mock Sandbox (Live credentials unconfigured)"
                : gitHubStatus?.isConfigured
                  ? "GitHub App Configured (No installation connected to this workspace)"
                  : "GitHub App Unconfigured (Live credentials missing in environment)"}
          </span>
        </div>

        {gitHubStatus?.installation && (
          <button
            onClick={handleDisconnectInstallation}
            disabled={isDisconnecting}
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
              cursor: isDisconnecting ? "default" : "pointer",
            }}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect Installation"}
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid var(--color-error)",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1.5rem",
            color: "var(--color-error)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>API Connection Warning:</strong> {error}
          </div>
          <button
            onClick={fetchRepositories}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "4px",
              backgroundColor: "var(--color-error)",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            backgroundColor: "var(--color-surface)",
            borderRadius: "12px",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            Loading repository records...
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Connecting to PostgreSQL database and GitHub ingestion services.
          </p>
        </div>
      ) : repositories.length === 0 ? (
        /* Empty State */
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            backgroundColor: "var(--color-surface)",
            borderRadius: "12px",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--color-card-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
              fontSize: "1.5rem",
            }}
          >
            📦
          </div>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            No Repositories Connected Yet
          </h3>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              maxWidth: "500px",
              margin: "0 auto 1.5rem auto",
            }}
          >
            Connect an authorized GitHub repository to ingest commits, pull
            requests, issues, and project canonical evidence records for
            rationale verification.
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            style={{
              padding: "0.6rem 1.5rem",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Import Authorized Repository
          </button>
        </div>
      ) : (
        /* Repository Cards List */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {repositories.map((repo) => {
            const badge = getStatusBadge(repo.latestSyncJob?.status);
            const isSyncing =
              syncingMap[repo.id] || repo.latestSyncJob?.status === "SYNCING";
            const isProjecting = projectingMap[repo.id];
            const isExpanded = selectedRepoId === repo.id;

            return (
              <div
                key={repo.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  padding: "1.5rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: "var(--color-text)",
                        }}
                      >
                        {repo.fullName}
                      </h2>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          backgroundColor: repo.isPrivate
                            ? "var(--color-card-muted)"
                            : "rgba(37, 99, 235, 0.1)",
                          color: repo.isPrivate
                            ? "var(--color-text-secondary)"
                            : "var(--color-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {repo.isPrivate ? "Private" : "Public"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          backgroundColor: badge.bg,
                          color: badge.color,
                          fontWeight: 600,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        display: "flex",
                        gap: "1.25rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        Branch: <code>{repo.defaultBranch}</code>
                      </span>
                      <span>
                        Last Index:{" "}
                        {repo.indexedAt
                          ? new Date(repo.indexedAt).toLocaleString()
                          : "Never"}
                      </span>
                      <span>
                        ID: <code>{repo.id.slice(0, 8)}</code>
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => handleTriggerSync(repo.id)}
                      disabled={isSyncing}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        backgroundColor: isSyncing
                          ? "var(--color-card-muted)"
                          : "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor: isSyncing ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSyncing ? "Syncing..." : "↻ Trigger Sync"}
                    </button>

                    <button
                      onClick={() => handleProjectEvidence(repo.id)}
                      disabled={isProjecting}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-card-muted)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor: isProjecting ? "not-allowed" : "pointer",
                      }}
                    >
                      {isProjecting ? "Projecting..." : "⚡ Project Evidence"}
                    </button>

                    <Link
                      href={`/evidence?repo=${repo.id}`}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-primary)",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      🔍 Explore Evidence
                    </Link>

                    <button
                      onClick={() => handleViewActivity(repo.id)}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        backgroundColor: isExpanded
                          ? "var(--color-card-muted)"
                          : "transparent",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Hide Details" : "View Details ▾"}
                    </button>
                  </div>
                </div>

                {/* Counts Bar */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    backgroundColor: "var(--color-card-muted)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Commits
                    </div>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      {repo.counts.commits}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Pull Requests
                    </div>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      {repo.counts.pullRequests}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Issues
                    </div>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      {repo.counts.issues}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Source Records
                    </div>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--color-primary)",
                      }}
                    >
                      {repo.counts.sourceRecords}
                    </div>
                  </div>
                </div>

                {/* Latest Sync Error Message */}
                {repo.latestSyncJob?.errorMessage && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid var(--color-error)",
                      fontSize: "0.8125rem",
                      color: "var(--color-error)",
                    }}
                  >
                    <strong>Sync Error:</strong>{" "}
                    {repo.latestSyncJob.errorMessage}
                  </div>
                )}

                {/* Expandable Activity & Ingestion Preview */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "1.5rem",
                      borderTop: "1px solid var(--color-border)",
                      paddingTop: "1.5rem",
                    }}
                  >
                    {loadingActivity ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.875rem",
                        }}
                      >
                        Loading recent repository activity...
                      </div>
                    ) : (
                      <div>
                        {/* Sync History Status */}
                        {syncStatusData && (
                          <div style={{ marginBottom: "1.5rem" }}>
                            <h4
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Sync Job History
                            </h4>
                            {syncStatusData.recentJobs.length === 0 ? (
                              <p
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                No completed sync jobs recorded.
                              </p>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                {syncStatusData.recentJobs.map((job) => (
                                  <div
                                    key={job.id}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "0.5rem 0.75rem",
                                      backgroundColor:
                                        "var(--color-card-muted)",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    <div>
                                      <strong>Trigger:</strong> {job.trigger} |{" "}
                                      <strong>Status:</strong> {job.status} |{" "}
                                      <strong>Started:</strong>{" "}
                                      {job.startedAt
                                        ? new Date(
                                            job.startedAt,
                                          ).toLocaleTimeString()
                                        : "N/A"}
                                    </div>
                                    <div>
                                      {job.counts.commits} commits,{" "}
                                      {job.counts.pullRequests} PRs,{" "}
                                      {job.counts.issues} issues
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Recent Activity Grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          {/* Commits Preview */}
                          <div
                            style={{
                              border: "1px solid var(--color-border)",
                              borderRadius: "8px",
                              padding: "1rem",
                            }}
                          >
                            <h4
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: "0.75rem",
                              }}
                            >
                              Recent Commits (
                              {activityData?.commits.length || 0})
                            </h4>
                            {activityData?.commits.length === 0 ? (
                              <p
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                No commits imported yet. Run sync to ingest.
                              </p>
                            ) : (
                              <ul
                                style={{
                                  listStyle: "none",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                {activityData?.commits.map((c) => (
                                  <li
                                    key={c.sha}
                                    style={{
                                      fontSize: "0.8125rem",
                                      borderBottom:
                                        "1px solid var(--color-border)",
                                      paddingBottom: "0.4rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "0.2rem",
                                      }}
                                    >
                                      <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontFamily: "monospace",
                                          fontWeight: 600,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {c.sha.slice(0, 7)} ↗
                                      </a>
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "var(--color-text-secondary)",
                                        }}
                                      >
                                        {new Date(
                                          c.committedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--color-text)",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {c.message.split("\n")[0]}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Pull Requests Preview */}
                          <div
                            style={{
                              border: "1px solid var(--color-border)",
                              borderRadius: "8px",
                              padding: "1rem",
                            }}
                          >
                            <h4
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: "0.75rem",
                              }}
                            >
                              Recent Pull Requests (
                              {activityData?.pullRequests.length || 0})
                            </h4>
                            {activityData?.pullRequests.length === 0 ? (
                              <p
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                No pull requests imported yet.
                              </p>
                            ) : (
                              <ul
                                style={{
                                  listStyle: "none",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                {activityData?.pullRequests.map((pr) => (
                                  <li
                                    key={pr.number}
                                    style={{
                                      fontSize: "0.8125rem",
                                      borderBottom:
                                        "1px solid var(--color-border)",
                                      paddingBottom: "0.4rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "0.2rem",
                                      }}
                                    >
                                      <a
                                        href={pr.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        #{pr.number} ↗
                                      </a>
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "0.1rem 0.4rem",
                                          borderRadius: "3px",
                                          backgroundColor: pr.isMerged
                                            ? "rgba(168, 85, 247, 0.15)"
                                            : "rgba(34, 197, 94, 0.15)",
                                          color: pr.isMerged
                                            ? "#7E22CE"
                                            : "var(--color-success)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {pr.isMerged ? "Merged" : pr.state}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--color-text)",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {pr.title}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Issues Preview */}
                          <div
                            style={{
                              border: "1px solid var(--color-border)",
                              borderRadius: "8px",
                              padding: "1rem",
                            }}
                          >
                            <h4
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: "0.75rem",
                              }}
                            >
                              Recent Issues ({activityData?.issues.length || 0})
                            </h4>
                            {activityData?.issues.length === 0 ? (
                              <p
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                No issues imported yet.
                              </p>
                            ) : (
                              <ul
                                style={{
                                  listStyle: "none",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                {activityData?.issues.map((issue) => (
                                  <li
                                    key={issue.number}
                                    style={{
                                      fontSize: "0.8125rem",
                                      borderBottom:
                                        "1px solid var(--color-border)",
                                      paddingBottom: "0.4rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "0.2rem",
                                      }}
                                    >
                                      <a
                                        href={issue.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        #{issue.number} ↗
                                      </a>
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "0.1rem 0.4rem",
                                          borderRadius: "3px",
                                          backgroundColor:
                                            issue.state === "open"
                                              ? "rgba(34, 197, 94, 0.15)"
                                              : "rgba(100, 116, 139, 0.15)",
                                          color:
                                            issue.state === "open"
                                              ? "var(--color-success)"
                                              : "var(--color-text-secondary)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {issue.state}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--color-text)",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {issue.title}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Repository Modal */}
      {showConnectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                }}
              >
                Connect Authorized Repository
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                }}
              >
                ✕
              </button>
            </div>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                marginBottom: "1.25rem",
              }}
            >
              Import repositories from an authorized GitHub App installation into
              workspace <code>{workspaceId}</code>:
            </p>

            {/* Error in modal if fetching authorized repos failed */}
            {authorizedError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid var(--color-error)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  color: "var(--color-error)",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>API Error:</strong> {authorizedError}
                </div>
                <button
                  onClick={fetchAuthorizedRepos}
                  style={{
                    padding: "0.2rem 0.5rem",
                    backgroundColor: "var(--color-error)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Sub-state: GitHub App completely unconfigured */}
            {!gitHubStatus?.isConfigured && !gitHubStatus?.isMockMode ? (
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  color: "var(--color-text)",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                  GitHub App Not Configured
                </div>
                <p
                  style={{
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.4,
                  }}
                >
                  The system administrator has not configured live GitHub App
                  credentials (<code>GITHUB_APP_ID</code> and{" "}
                  <code>GITHUB_APP_PRIVATE_KEY</code>). Please refer to the
                  setup guide in <code>docs/integrations/GITHUB_APP_SETUP.md</code>.
                </p>
              </div>
            ) : !gitHubStatus?.installation && gitHubStatus?.isConfigured ? (
              /* Sub-state: Configured but not yet installed on this workspace */
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "8px",
                  marginBottom: "1.5rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--color-text)",
                  }}
                >
                  GitHub App Installation Required
                </div>
                <p
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "0.875rem",
                    lineHeight: 1.4,
                    marginBottom: "1rem",
                  }}
                >
                  To authorize repositories, install the Traceback GitHub App on
                  your personal account or GitHub organization.
                </p>
                {gitHubStatus.installUrl && (
                  <a
                    href={gitHubStatus.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--color-primary)",
                      color: "#FFFFFF",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      marginBottom: "1rem",
                    }}
                  >
                    Install GitHub App on GitHub ↗
                  </a>
                )}
                <div
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.4rem",
                    }}
                  >
                    Or link an existing GitHub installation ID:
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      placeholder="e.g. 12345678"
                      value={manualInstallationId}
                      onChange={(e) => setManualInstallationId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.4rem 0.6rem",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
                        fontSize: "0.875rem",
                      }}
                    />
                    <button
                      onClick={() =>
                        handleLinkInstallation(Number(manualInstallationId))
                      }
                      disabled={isLinking || !manualInstallationId}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-primary)",
                        color: "#FFFFFF",
                        border: "none",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor:
                          isLinking || !manualInstallationId
                            ? "default"
                            : "pointer",
                      }}
                    >
                      {isLinking ? "Linking..." : "Link"}
                    </button>
                  </div>
                </div>
              </div>
            ) : !gitHubStatus?.installation && gitHubStatus?.isMockMode ? (
              /* Sub-state: Mock sandbox mode without installation */
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "8px",
                  marginBottom: "1.5rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--color-text)",
                  }}
                >
                  Development Mock Sandbox
                </div>
                <p
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "0.875rem",
                    lineHeight: 1.4,
                    marginBottom: "1rem",
                  }}
                >
                  Live GitHub credentials are unconfigured. You can connect the
                  development sandbox installation (ID 1001) to test importing
                  mock repositories.
                </p>
                <button
                  onClick={() => handleLinkInstallation(1001)}
                  disabled={isLinking}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    backgroundColor: "var(--color-primary)",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: isLinking ? "default" : "pointer",
                  }}
                >
                  {isLinking
                    ? "Connecting..."
                    : "Connect Development Sandbox (1001)"}
                </button>
              </div>
            ) : authorizedRepos.length === 0 ? (
              /* Sub-state: Installation connected, but zero repos accessible */
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                {gitHubStatus?.installation
                  ? `No accessible repositories found in GitHub installation #${gitHubStatus.installation.installationId} (${gitHubStatus.installation.accountLogin}). Verify repository access grants in your GitHub App installation settings.`
                  : "No authorized repositories found or GitHub App is in sandbox mode."}
              </div>
            ) : (
              /* Sub-state: Repositories available for import */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  marginBottom: "1.5rem",
                }}
              >
                {authorizedRepos.map((gh) => {
                  const alreadyAdded = repositories.some(
                    (r) =>
                      r.fullName.toLowerCase() === gh.fullName.toLowerCase(),
                  );
                  return (
                    <div
                      key={gh.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--color-text)",
                            fontSize: "0.9375rem",
                          }}
                        >
                          {gh.fullName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          Default branch: {gh.defaultBranch} •{" "}
                          {gh.isPrivate ? "Private" : "Public"}
                        </div>
                      </div>

                      <button
                        onClick={() => handleImportRepo(gh)}
                        disabled={alreadyAdded || connectingRepo}
                        style={{
                          padding: "0.4rem 0.85rem",
                          borderRadius: "6px",
                          backgroundColor: alreadyAdded
                            ? "var(--color-card-muted)"
                            : "var(--color-primary)",
                          color: alreadyAdded
                            ? "var(--color-text-secondary)"
                            : "#FFFFFF",
                          border: "none",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          cursor: alreadyAdded ? "default" : "pointer",
                        }}
                      >
                        {alreadyAdded ? "Connected" : "Import"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConnectModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
