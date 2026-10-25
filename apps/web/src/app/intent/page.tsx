"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../lib/api";
import {
  RepositoryDetailsDto,
  HistoricalIntentOutcome,
  HumanDisposition,
  IntentConflictItem,
  HistoricalIntentCheckSessionDto,
} from "@traceback/shared-types";

function HistoricalIntentContent() {
  const { activeWorkspace, user } = useAuth();

  // Repository & Input state
  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [filePath, setFilePath] = useState<string>("");
  const [changeDescription, setChangeDescription] = useState<string>("");

  // Workflow state
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] =
    useState<HistoricalIntentCheckSessionDto | null>(null);
  const [pastSessions, setPastSessions] = useState<
    HistoricalIntentCheckSessionDto[]
  >([]);
  const [isLoadingPastSessions, setIsLoadingPastSessions] = useState(false);

  // Human disposition state
  const [disposition, setDisposition] =
    useState<HumanDisposition>("NEEDS_DISCUSSION");
  const [dispositionNotes, setDispositionNotes] = useState<string>("");
  const [isSavingDisposition, setIsSavingDisposition] = useState(false);
  const [dispositionFeedback, setDispositionFeedback] = useState<string | null>(
    null,
  );

  // Load repositories
  const loadRepositories = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      setIsLoadingRepos(true);
      setError(null);
      const repos = await api.getRepositories(activeWorkspace.id);
      setRepositories(repos);
      if (repos.length > 0 && !selectedRepoId) {
        setSelectedRepoId(repos[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load repositories: ${msg}`);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [activeWorkspace?.id, selectedRepoId]);

  // Load past intent sessions
  const loadPastSessions = useCallback(
    async (repoId: string) => {
      if (!activeWorkspace?.id || !repoId) return;
      try {
        setIsLoadingPastSessions(true);
        const sessions = await api.getIntentChecks(repoId, activeWorkspace.id);
        setPastSessions(sessions);
      } catch {
        // Non-fatal if history is empty
      } finally {
        setIsLoadingPastSessions(false);
      }
    },
    [activeWorkspace?.id],
  );

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    if (selectedRepoId) {
      loadPastSessions(selectedRepoId);
    }
  }, [selectedRepoId, loadPastSessions]);

  const handleRunIntentCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) {
      setError("Please select a repository to evaluate.");
      return;
    }
    if (!diff.trim() && !changeDescription.trim()) {
      setError("Please provide a proposed git diff or change description.");
      return;
    }

    try {
      setIsChecking(true);
      setError(null);
      setDispositionFeedback(null);

      const result = await api.runIntentCheck(
        selectedRepoId,
        {
          diff: diff.trim(),
          filePath: filePath.trim() || undefined,
          changeDescription: changeDescription.trim() || undefined,
        },
        activeWorkspace?.id,
      );

      setCurrentSession(result);
      if (result.humanDisposition) {
        setDisposition(result.humanDisposition);
      }
      if (result.dispositionNotes) {
        setDispositionNotes(result.dispositionNotes);
      }

      // Refresh past sessions
      loadPastSessions(selectedRepoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Intent check failed: ${msg}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveDisposition = async () => {
    if (!currentSession || !selectedRepoId) return;
    try {
      setIsSavingDisposition(true);
      setDispositionFeedback(null);
      const updated = await api.recordIntentDisposition(
        selectedRepoId,
        currentSession.id,
        disposition,
        dispositionNotes,
        activeWorkspace?.id,
      );
      setCurrentSession(updated);
      setDispositionFeedback(
        `Disposition "${disposition}" recorded successfully.`,
      );
      loadPastSessions(selectedRepoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save disposition: ${msg}`);
    } finally {
      setIsSavingDisposition(false);
    }
  };

  const loadSession = async (session: HistoricalIntentCheckSessionDto) => {
    setCurrentSession(session);
    setDiff(session.diff || "");
    setFilePath(session.filePath || "");
    setChangeDescription(session.changeDescription || "");
    if (session.humanDisposition) {
      setDisposition(session.humanDisposition);
    }
    if (session.dispositionNotes) {
      setDispositionNotes(session.dispositionNotes);
    }
  };

  const getOutcomeBadge = (outcome: HistoricalIntentOutcome) => {
    switch (outcome) {
      case "DOCUMENTED_CONFLICT":
        return {
          label: "Documented Conflict",
          bg: "rgba(239, 68, 68, 0.12)",
          color: "#DC2626",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          icon: "⚠️",
        };
      case "POTENTIAL_CONFLICT":
        return {
          label: "Potential Conflict",
          bg: "rgba(245, 158, 11, 0.12)",
          color: "#D97706",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          icon: "⚡",
        };
      case "NO_KNOWN_CONFLICT":
        return {
          label: "No Known Conflict",
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          icon: "✓",
        };
      case "INSUFFICIENT_CONTEXT":
      default:
        return {
          label: "Insufficient Context",
          bg: "rgba(107, 114, 128, 0.12)",
          color: "#4B5563",
          border: "1px solid rgba(107, 114, 128, 0.3)",
          icon: "?",
        };
    }
  };

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "1280px",
        margin: "1.5rem auto",
        padding: "0 1.5rem",
      }}
    >
      {/* Studio Header */}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>⚡</span>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Historical Intent Studio
            </h1>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
              }}
            >
              Core Pillar
            </span>
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Evaluate prospective code changes against historical ADRs, past
            reversions, and reviewed engineering constraints.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/decisions"
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "0.825rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🏛️ Engineering Decision Memory
          </Link>
          <Link
            href="/verify"
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "0.825rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🔍 Verify Explanation
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "var(--color-error-light)",
            border: "1px solid var(--color-error)",
            borderRadius: "6px",
            color: "var(--color-error)",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Main Grid: Input & Sessions Sidebar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Form & Results */}
        <div>
          {/* Input Card */}
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "1.25rem",
              boxShadow: "var(--shadow-sm)",
              marginBottom: "1.5rem",
            }}
          >
            <form onSubmit={handleRunIntentCheck}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <label
                    htmlFor="intent-repo-select"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Target Repository
                  </label>
                  <select
                    id="intent-repo-select"
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    disabled={isLoadingRepos || isChecking}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-text)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {repositories.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} ({r.defaultBranch})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="intent-filepath-input"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Target File Path (Optional)
                  </label>
                  <input
                    id="intent-filepath-input"
                    type="text"
                    placeholder="e.g. src/auth/session.guard.ts"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    disabled={isChecking}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-text)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="intent-diff-input"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Proposed Git Diff / Unified Patch
                </label>
                <textarea
                  id="intent-diff-input"
                  rows={6}
                  placeholder="Paste git diff (e.g. --- a/src/guard.ts +++ b/src/guard.ts ...)"
                  value={diff}
                  onChange={(e) => setDiff(e.target.value)}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                    resize: "vertical",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  <span>
                    Evaluated against historical ADRs, reverts, and accepted
                    decisions
                  </span>
                  <span>{diff.length} / 25,000 chars</span>
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  htmlFor="intent-desc-input"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Proposed Change Description / Rationale
                </label>
                <textarea
                  id="intent-desc-input"
                  rows={2}
                  placeholder="Briefly describe what this change intends to achieve or why it is proposed..."
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                {currentSession && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSession(null);
                      setDiff("");
                      setFilePath("");
                      setChangeDescription("");
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "transparent",
                      color: "var(--color-text)",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  id="btn-run-intent-check"
                  disabled={isChecking || !selectedRepoId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: isChecking ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  {isChecking
                    ? "Checking Historical Intent..."
                    : "⚡ Run Intent Check"}
                </button>
              </div>
            </form>
          </div>

          {/* Results Area */}
          {currentSession && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* Outcome Banner */}
              {(() => {
                const badge = getOutcomeBadge(currentSession.outcome);
                return (
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "8px",
                      backgroundColor: badge.bg,
                      border: badge.border,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.85rem",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
                      {badge.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          Checked on{" "}
                          {new Date(
                            currentSession.createdAt,
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "var(--color-text)",
                          margin: 0,
                        }}
                      >
                        {currentSession.summary}
                      </p>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-text-muted)",
                          marginTop: "0.4rem",
                          fontStyle: "italic",
                        }}
                      >
                        Notice: Traceback analysis is purely advisory. Traceback
                        does not block merges or alter repository source code.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Detected Conflicts / Constraints List */}
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <h2
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    Historical Constraints & Invariants (
                    {currentSession.conflicts.length})
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 400,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Verified against Repository Engineering History
                  </span>
                </h2>

                {currentSession.conflicts.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      border: "1px dashed var(--color-border)",
                      borderRadius: "6px",
                      color: "var(--color-text-secondary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No documented historical conflicts or invariant violations
                    detected for this scope.
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                        marginTop: "0.25rem",
                      }}
                    >
                      Absence of a recorded conflict does not prove that a code
                      modification is free of defect.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {currentSession.conflicts.map((conflict, cIdx) => (
                      <div
                        key={cIdx}
                        style={{
                          border: "1px solid var(--color-border)",
                          borderRadius: "6px",
                          padding: "1rem",
                          backgroundColor: "var(--color-card-muted)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor:
                                  conflict.severity === "HIGH"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : "rgba(245, 158, 11, 0.15)",
                                color:
                                  conflict.severity === "HIGH"
                                    ? "#DC2626"
                                    : "#D97706",
                              }}
                            >
                              {conflict.severity} SEVERITY
                            </span>
                            <strong
                              style={{
                                fontSize: "0.9rem",
                                color: "var(--color-text)",
                              }}
                            >
                              {conflict.title}
                            </strong>
                          </div>
                        </div>

                        <p
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--color-text)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {conflict.rationale}
                        </p>

                        {conflict.unestablishedContext && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-text-secondary)",
                              fontStyle: "italic",
                              marginBottom: "0.5rem",
                            }}
                          >
                            Basis: {conflict.unestablishedContext}
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: "0.8rem",
                            backgroundColor: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "4px",
                            padding: "0.5rem 0.75rem",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <strong>Recommendation:</strong>{" "}
                          {conflict.recommendedReview}
                        </div>

                        {/* Supporting Evidence Citations */}
                        {conflict.supportingEvidence &&
                          conflict.supportingEvidence.length > 0 && (
                            <div>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  color: "var(--color-text-muted)",
                                }}
                              >
                                Underlying Evidence Citations:
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.35rem",
                                  marginTop: "0.35rem",
                                }}
                              >
                                {conflict.supportingEvidence.map(
                                  (ev, evIdx) => (
                                    <div
                                      key={evIdx}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "0.6rem",
                                          fontWeight: 700,
                                          padding: "1px 5px",
                                          borderRadius: "3px",
                                          backgroundColor:
                                            "var(--color-border)",
                                        }}
                                      >
                                        {ev.sourceType}
                                      </span>
                                      {ev.url ? (
                                        <a
                                          href={ev.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            color: "var(--color-primary)",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {ev.referenceKey}: {ev.title} ↗
                                        </a>
                                      ) : (
                                        <span>
                                          {ev.referenceKey}: {ev.title}
                                        </span>
                                      )}
                                      <span
                                        style={{
                                          color: "var(--color-text-muted)",
                                        }}
                                      >
                                        • By {ev.author}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Human Disposition Panel */}
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>👤</span>
                  <h3
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      margin: 0,
                    }}
                  >
                    Human Disposition & Review Decision
                  </h3>
                  {currentSession.humanDisposition && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "var(--color-primary-light)",
                        color: "var(--color-primary)",
                      }}
                    >
                      Current: {currentSession.humanDisposition}
                    </span>
                  )}
                </div>

                {dispositionFeedback && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--color-success-light)",
                      border: "1px solid var(--color-success)",
                      borderRadius: "4px",
                      color: "var(--color-success)",
                      fontSize: "0.8rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    ✓ {dispositionFeedback}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {(
                    [
                      "APPROVED",
                      "REJECTED",
                      "NEEDS_DISCUSSION",
                    ] as HumanDisposition[]
                  ).map((disp) => (
                    <button
                      key={disp}
                      type="button"
                      onClick={() => setDisposition(disp)}
                      style={{
                        padding: "0.45rem 0.85rem",
                        borderRadius: "6px",
                        border:
                          disposition === disp
                            ? "2px solid var(--color-primary)"
                            : "1px solid var(--color-border)",
                        backgroundColor:
                          disposition === disp
                            ? "var(--color-primary-light)"
                            : "transparent",
                        color:
                          disposition === disp
                            ? "var(--color-primary)"
                            : "var(--color-text)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {disp === "APPROVED" && "✓ Approved"}
                      {disp === "REJECTED" && "✗ Rejected"}
                      {disp === "NEEDS_DISCUSSION" && "💬 Needs Discussion"}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Reviewer rationale or follow-up notes for the pull request..."
                  value={dispositionNotes}
                  onChange={(e) => setDispositionNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.8rem",
                    marginBottom: "0.75rem",
                  }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleSaveDisposition}
                    disabled={isSavingDisposition}
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "var(--color-primary)",
                      color: "#FFFFFF",
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      cursor: isSavingDisposition ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSavingDisposition ? "Recording..." : "Save Disposition"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Historical Check Sessions History */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "0.5rem",
            }}
          >
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: 0,
              }}
            >
              Recent Intent Checks
            </h3>
            <span
              style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}
            >
              {pastSessions.length} sessions
            </span>
          </div>

          {isLoadingPastSessions ? (
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
              }}
            >
              Loading sessions...
            </div>
          ) : pastSessions.length === 0 ? (
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
              }}
            >
              No previous intent checks recorded for this repository.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "500px",
                overflowY: "auto",
              }}
            >
              {pastSessions.map((s) => {
                const badge = getOutcomeBadge(s.outcome);
                const isSelected = currentSession?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => loadSession(s)}
                    style={{
                      textAlign: "left",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      border: isSelected
                        ? "1px solid var(--color-primary)"
                        : "1px solid var(--color-border)",
                      backgroundColor: isSelected
                        ? "var(--color-primary-light)"
                        : "var(--color-card-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--color-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.filePath ||
                        (s.changeDescription
                          ? s.changeDescription.slice(0, 30)
                          : "Diff check")}
                    </div>
                    {s.humanDisposition && (
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--color-primary)",
                          marginTop: "0.2rem",
                        }}
                      >
                        Disposition: {s.humanDisposition}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function HistoricalIntentPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", textAlign: "center" }}>
          Loading Historical Intent Studio...
        </div>
      }
    >
      <HistoricalIntentContent />
    </Suspense>
  );
}
