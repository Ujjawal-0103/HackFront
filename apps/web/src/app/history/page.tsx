"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import {
  VerificationHistoryItem,
  RepositoryDetailsDto,
} from "@traceback/shared-types";

export default function HistoryPage() {
  const { activeWorkspace } = useAuth();

  const [items, setItems] = useState<VerificationHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const workspaceId = activeWorkspace?.id;

  // Fetch repositories for filter dropdown
  useEffect(() => {
    async function loadRepos() {
      if (!workspaceId) return;
      try {
        const repos = await api.getRepositories(workspaceId);
        setRepositories(repos);
      } catch {
        // ignore
      }
    }
    loadRepos();
  }, [workspaceId]);

  // Fetch workspace verification history
  const loadHistory = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getWorkspaceHistory(
        workspaceId,
        page,
        limit,
        selectedRepoFilter || undefined,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load verification history: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, limit, selectedRepoFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleExportJson = async (item: VerificationHistoryItem) => {
    try {
      setExportingId(item.id);
      const report = await api.exportReport(
        item.repositoryId,
        item.id,
        activeWorkspace?.id,
      );

      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `traceback-report-${item.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to export report: ${msg}`);
    } finally {
      setExportingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          bg: "rgba(16, 185, 129, 0.12)",
          text: "#059669",
          border: "#10B981",
        };
      case "REVIEWING":
        return {
          bg: "rgba(59, 130, 246, 0.12)",
          text: "#2563EB",
          border: "#3B82F6",
        };
      case "FAILED":
        return {
          bg: "rgba(239, 68, 68, 0.12)",
          text: "#DC2626",
          border: "#EF4444",
        };
      default:
        return {
          bg: "rgba(107, 114, 128, 0.12)",
          text: "#4B5563",
          border: "#6B7280",
        };
    }
  };

  return (
    <main
      id="main-content"
      style={{ maxWidth: "1080px", margin: "2rem auto", padding: "0 1.5rem" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "0.25rem",
            }}
          >
            Verification History & Reports
          </h1>
          <p
            style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}
          >
            Persistent record of all AI explanation verifications, evidence
            citations, and human verdicts
          </p>
        </div>

        <Link
          href="/verify"
          style={{
            padding: "0.55rem 1rem",
            backgroundColor: "var(--color-primary)",
            color: "#FFFFFF",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span>➕</span>
          <span>New Verification</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          backgroundColor: "var(--color-surface)",
          padding: "0.85rem 1.25rem",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            Filter by Repository:
          </span>
          <select
            value={selectedRepoFilter}
            onChange={(e) => {
              setSelectedRepoFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              outline: "none",
            }}
          >
            <option value="">All Repositories</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginLeft: "auto",
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Showing <strong>{items.length}</strong> of <strong>{total}</strong>{" "}
          verifications
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.85rem 1.25rem",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid var(--color-contradicted)",
            borderRadius: "8px",
            color: "var(--color-contradicted)",
            fontSize: "0.9rem",
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </div>
      )}

      {/* History List */}
      {isLoading ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
          }}
        >
          Loading verification history...
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: "3.5rem 2rem",
            textAlign: "center",
            backgroundColor: "var(--color-surface)",
            border: "1px dashed var(--color-border)",
            borderRadius: "10px",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            No Verifications Found
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              maxWidth: "400px",
              margin: "0 auto 1.25rem auto",
            }}
          >
            Submit an AI-generated explanation to extract claims, retrieve
            historical Git evidence, and save your results.
          </p>
          <Link
            href="/verify"
            style={{
              padding: "0.55rem 1.25rem",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Start Your First Verification
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {items.map((item) => {
            const statusStyle = getStatusColor(item.status);

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  padding: "1.25rem 1.5rem",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: "1rem",
                          color: "var(--color-text)",
                        }}
                      >
                        {item.repositoryFullName}
                      </h3>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "9999px",
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.border}`,
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Verified on {new Date(item.createdAt).toLocaleString()} •
                      ID: <code>{item.id}</code>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link
                      href={`/verify?sessionId=${item.id}&repoId=${item.repositoryId}`}
                      style={{
                        padding: "0.45rem 0.85rem",
                        backgroundColor: "var(--color-card-muted)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        color: "var(--color-text)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Open Verification ↗
                    </Link>

                    <button
                      type="button"
                      disabled={exportingId === item.id}
                      onClick={() => handleExportJson(item)}
                      style={{
                        padding: "0.45rem 0.85rem",
                        backgroundColor: "transparent",
                        border: "1px solid var(--color-primary)",
                        color: "var(--color-primary)",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor:
                          exportingId === item.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {exportingId === item.id
                        ? "Exporting..."
                        : "Export JSON 📥"}
                    </button>
                  </div>
                </div>

                {/* Explanation snippet */}
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--color-text)",
                    margin: 0,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  &ldquo;{item.explanation}&rdquo;
                </p>

                {/* Metrics bar */}
                <div
                  style={{
                    display: "flex",
                    gap: "1.25rem",
                    fontSize: "0.8rem",
                    color: "var(--color-text-secondary)",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "0.5rem",
                  }}
                >
                  <span>
                    Claims: <strong>{item.claimsCount}</strong>
                  </span>
                  <span>
                    Human Reviews:{" "}
                    <strong
                      style={{
                        color:
                          item.humanReviewedCount > 0
                            ? "var(--color-success)"
                            : "inherit",
                      }}
                    >
                      {item.humanReviewedCount} / {item.claimsCount}
                    </strong>
                  </span>
                  {item.targetFilePath && (
                    <span>
                      File: <code>{item.targetFilePath}</code>
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {total > limit && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.85rem",
                  color: "var(--color-text)",
                }}
              >
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / limit)}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                  cursor:
                    page >= Math.ceil(total / limit)
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
