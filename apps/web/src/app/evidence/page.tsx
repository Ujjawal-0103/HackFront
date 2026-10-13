"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import {
  RepositoryDetailsDto,
  EvidenceSearchResultItem,
  EvidenceSearchResponse,
  EvidenceSourceType,
  SourceRecordDto,
} from "@traceback/shared-types";

function EvidenceExplorerContent() {
  const searchParams = useSearchParams();
  const initialRepoParam = searchParams.get("repo");
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [loadingRepos, setLoadingRepos] = useState(true);

  // Search form state
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState<string>("ALL");
  const [filePath, setFilePath] = useState("");
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [includeGraph, setIncludeGraph] = useState(false);

  // Results state
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResponse, setSearchResponse] =
    useState<EvidenceSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Inspection modal/drawer
  const [inspectedRecord, setInspectedRecord] =
    useState<SourceRecordDto | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Load repositories on mount or workspace change
  useEffect(() => {
    async function loadRepos() {
      if (!workspaceId) return;
      try {
        setLoadingRepos(true);
        const repos = await api.getRepositories(workspaceId);
        setRepositories(repos);
        if (repos.length > 0) {
          if (
            initialRepoParam &&
            repos.some((r) => r.id === initialRepoParam)
          ) {
            setSelectedRepoId(initialRepoParam);
          } else {
            setSelectedRepoId(repos[0].id);
          }
        } else {
          setSelectedRepoId("");
        }
      } catch (err) {
        console.error("Failed to load repositories:", err);
      } finally {
        setLoadingRepos(false);
      }
    }
    loadRepos();
  }, [initialRepoParam, workspaceId]);

  const executeSearch = useCallback(
    async (searchQuery: string = query) => {
      if (!selectedRepoId) return;

      setIsSearching(true);
      setSearchError(null);
      setHasSearched(true);

      try {
        const sourceTypes: EvidenceSourceType[] | undefined =
          sourceType !== "ALL" ? [sourceType as EvidenceSourceType] : undefined;

        const res = await api.searchEvidence(selectedRepoId, {
          query: searchQuery,
          sourceTypes,
          filePath: filePath.trim() || undefined,
          since: sinceDate || undefined,
          until: untilDate || undefined,
          includeGraph,
        });

        setSearchResponse(res);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : String(err);
        setSearchError(msg);
        setSearchResponse(null);
      } finally {
        setIsSearching(false);
      }
    },
    [
      selectedRepoId,
      query,
      sourceType,
      filePath,
      sinceDate,
      untilDate,
      includeGraph,
    ],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  const handleClear = () => {
    setQuery("");
    setFilePath("");
    setSinceDate("");
    setUntilDate("");
    setSourceType("ALL");
    setHasSearched(false);
    setSearchResponse(null);
    setSearchError(null);
  };

  const handleInspect = async (item: EvidenceSearchResultItem) => {
    setInspectedRecord(item.source);
    setLoadingInspect(true);
    try {
      const fullRecord = await api.getSourceRecord(
        selectedRepoId,
        item.source.id,
      );
      setInspectedRecord(fullRecord);
    } catch {
      // Keep existing record if detail fetch fails
    } finally {
      setLoadingInspect(false);
    }
  };

  const getSourceBadgeStyle = (type: string) => {
    switch (type) {
      case "COMMIT":
        return {
          bg: "rgba(37, 99, 235, 0.12)",
          color: "var(--color-primary)",
        };
      case "PULL_REQUEST":
        return {
          bg: "rgba(168, 85, 247, 0.15)",
          color: "#7E22CE",
        };
      case "ISSUE":
        return {
          bg: "rgba(34, 197, 94, 0.12)",
          color: "var(--color-success)",
        };
      case "ADR":
      case "DOCUMENTATION":
        return {
          bg: "rgba(245, 158, 11, 0.12)",
          color: "var(--color-warning)",
        };
      default:
        return {
          bg: "var(--color-card-muted)",
          color: "var(--color-text-secondary)",
        };
    }
  };

  return (
    <main
      style={{
        padding: "2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Page Title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "var(--color-text)",
            marginBottom: "0.25rem",
          }}
        >
          Evidence Explorer
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Sprint 4 — Search canonical repository history, inspect provenance,
          and evaluate evidence grounding.
        </p>
      </div>

      {loadingRepos ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "var(--color-surface)",
            borderRadius: "10px",
            border: "1px solid var(--color-border)",
          }}
        >
          Loading repository configurations...
        </div>
      ) : repositories.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "var(--color-surface)",
            borderRadius: "10px",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📂</div>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            No Repositories Available
          </h3>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              marginBottom: "1.25rem",
            }}
          >
            You must connect and ingest a repository before you can explore its
            historical evidence.
          </p>
          <Link
            href="/repositories"
            style={{
              padding: "0.55rem 1.25rem",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            Go to Repositories & Ingestion
          </Link>
        </div>
      ) : (
        <div>
          {/* Search Card */}
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "10px",
              border: "1px solid var(--color-border)",
              padding: "1.5rem",
              marginBottom: "1.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <form onSubmit={handleSubmit}>
              {/* Top Controls: Repository Selector & Main Query */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "250px 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <label
                    htmlFor="repo-select"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    REPOSITORY
                  </label>
                  <select
                    id="repo-select"
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    {repositories.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.fullName} ({repo.counts.sourceRecords} records)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="evidence-query"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    EXPLANATION OR CLAIM QUERY
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      id="evidence-query"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder='e.g., "memory leak socket reconnection" or "#42" or "ADR-002"'
                      style={{
                        flex: 1,
                        padding: "0.6rem 0.85rem",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
                        fontSize: "0.875rem",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-primary)",
                        color: "#FFFFFF",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: isSearching ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSearching ? "Searching..." : "Search"}
                    </button>
                    {query && (
                      <button
                        type="button"
                        onClick={handleClear}
                        style={{
                          padding: "0.6rem 0.85rem",
                          borderRadius: "6px",
                          backgroundColor: "var(--color-card-muted)",
                          color: "var(--color-text-secondary)",
                          border: "1px solid var(--color-border)",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced Filter Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <label
                    htmlFor="source-type"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Source Type
                  </label>
                  <select
                    id="source-type"
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <option value="ALL">All Types</option>
                    <option value="COMMIT">Commits</option>
                    <option value="PULL_REQUEST">Pull Requests</option>
                    <option value="ISSUE">Issues</option>
                    <option value="DOCUMENTATION">Documentation</option>
                    <option value="ADR">Architecture Decisions</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="file-path"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    File Path Proximity
                  </label>
                  <input
                    id="file-path"
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="e.g., src/socket.ts"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "0.8125rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="since-date"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Since Date
                  </label>
                  <input
                    id="since-date"
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "0.8125rem",
                    }}
                  />
                </div>

                {/* Graph Integration Toggle */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeGraph}
                      onChange={(e) => setIncludeGraph(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Include Graph Expansion
                  </label>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-secondary)",
                      marginTop: "0.2rem",
                    }}
                  >
                    ADR-005 evaluation gate: Neo4j optional; fallback to
                    PostgreSQL lexical baseline.
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Search Error State */}
          {searchError && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                border: "1px solid var(--color-error)",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1.5rem",
                color: "var(--color-error)",
              }}
            >
              <strong>Retrieval Error:</strong> {searchError}
            </div>
          )}

          {/* Loading Indicator */}
          {isSearching ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "var(--color-surface)",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "0.4rem",
                }}
              >
                Retrieving and ranking historical evidence...
              </div>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                Executing PostgreSQL full-text search and provenance scoring.
              </p>
            </div>
          ) : !hasSearched ? (
            /* Initial Search Instructions */
            <div
              style={{
                padding: "3rem 2rem",
                textAlign: "center",
                backgroundColor: "var(--color-surface)",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "0.5rem",
                }}
              >
                Historical Evidence Grounding Search
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                  maxWidth: "600px",
                  margin: "0 auto 1.5rem auto",
                  lineHeight: 1.5,
                }}
              >
                Enter an AI-generated explanation, commit SHA, PR number, or key
                architectural terms above to search canonical repository
                evidence. Traceback ranks real historical artifacts to verify
                claims.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-secondary)",
                    alignSelf: "center",
                  }}
                >
                  Quick queries:
                </span>
                {["memory leak", "normalization", "reconnection", "socket"].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        executeSearch(term);
                      }}
                      style={{
                        padding: "0.3rem 0.6rem",
                        borderRadius: "9999px",
                        backgroundColor: "var(--color-card-muted)",
                        border: "1px solid var(--color-border)",
                        fontSize: "0.75rem",
                        color: "var(--color-text)",
                        cursor: "pointer",
                      }}
                    >
                      {term}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : searchResponse?.items.length === 0 ? (
            /* No Results / Insufficient Evidence State */
            <div
              style={{
                padding: "3rem 2rem",
                textAlign: "center",
                backgroundColor: "var(--color-surface)",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "0.5rem",
                }}
              >
                Insufficient Historical Evidence Found
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                  maxWidth: "550px",
                  margin: "0 auto 1rem auto",
                  lineHeight: 1.5,
                }}
              >
                No canonical source records in{" "}
                <code>{selectedRepoId.slice(0, 8)}</code> matched query &quot;
                <strong>{searchResponse.query}</strong>&quot; above the
                relevance confidence threshold.
              </p>
              <div
                style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid var(--color-warning)",
                  color: "var(--color-warning)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                Radical Honesty: Absence of evidence is not proof that a claim
                is false.
              </div>
            </div>
          ) : (
            /* Results List */
            <div>
              {/* Results Status Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span>
                  Found <strong>{searchResponse?.totalCount}</strong> relevant
                  source record(s) in {searchResponse?.executionTimeMs}ms
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--color-card-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Retrieval Mode:{" "}
                  {searchResponse?.graphAvailable
                    ? "Hybrid Graph + FTS"
                    : "PostgreSQL Lexical Baseline"}
                </span>
              </div>

              {/* Result Cards */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {searchResponse?.items.map((item) => {
                  const badgeStyle = getSourceBadgeStyle(
                    item.source.sourceType,
                  );
                  return (
                    <div
                      key={item.source.id}
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        padding: "1.25rem 1.5rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      }}
                    >
                      {/* Top Meta Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
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
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                            }}
                          >
                            {item.source.sourceType}
                          </span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "var(--color-text)",
                            }}
                          >
                            {item.source.referenceKey}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            by {item.source.author} •{" "}
                            {new Date(
                              item.source.recordedAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-card-muted)",
                              color: "var(--color-primary)",
                            }}
                          >
                            Score: {item.score}
                          </span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.2rem 0.4rem",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-card-muted)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {item.retrievalMethod}
                          </span>
                          <a
                            href={item.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "var(--color-primary)",
                            }}
                          >
                            GitHub ↗
                          </a>
                        </div>
                      </div>

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "var(--color-text)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {item.source.title}
                      </h3>

                      {/* Content Excerpt */}
                      {item.source.snippet && (
                        <pre
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.8125rem",
                            backgroundColor: "var(--color-card-muted)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "6px",
                            padding: "0.75rem",
                            overflowX: "auto",
                            color: "var(--color-text)",
                            marginBottom: "0.75rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.source.snippet}
                        </pre>
                      )}

                      {/* Ranking Explanation Pills */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "0.4rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {item.matchReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "0.7rem",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                backgroundColor: "rgba(37, 99, 235, 0.08)",
                                color: "var(--color-primary)",
                              }}
                            >
                              ✓ {reason}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => handleInspect(item)}
                          style={{
                            padding: "0.3rem 0.75rem",
                            borderRadius: "4px",
                            backgroundColor: "transparent",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Inspect Record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspect Record Modal */}
      {inspectedRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "750px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "rgba(37, 99, 235, 0.12)",
                    color: "var(--color-primary)",
                    display: "inline-block",
                    marginBottom: "0.35rem",
                  }}
                >
                  {inspectedRecord.sourceType} • {inspectedRecord.referenceKey}
                </span>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {inspectedRecord.title}
                </h3>
              </div>
              <button
                onClick={() => setInspectedRecord(null)}
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

            {loadingInspect ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                Loading full canonical record...
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  fontSize: "0.875rem",
                }}
              >
                {/* Provenance Metadata Table */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    backgroundColor: "var(--color-card-muted)",
                    borderRadius: "6px",
                  }}
                >
                  <div>
                    <strong>Author:</strong> {inspectedRecord.author}
                  </div>
                  <div>
                    <strong>Recorded At:</strong>{" "}
                    {new Date(inspectedRecord.recordedAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Canonical ID:</strong>{" "}
                    <code>{inspectedRecord.id}</code>
                  </div>
                  <div>
                    <strong>File:</strong>{" "}
                    <code>{inspectedRecord.filePath || "N/A"}</code>
                  </div>
                </div>

                {/* Stored Excerpt / Content */}
                <div>
                  <h4
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      marginBottom: "0.4rem",
                    }}
                  >
                    Stored Content / Diff Excerpt
                  </h4>
                  <pre
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8125rem",
                      backgroundColor: "var(--color-card-muted)",
                      padding: "1rem",
                      borderRadius: "6px",
                      overflowX: "auto",
                      maxHeight: "250px",
                      whiteSpace: "pre-wrap",
                      color: "var(--color-text)",
                    }}
                  >
                    {inspectedRecord.snippet || "No snippet text stored."}
                  </pre>
                </div>

                {/* External URL */}
                <div>
                  <strong>Canonical GitHub Artifact:</strong>{" "}
                  <a
                    href={inspectedRecord.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ wordBreak: "break-all" }}
                  >
                    {inspectedRecord.url} ↗
                  </a>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setInspectedRecord(null)}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  fontWeight: 600,
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

export default function EvidencePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem", textAlign: "center" }}>
          Loading Evidence Explorer...
        </div>
      }
    >
      <EvidenceExplorerContent />
    </Suspense>
  );
}
