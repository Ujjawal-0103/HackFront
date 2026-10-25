"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../lib/api";
import {
  RepositoryDetailsDto,
  DecisionStatus,
  DecisionSeverity,
  EngineeringDecisionDto,
} from "@traceback/shared-types";

function DecisionMemoryContent() {
  const searchParams = useSearchParams();
  const urlRepoId = searchParams.get("repoId");
  const urlDecisionId = searchParams.get("id");

  const { activeWorkspace, user } = useAuth();

  // Repository state
  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(urlRepoId || "");
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);

  // Decisions state
  const [decisions, setDecisions] = useState<EngineeringDecisionDto[]>([]);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewingDecision, setReviewingDecision] =
    useState<EngineeringDecisionDto | null>(null);
  const [reviewAction, setReviewAction] = useState<
    "ACCEPT" | "REJECT" | "DISPUTE"
  >("ACCEPT");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Create Form state
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newRationale, setNewRationale] = useState("");
  const [newFilePath, setNewFilePath] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newSeverity, setNewSeverity] = useState<DecisionSeverity>("MEDIUM");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

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

  // Load decisions
  const loadDecisions = useCallback(
    async (repoId: string, status?: string) => {
      if (!activeWorkspace?.id || !repoId) return;
      try {
        setIsLoadingDecisions(true);
        setError(null);
        const queryStatus = status && status !== "ALL" ? status : undefined;
        const data = await api.getDecisions(
          repoId,
          queryStatus,
          activeWorkspace.id,
        );
        setDecisions(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to load engineering decisions: ${msg}`);
      } finally {
        setIsLoadingDecisions(false);
      }
    },
    [activeWorkspace?.id],
  );

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    if (selectedRepoId) {
      loadDecisions(selectedRepoId, statusFilter);
    }
  }, [selectedRepoId, statusFilter, loadDecisions]);

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) return;
    try {
      setIsSubmittingCreate(true);
      setError(null);
      await api.createDecision(
        selectedRepoId,
        {
          title: newTitle,
          summary: newSummary,
          decision: newDecision,
          rationale: newRationale,
          targetFilePath: newFilePath || undefined,
          targetSymbol: newSymbol || undefined,
          severity: newSeverity,
          status: "CANDIDATE",
        },
        activeWorkspace?.id,
      );

      setFeedback("Candidate engineering decision created successfully.");
      setIsCreateModalOpen(false);
      // Reset form
      setNewTitle("");
      setNewSummary("");
      setNewDecision("");
      setNewRationale("");
      setNewFilePath("");
      setNewSymbol("");
      loadDecisions(selectedRepoId, statusFilter);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to create decision: ${msg}`);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleExecuteReview = async () => {
    if (!reviewingDecision || !selectedRepoId) return;
    try {
      setIsSubmittingReview(true);
      setError(null);

      if (reviewAction === "ACCEPT") {
        await api.acceptDecision(
          selectedRepoId,
          reviewingDecision.id,
          reviewNotes,
          activeWorkspace?.id,
        );
        setFeedback(
          `Decision "${reviewingDecision.title}" accepted as active constraint.`,
        );
      } else if (reviewAction === "REJECT") {
        await api.rejectDecision(
          selectedRepoId,
          reviewingDecision.id,
          reviewNotes,
          activeWorkspace?.id,
        );
        setFeedback(
          `Decision "${reviewingDecision.title}" rejected and archived.`,
        );
      } else if (reviewAction === "DISPUTE") {
        await api.disputeDecision(
          selectedRepoId,
          reviewingDecision.id,
          reviewNotes,
          activeWorkspace?.id,
        );
        setFeedback(
          `Decision "${reviewingDecision.title}" marked as disputed.`,
        );
      }

      setReviewingDecision(null);
      setReviewNotes("");
      loadDecisions(selectedRepoId, statusFilter);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Review action failed: ${msg}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: DecisionStatus) => {
    switch (status) {
      case "ACCEPTED":
        return {
          label: "Accepted Invariant",
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
        };
      case "CANDIDATE":
        return {
          label: "Candidate",
          bg: "rgba(59, 130, 246, 0.12)",
          color: "#2563EB",
        };
      case "IN_REVIEW":
        return {
          label: "In Review",
          bg: "rgba(245, 158, 11, 0.12)",
          color: "#D97706",
        };
      case "SUPERSEDED":
        return {
          label: "Superseded",
          bg: "rgba(107, 114, 128, 0.12)",
          color: "#4B5563",
        };
      case "DISPUTED":
        return {
          label: "Disputed",
          bg: "rgba(239, 68, 68, 0.12)",
          color: "#DC2626",
        };
      case "ARCHIVED":
      default:
        return {
          label: "Archived",
          bg: "rgba(156, 163, 175, 0.12)",
          color: "#6B7280",
        };
    }
  };

  const getSeverityBadge = (severity: DecisionSeverity) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return { color: "#DC2626", bg: "rgba(239, 68, 68, 0.1)" };
      case "MEDIUM":
        return { color: "#D97706", bg: "rgba(245, 158, 11, 0.1)" };
      case "LOW":
      case "ADVISORY":
      default:
        return { color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" };
    }
  };

  const filteredDecisions = decisions.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.decision.toLowerCase().includes(q) ||
      d.rationale.toLowerCase().includes(q) ||
      (d.targetFilePath && d.targetFilePath.toLowerCase().includes(q)) ||
      (d.targetSymbol && d.targetSymbol.toLowerCase().includes(q))
    );
  });

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "1280px",
        margin: "1.5rem auto",
        padding: "0 1.5rem",
      }}
    >
      {/* Page Header */}
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
            <span style={{ fontSize: "1.25rem" }}>🏛️</span>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Engineering Decision Memory
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
            Preserve human-reviewed engineering decisions and historical
            constraints to verify prospective code changes.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            id="btn-propose-new-decision"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
            }}
          >
            + Propose New Decision
          </button>
          <Link
            href="/intent"
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
            ⚡ Historical Intent Studio
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "var(--color-success-light)",
            border: "1px solid var(--color-success)",
            borderRadius: "6px",
            color: "var(--color-success)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>✓ {feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

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
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Control Bar: Repository Selector, Search & Status Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <select
              id="decisions-repo-select"
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              disabled={isLoadingRepos}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
                fontSize: "0.825rem",
                fontWeight: 600,
              }}
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
            {[
              "ALL",
              "ACCEPTED",
              "CANDIDATE",
              "IN_REVIEW",
              "SUPERSEDED",
              "DISPUTED",
            ].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "4px",
                  border:
                    statusFilter === st
                      ? "1px solid var(--color-primary)"
                      : "1px solid transparent",
                  backgroundColor:
                    statusFilter === st
                      ? "var(--color-primary-light)"
                      : "transparent",
                  color:
                    statusFilter === st
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={{ minWidth: "220px" }}>
          <input
            type="search"
            placeholder="Search decisions, symbols, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
              fontSize: "0.8rem",
            }}
          />
        </div>
      </div>

      {/* Decision Cards List */}
      {isLoadingDecisions ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          Loading engineering decisions...
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            backgroundColor: "var(--color-surface)",
            border: "1px dashed var(--color-border)",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏛️</div>
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "0.25rem",
            }}
          >
            No engineering decisions found
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              maxWidth: "450px",
              margin: "0 auto 1rem auto",
            }}
          >
            Engineering decisions represent human-reviewed architectural
            constraints. Propose a new decision manually or derive one from a
            verified claim.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Propose First Decision Candidate
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredDecisions.map((dec) => {
            const stBadge = getStatusBadge(dec.status);
            const sevBadge = getSeverityBadge(dec.severity);
            const isTargeted = urlDecisionId === dec.id;

            return (
              <div
                key={dec.id}
                id={`decision-card-${dec.id}`}
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: isTargeted
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                  transition: "border-color 0.15s ease",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: stBadge.bg,
                        color: stBadge.color,
                      }}
                    >
                      {stBadge.label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: sevBadge.bg,
                        color: sevBadge.color,
                      }}
                    >
                      {dec.severity}
                    </span>
                    <h3
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                        margin: 0,
                      }}
                    >
                      {dec.title}
                    </h3>
                  </div>

                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Created {new Date(dec.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Constraint & Rationale */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Invariant / Decision:
                  </div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--color-text)",
                      margin: 0,
                    }}
                  >
                    {dec.decision}
                  </p>
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      marginBottom: "0.15rem",
                    }}
                  >
                    Technical Rationale:
                  </div>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-text-secondary)",
                      margin: 0,
                    }}
                  >
                    {dec.rationale}
                  </p>
                </div>

                {/* Target Scope */}
                {(dec.targetFilePath || dec.targetSymbol) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      fontSize: "0.75rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {dec.targetFilePath && (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        File:{" "}
                        <code style={{ color: "var(--color-text)" }}>
                          {dec.targetFilePath}
                        </code>
                      </span>
                    )}
                    {dec.targetSymbol && (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        Symbol:{" "}
                        <code style={{ color: "var(--color-text)" }}>
                          {dec.targetSymbol}
                        </code>
                      </span>
                    )}
                  </div>
                )}

                {/* Provenance & Supporting Evidence Citations */}
                {dec.supportingEvidence &&
                  dec.supportingEvidence.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--color-border)",
                        paddingTop: "0.5rem",
                        marginTop: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Historical Evidence Provenance (
                        {dec.supportingEvidence.length}):
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.4rem",
                          marginTop: "0.35rem",
                        }}
                      >
                        {dec.supportingEvidence.map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-card-muted)",
                              border: "1px solid var(--color-border)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <span
                              style={{ fontWeight: 700, fontSize: "0.65rem" }}
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
                                  textDecoration: "none",
                                }}
                              >
                                {ev.referenceKey} ↗
                              </a>
                            ) : (
                              <span>{ev.referenceKey}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Reviewer & Lifecycle Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "0.75rem",
                    marginTop: "0.75rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {dec.reviewerName && (
                      <span>
                        Reviewed by <strong>{dec.reviewerName}</strong>
                        {dec.reviewedAt &&
                          ` on ${new Date(dec.reviewedAt).toLocaleDateString()}`}
                      </span>
                    )}
                    {dec.reviewNotes && (
                      <span
                        style={{ marginLeft: "0.5rem", fontStyle: "italic" }}
                      >
                        • &quot;{dec.reviewNotes}&quot;
                      </span>
                    )}
                  </div>

                  {/* Lifecycle Action Buttons */}
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {(dec.status === "CANDIDATE" ||
                      dec.status === "IN_REVIEW") && (
                      <>
                        <button
                          type="button"
                          id={`btn-accept-decision-${dec.id}`}
                          onClick={() => {
                            setReviewingDecision(dec);
                            setReviewAction("ACCEPT");
                          }}
                          style={{
                            padding: "0.3rem 0.65rem",
                            borderRadius: "4px",
                            border: "1px solid #10B981",
                            backgroundColor: "rgba(16, 185, 129, 0.08)",
                            color: "#059669",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          ✓ Accept Invariant
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingDecision(dec);
                            setReviewAction("REJECT");
                          }}
                          style={{
                            padding: "0.3rem 0.65rem",
                            borderRadius: "4px",
                            border: "1px solid var(--color-border)",
                            backgroundColor: "transparent",
                            color: "var(--color-text-secondary)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          ✗ Reject Candidate
                        </button>
                      </>
                    )}

                    {dec.status === "ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingDecision(dec);
                          setReviewAction("DISPUTE");
                        }}
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "4px",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "transparent",
                          color: "#DC2626",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        ⚠️ Dispute Decision
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Confirmation Modal */}
      {reviewingDecision && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--color-text)",
                marginBottom: "0.5rem",
              }}
            >
              {reviewAction === "ACCEPT" && "Accept Engineering Decision"}
              {reviewAction === "REJECT" && "Reject Candidate Decision"}
              {reviewAction === "DISPUTE" && "Dispute Engineering Decision"}
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--color-text-secondary)",
                marginBottom: "1rem",
              }}
            >
              {reviewAction === "ACCEPT" &&
                "Confirming this decision elevates it to an active architectural constraint that future code changes will be evaluated against."}
              {reviewAction === "REJECT" &&
                "Rejecting this candidate archives it from active intent checking."}
              {reviewAction === "DISPUTE" &&
                "Disputing this decision alerts reviewers that the constraint is under contention or requires revision."}
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "0.35rem",
                }}
              >
                Reviewer Notes / Rationale
              </label>
              <textarea
                rows={3}
                placeholder="Document why this disposition was chosen..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
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
              <button
                type="button"
                onClick={() => setReviewingDecision(null)}
                disabled={isSubmittingReview}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "transparent",
                  color: "var(--color-text)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={isSubmittingReview}
                style={{
                  padding: "0.45rem 1.25rem",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor:
                    reviewAction === "ACCEPT"
                      ? "#10B981"
                      : reviewAction === "REJECT"
                        ? "#6B7280"
                        : "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: isSubmittingReview ? "not-allowed" : "pointer",
                }}
              >
                {isSubmittingReview
                  ? "Processing..."
                  : `Confirm ${reviewAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Propose New Decision Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--color-text)",
                marginBottom: "0.5rem",
              }}
            >
              Propose Engineering Decision
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--color-text-secondary)",
                marginBottom: "1rem",
              }}
            >
              Proposed decisions enter the <code>CANDIDATE</code> status and
              require human review before becoming active constraints.
            </p>

            <form onSubmit={handleCreateDecision}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Decision Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Idempotent Mutex Required on Financial Settlement"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Brief context summary"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Concrete Decision / Invariant *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="The concrete constraint that future code changes must adhere to..."
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Historical Rationale *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Why this decision was made (e.g. race condition observed under load in 2023)..."
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
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
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Target File Path
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. src/settlement.ts"
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-text)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Target Symbol
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. executeSettlement"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-text)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Severity
                </label>
                <select
                  value={newSeverity}
                  onChange={(e) =>
                    setNewSeverity(e.target.value as DecisionSeverity)
                  }
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="CRITICAL">
                    CRITICAL (Merge-blocking if violated)
                  </option>
                  <option value="HIGH">HIGH (Requires architect review)</option>
                  <option value="MEDIUM">MEDIUM (Advisory invariant)</option>
                  <option value="LOW">LOW (Informational)</option>
                  <option value="ADVISORY">ADVISORY (Guideline)</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmittingCreate}
                  style={{
                    padding: "0.45rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "transparent",
                    color: "var(--color-text)",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  style={{
                    padding: "0.45rem 1.25rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: isSubmittingCreate ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmittingCreate ? "Creating..." : "Propose Candidate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DecisionsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", textAlign: "center" }}>
          Loading Decision Memory Studio...
        </div>
      }
    >
      <DecisionMemoryContent />
    </Suspense>
  );
}
