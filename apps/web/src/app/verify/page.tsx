"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../lib/api";
import {
  RepositoryDetailsDto,
  HumanVerdict,
  TracebackReportExport,
} from "@traceback/shared-types";

interface ValidatedEvidence {
  sourceType: string;
  referenceKey: string;
  title: string;
  author: string;
  timestamp: string;
  url: string;
  snippet?: string;
  filePath?: string;
  quality?: {
    relevanceScore: number;
    matchReasons: string[];
    isDirectFilePathMatch?: boolean;
  };
}

interface ClaimAssessment {
  claimId: string;
  claimText: string;
  targetSymbol?: string;
  status: "SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT_EVIDENCE" | "MIXED";
  confidenceScore: number;
  rationale: string;
  supportingEvidence: ValidatedEvidence[];
  contradictingEvidence: ValidatedEvidence[];
  allValidatedEvidence: ValidatedEvidence[];
  requiresHumanReview: boolean;
  abstentionNotice?: string;
  humanVerdict?: HumanVerdict | null;
  reviewNotes?: string | null;
  verdictHistory?: Array<{
    id: string;
    verdict: HumanVerdict;
    reviewerId: string | null;
    reviewerName?: string;
    reviewNotes: string | null;
    decidedAt: string;
  }>;
}

interface VerificationResult {
  sessionId: string;
  workspaceId: string;
  repositoryId: string;
  status: string;
  explanation: string;
  codeSnippet?: string;
  targetFilePath?: string;
  claimsCount: number;
  assessments: ClaimAssessment[];
  citationValidityRate: number;
  executionTimeMs: number;
  estimatedTokensUsed: number;
}

function VerifyWorkspaceContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const urlRepoId = searchParams.get("repoId");

  const { activeWorkspace, user } = useAuth();

  // Form State
  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(urlRepoId || "");
  const [explanation, setExplanation] = useState("");
  const [targetFilePath, setTargetFilePath] = useState("");
  const [targetSymbol, setTargetSymbol] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");

  // Workflow State
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Verdict submission state
  const [verdictNotes, setVerdictNotes] = useState<Record<string, string>>({});
  const [savingVerdictClaimId, setSavingVerdictClaimId] = useState<
    string | null
  >(null);
  const [verdictFeedback, setVerdictFeedback] = useState<
    Record<string, string>
  >({});
  const [expandedEvidence, setExpandedEvidence] = useState<
    Record<string, boolean>
  >({});
  const [showAuditTrail, setShowAuditTrail] = useState<Record<string, boolean>>(
    {},
  );

  // Editing claims state
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editedClaimText, setEditedClaimText] = useState("");

  // Load repositories for current workspace
  const loadRepositories = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      setIsLoadingRepos(true);
      setError(null);
      const repos = await api.getRepositories(activeWorkspace.id);
      setRepositories(repos);
      setSelectedRepoId(
        (prev) => prev || urlRepoId || (repos.length > 0 ? repos[0].id : ""),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load repositories: ${msg}`);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [activeWorkspace?.id, urlRepoId]);

  // Load existing session if requested via URL params
  const loadExistingSession = useCallback(
    async (sessionId: string, repoId: string) => {
      if (!activeWorkspace) return;
      try {
        setIsVerifying(true);
        setError(null);
        const session = await api.getVerificationSession(
          repoId,
          sessionId,
          activeWorkspace.id,
        );
        setResult(session);
        setSelectedRepoId(repoId);
        setExplanation(session.explanation || "");
        setTargetFilePath(session.targetFilePath || "");
        setCodeSnippet(session.codeSnippet || "");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to load requested verification session: ${msg}`);
      } finally {
        setIsVerifying(false);
      }
    },
    [activeWorkspace],
  );

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    if (urlSessionId && urlRepoId && activeWorkspace) {
      loadExistingSession(urlSessionId, urlRepoId);
    }
  }, [urlSessionId, urlRepoId, activeWorkspace, loadExistingSession]);

  // Handle Verification Submission
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) {
      setError("Please select a target repository");
      return;
    }
    if (!explanation.trim()) {
      setError("Please provide an AI-generated explanation to verify");
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      const data = await api.verifyExplanation(
        selectedRepoId,
        {
          explanation: explanation.trim(),
          targetFilePath: targetFilePath.trim() || undefined,
          targetSymbol: targetSymbol.trim() || undefined,
          codeSnippet: codeSnippet.trim() || undefined,
        },
        activeWorkspace?.id,
      );

      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Verification error: ${msg}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Recording Human Verdict
  const handleRecordVerdict = async (
    claimId: string,
    verdict: HumanVerdict,
  ) => {
    if (!result || !selectedRepoId) return;

    try {
      setSavingVerdictClaimId(claimId);
      const notes = verdictNotes[claimId] || "";

      await api.recordVerdict(
        selectedRepoId,
        result.sessionId,
        claimId,
        { verdict, reviewNotes: notes.trim() || undefined },
        activeWorkspace?.id,
      );

      // Refresh session to get updated verdict state and audit trail
      const updated = await api.getVerificationSession(
        selectedRepoId,
        result.sessionId,
        activeWorkspace?.id,
      );
      setResult(updated);

      setVerdictFeedback((prev) => ({
        ...prev,
        [claimId]: `Saved as ${verdict}`,
      }));

      setTimeout(() => {
        setVerdictFeedback((prev) => {
          const next = { ...prev };
          delete next[claimId];
          return next;
        });
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save verdict: ${msg}`);
    } finally {
      setSavingVerdictClaimId(null);
    }
  };

  // Handle Editing Claim Text
  const handleSaveClaimText = async (claimId: string) => {
    if (!result || !selectedRepoId || !editedClaimText.trim()) return;

    try {
      await api.updateClaim(
        selectedRepoId,
        result.sessionId,
        claimId,
        editedClaimText.trim(),
        activeWorkspace?.id,
      );

      setResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          assessments: prev.assessments.map((a) =>
            a.claimId === claimId
              ? { ...a, claimText: editedClaimText.trim() }
              : a,
          ),
        };
      });

      setEditingClaimId(null);
      setEditedClaimText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to update claim: ${msg}`);
    }
  };

  // Handle Exporting JSON Report
  const handleExportJson = async () => {
    if (!result || !selectedRepoId) return;
    try {
      const report = await api.exportReport(
        selectedRepoId,
        result.sessionId,
        activeWorkspace?.id,
      );

      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `traceback-report-${result.sessionId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to export report: ${msg}`);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "SUPPORTED":
        return {
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        };
      case "CONTRADICTED":
        return {
          backgroundColor: "rgba(239, 68, 68, 0.12)",
          color: "#DC2626",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        };
      case "MIXED":
        return {
          backgroundColor: "rgba(139, 92, 246, 0.12)",
          color: "#7C3AED",
          border: "1px solid rgba(139, 92, 246, 0.3)",
        };
      case "INSUFFICIENT_EVIDENCE":
      default:
        return {
          backgroundColor: "rgba(245, 158, 11, 0.12)",
          color: "#D97706",
          border: "1px solid rgba(245, 158, 11, 0.3)",
        };
    }
  };

  return (
    <main
      id="main-content"
      style={{ maxWidth: "1120px", margin: "2rem auto", padding: "0 1.5rem" }}
    >
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "1rem",
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
            Verification Workspace
          </h1>
          <p
            style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}
          >
            Decompose AI code rationales into technical claims and verify them
            against historical repository evidence
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/history"
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            📜 Verification History
          </Link>
          {result && (
            <button
              type="button"
              id="export-report-button"
              onClick={handleExportJson}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--color-primary)",
                backgroundColor: "var(--color-card-muted)",
                color: "var(--color-primary)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📥 Export JSON Report
            </button>
          )}
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

      {/* Input Form Card */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          padding: "1.5rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          marginBottom: "2rem",
        }}
      >
        <form onSubmit={handleVerify}>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
            }}
          >
            <div style={{ flex: "1 1 300px" }}>
              <label
                htmlFor="verify-repository-select"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "0.35rem",
                }}
              >
                Target Repository
              </label>
              {isLoadingRepos ? (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Loading connected repositories...
                </div>
              ) : repositories.length === 0 ? (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  No repositories connected in this workspace.{" "}
                  <Link
                    href="/repositories"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Connect a repository
                  </Link>
                </div>
              ) : (
                <select
                  id="verify-repository-select"
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text)",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName} ({repo.defaultBranch})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ flex: "1 1 250px" }}>
              <label
                htmlFor="verify-target-file"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "0.35rem",
                }}
              >
                Target File Path (Optional)
              </label>
              <input
                id="verify-target-file"
                type="text"
                placeholder="e.g. src/auth/session.service.ts"
                value={targetFilePath}
                onChange={(e) => setTargetFilePath(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <label
                htmlFor="verify-target-symbol"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "0.35rem",
                }}
              >
                Code Symbol (Optional)
              </label>
              <input
                id="verify-target-symbol"
                type="text"
                placeholder="e.g. validateSession"
                value={targetSymbol}
                onChange={(e) => setTargetSymbol(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="verify-explanation-input"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: "0.35rem",
              }}
            >
              AI-Generated Explanation
            </label>
            <textarea
              id="verify-explanation-input"
              rows={4}
              placeholder="Paste the explanation provided by your AI coding assistant (e.g. 'This lock was added in commit 7f8a9b to prevent cache race conditions during deployment...')"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={isVerifying}
              required
              style={{
                width: "100%",
                padding: "0.75rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                marginTop: "0.25rem",
                textAlign: "right",
              }}
            >
              {explanation.length} / 10,000 characters
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="verify-snippet-input"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: "0.35rem",
              }}
            >
              Relevant Code Snippet / Diff (Optional)
            </label>
            <textarea
              id="verify-snippet-input"
              rows={2}
              placeholder="Optional code snippet or diff context"
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              disabled={isVerifying}
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
                fontSize: "0.85rem",
                fontFamily: "monospace",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
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
            {result && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setExplanation("");
                  setTargetFilePath("");
                  setTargetSymbol("");
                  setCodeSnippet("");
                }}
                style={{
                  padding: "0.65rem 1.25rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "transparent",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Form
              </button>
            )}

            <button
              id="verify-submit-button"
              type="submit"
              disabled={isVerifying || repositories.length === 0}
              style={{
                padding: "0.65rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--color-primary)",
                color: "#FFFFFF",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: isVerifying ? "not-allowed" : "pointer",
                opacity: isVerifying ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.15s ease",
              }}
            >
              {isVerifying ? (
                <>
                  <span>⏳</span>
                  <span>Extracting & Grounding Claims...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Verify Explanation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Verification Results View */}
      {result && (
        <div style={{ marginTop: "2rem" }}>
          {/* Results Summary Bar */}
          <div
            style={{
              padding: "1rem 1.5rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                Session ID:{" "}
                <code style={{ color: "var(--color-text)", fontWeight: 600 }}>
                  {result.sessionId}
                </code>
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginTop: "0.35rem",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 8px",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    color: "var(--color-primary)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  Status: {result.status}
                </span>
                <span
                  style={{ fontSize: "0.85rem", color: "var(--color-text)" }}
                >
                  <strong>{result.claimsCount}</strong> claims extracted
                </span>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}
            >
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Citation Validity Rate
                </div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color:
                      result.citationValidityRate === 1.0
                        ? "var(--color-success)"
                        : "var(--color-warning)",
                  }}
                >
                  {(result.citationValidityRate * 100).toFixed(0)}%
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Tokens Used
                </div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  ~{result.estimatedTokensUsed}
                </div>
              </div>
            </div>
          </div>

          {/* Individual Claim Assessment Cards */}
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "1rem",
            }}
          >
            Extracted Claims & Historical Grounding
          </h2>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {result.assessments.map((assessment, index) => {
              const isEvidenceOpen =
                expandedEvidence[assessment.claimId] ?? true;
              const isAuditOpen = showAuditTrail[assessment.claimId] ?? false;
              const isEditing = editingClaimId === assessment.claimId;

              return (
                <div
                  key={assessment.claimId}
                  id={`claim-card-${assessment.claimId}`}
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "10px",
                    padding: "1.5rem",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                  }}
                >
                  {/* Claim Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "280px" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--color-text-secondary)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Claim #{index + 1}
                        {assessment.targetSymbol && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              color: "var(--color-primary)",
                            }}
                          >
                            Symbol: <code>{assessment.targetSymbol}</code>
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginTop: "0.35rem",
                          }}
                        >
                          <input
                            type="text"
                            value={editedClaimText}
                            onChange={(e) => setEditedClaimText(e.target.value)}
                            style={{
                              flex: 1,
                              padding: "0.4rem 0.6rem",
                              borderRadius: "4px",
                              border: "1px solid var(--color-primary)",
                              backgroundColor: "var(--color-background)",
                              color: "var(--color-text)",
                              fontSize: "0.95rem",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveClaimText(assessment.claimId)
                            }
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-primary)",
                              color: "#FFFFFF",
                              border: "none",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingClaimId(null)}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "4px",
                              backgroundColor: "transparent",
                              color: "var(--color-text-secondary)",
                              border: "1px solid var(--color-border)",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 600,
                              color: "var(--color-text)",
                              margin: 0,
                            }}
                          >
                            &ldquo;{assessment.claimText}&rdquo;
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClaimId(assessment.claimId);
                              setEditedClaimText(assessment.claimText);
                            }}
                            title="Edit claim text"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-text-secondary)",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              textDecoration: "underline",
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Machine Assessment Badge */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "6px",
                          ...getStatusBadgeStyle(assessment.status),
                        }}
                      >
                        Machine: {assessment.status.replace("_", " ")}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--color-text-secondary)",
                          marginTop: "0.2rem",
                        }}
                      >
                        Confidence:{" "}
                        {(assessment.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Machine Assessment Rationale */}
                  <div
                    style={{
                      padding: "0.85rem",
                      backgroundColor: "var(--color-card-muted)",
                      borderRadius: "6px",
                      marginBottom: "1rem",
                      fontSize: "0.875rem",
                      color: "var(--color-text)",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Assessment Rationale:</strong>{" "}
                    {assessment.rationale}
                    {assessment.abstentionNotice && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.4rem 0.6rem",
                          backgroundColor: "rgba(245, 158, 11, 0.08)",
                          borderLeft: "3px solid #D97706",
                          color: "var(--color-text)",
                          fontSize: "0.8rem",
                          fontStyle: "italic",
                        }}
                      >
                        ⚠️ {assessment.abstentionNotice}
                      </div>
                    )}
                  </div>

                  {/* Supporting Evidence Accordion */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.825rem",
                          fontWeight: 700,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                        }}
                      >
                        Historical Evidence (
                        {assessment.allValidatedEvidence.length} sources)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEvidence((prev) => ({
                            ...prev,
                            [assessment.claimId]: !isEvidenceOpen,
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-primary)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isEvidenceOpen ? "Hide Sources ▲" : "Show Sources ▼"}
                      </button>
                    </div>

                    {isEvidenceOpen && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        {assessment.allValidatedEvidence.length === 0 ? (
                          <div
                            style={{
                              padding: "0.75rem",
                              border: "1px dashed var(--color-border)",
                              borderRadius: "6px",
                              color: "var(--color-text-secondary)",
                              fontSize: "0.85rem",
                            }}
                          >
                            No matching historical commits, PRs, or issues found
                            above the threshold.
                          </div>
                        ) : (
                          assessment.allValidatedEvidence.map((ev, evIdx) => (
                            <div
                              key={evIdx}
                              style={{
                                padding: "0.75rem",
                                border: "1px solid var(--color-border)",
                                borderRadius: "6px",
                                backgroundColor: "var(--color-surface)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "0.5rem",
                                  marginBottom: "0.35rem",
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
                                      backgroundColor: "var(--color-border)",
                                      color: "var(--color-text)",
                                    }}
                                  >
                                    {ev.sourceType}
                                  </span>
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      color: "var(--color-primary)",
                                      textDecoration: "none",
                                    }}
                                  >
                                    {ev.referenceKey}: {ev.title} ↗
                                  </a>
                                </div>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--color-text-secondary)",
                                  }}
                                >
                                  By {ev.author} •{" "}
                                  {new Date(ev.timestamp).toLocaleDateString()}
                                </span>
                              </div>

                              {ev.snippet && (
                                <pre
                                  style={{
                                    margin: "0.35rem 0 0 0",
                                    padding: "0.5rem",
                                    backgroundColor: "var(--color-card-muted)",
                                    borderRadius: "4px",
                                    fontSize: "0.75rem",
                                    fontFamily: "monospace",
                                    whiteSpace: "pre-wrap",
                                    maxHeight: "140px",
                                    overflowY: "auto",
                                    color: "var(--color-text)",
                                  }}
                                >
                                  {ev.snippet}
                                </pre>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Human Review & Verdict Section */}
                  <div
                    style={{
                      borderTop: "2px solid var(--color-border)",
                      paddingTop: "1rem",
                      marginTop: "1rem",
                      backgroundColor: "rgba(59, 130, 246, 0.02)",
                      borderRadius: "6px",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "1rem" }}>👤</span>
                        <strong
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--color-text)",
                          }}
                        >
                          Human Reviewer Verdict
                        </strong>
                        {assessment.humanVerdict ? (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor:
                                assessment.humanVerdict === "SUPPORTED"
                                  ? "#10B981"
                                  : assessment.humanVerdict === "CONTRADICTED"
                                    ? "#EF4444"
                                    : "#6B7280",
                              color: "#FFFFFF",
                            }}
                          >
                            Recorded: {assessment.humanVerdict}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-text-secondary)",
                              fontStyle: "italic",
                            }}
                          >
                            Pending human review
                          </span>
                        )}
                      </div>

                      {assessment.verdictHistory &&
                        assessment.verdictHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowAuditTrail((prev) => ({
                                ...prev,
                                [assessment.claimId]: !isAuditOpen,
                              }))
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-primary)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            {isAuditOpen
                              ? "Hide Revision History"
                              : `View Revision History (${assessment.verdictHistory.length})`}
                          </button>
                        )}
                    </div>

                    {verdictFeedback[assessment.claimId] && (
                      <div
                        style={{
                          padding: "0.4rem 0.6rem",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          color: "var(--color-success)",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          marginBottom: "0.5rem",
                        }}
                      >
                        ✓ {verdictFeedback[assessment.claimId]}
                      </div>
                    )}

                    {/* Verdict Notes Input */}
                    <div style={{ marginBottom: "0.75rem" }}>
                      <textarea
                        rows={2}
                        placeholder="Add reviewer notes or engineering rationale for this verdict..."
                        value={
                          verdictNotes[assessment.claimId] ??
                          assessment.reviewNotes ??
                          ""
                        }
                        onChange={(e) =>
                          setVerdictNotes((prev) => ({
                            ...prev,
                            [assessment.claimId]: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "4px",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-surface)",
                          color: "var(--color-text)",
                          fontSize: "0.825rem",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* Verdict Decision Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        id={`btn-verdict-supported-${assessment.claimId}`}
                        disabled={savingVerdictClaimId === assessment.claimId}
                        onClick={() =>
                          handleRecordVerdict(assessment.claimId, "SUPPORTED")
                        }
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "6px",
                          border: "1px solid #10B981",
                          backgroundColor:
                            assessment.humanVerdict === "SUPPORTED"
                              ? "#10B981"
                              : "rgba(16, 185, 129, 0.08)",
                          color:
                            assessment.humanVerdict === "SUPPORTED"
                              ? "#FFFFFF"
                              : "#059669",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ✓ Mark Supported
                      </button>

                      <button
                        type="button"
                        id={`btn-verdict-contradicted-${assessment.claimId}`}
                        disabled={savingVerdictClaimId === assessment.claimId}
                        onClick={() =>
                          handleRecordVerdict(
                            assessment.claimId,
                            "CONTRADICTED",
                          )
                        }
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "6px",
                          border: "1px solid #EF4444",
                          backgroundColor:
                            assessment.humanVerdict === "CONTRADICTED"
                              ? "#EF4444"
                              : "rgba(239, 68, 68, 0.08)",
                          color:
                            assessment.humanVerdict === "CONTRADICTED"
                              ? "#FFFFFF"
                              : "#DC2626",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ✗ Mark Contradicted
                      </button>

                      <button
                        type="button"
                        id={`btn-verdict-unverified-${assessment.claimId}`}
                        disabled={savingVerdictClaimId === assessment.claimId}
                        onClick={() =>
                          handleRecordVerdict(assessment.claimId, "UNVERIFIED")
                        }
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "6px",
                          border: "1px solid var(--color-border)",
                          backgroundColor:
                            assessment.humanVerdict === "UNVERIFIED"
                              ? "#6B7280"
                              : "transparent",
                          color:
                            assessment.humanVerdict === "UNVERIFIED"
                              ? "#FFFFFF"
                              : "var(--color-text)",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ? Mark Unverified
                      </button>
                    </div>

                    {/* Audit Trail Drawer */}
                    {isAuditOpen && assessment.verdictHistory && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          padding: "0.75rem",
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "6px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--color-text-secondary)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Append-Only Verdict Audit Trail
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {assessment.verdictHistory.map((item, hIdx) => (
                            <div
                              key={hIdx}
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.35rem 0.5rem",
                                backgroundColor: "var(--color-card-muted)",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span>
                                <strong>{item.verdict}</strong> by{" "}
                                {item.reviewerName ||
                                  item.reviewerId ||
                                  "Reviewer"}
                                {item.reviewNotes && ` — "${item.reviewNotes}"`}
                              </span>
                              <span
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                {new Date(item.decidedAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--color-text-secondary)",
          }}
        >
          Loading verification workspace...
        </div>
      }
    >
      <VerifyWorkspaceContent />
    </Suspense>
  );
}
