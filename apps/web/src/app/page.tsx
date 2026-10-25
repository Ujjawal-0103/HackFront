"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  RepositoryDetailsDto,
  VerificationHistoryItem,
} from "@traceback/shared-types";

export default function HomePage() {
  const { user, activeWorkspace } = useAuth();

  const [repositories, setRepositories] = useState<RepositoryDetailsDto[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<
    VerificationHistoryItem[]
  >([]);
  const [decisionsCount, setDecisionsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!activeWorkspace) return;
      try {
        setIsLoading(true);
        const [repos, history] = await Promise.all([
          api.getRepositories(activeWorkspace.id).catch(() => []),
          api
            .getWorkspaceHistory(activeWorkspace.id, 1, 5)
            .catch(() => ({ items: [], total: 0 })),
        ]);
        setRepositories(repos);
        setRecentVerifications(history.items || []);

        if (repos.length > 0) {
          const decs = await api
            .getDecisions(repos[0].id, undefined, activeWorkspace.id)
            .catch(() => []);
          setDecisionsCount(decs.length);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [activeWorkspace]);

  const totalCommits = repositories.reduce(
    (acc, r) => acc + (r.counts?.commits || 0),
    0,
  );
  const totalPRs = repositories.reduce(
    (acc, r) => acc + (r.counts?.pullRequests || 0),
    0,
  );

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Top Banner */}
      <div
        style={{
          backgroundColor: "var(--color-card-muted)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0.5rem 1.5rem",
          fontSize: "0.8rem",
          color: "var(--color-text-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <span>
          <strong>Traceback Evidence System:</strong> Verifying AI coding
          explanations and proposed code changes against repository engineering
          history.
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-success)",
              fontWeight: 600,
            }}
          >
            ● System Operational
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Welcome Hero */}
        <section
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            padding: "1.75rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ maxWidth: "800px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              }}
            >
              <h1
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  letterSpacing: "-0.02em",
                }}
              >
                Welcome back{user?.name ? `, ${user.name}` : ""}
              </h1>
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
                marginBottom: "1.25rem",
              }}
            >
              Does this AI-generated explanation or proposed code change agree
              with what the repository&apos;s actual engineering history
              establishes? Traceback evaluates technical claims, checks proposed
              diffs against documented constraints, and preserves engineering
              decision memory.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link
                href="/verify"
                style={{
                  padding: "0.55rem 1.15rem",
                  backgroundColor: "var(--color-primary)",
                  color: "#FFFFFF",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                }}
              >
                <span>🔍</span>
                <span>Verify AI Explanation</span>
              </Link>

              <Link
                href="/intent"
                style={{
                  padding: "0.55rem 1.15rem",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>⚡</span>
                <span>Check Historical Intent</span>
              </Link>

              <Link
                href="/decisions"
                style={{
                  padding: "0.55rem 1.15rem",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>🏛️</span>
                <span>Decision Memory</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 3 Core Pillars Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {/* Pillar 1 */}
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🔍</span>
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    margin: 0,
                  }}
                >
                  Claim-to-Evidence Verification
                </h2>
              </div>
              <p
                style={{
                  fontSize: "0.825rem",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "1rem",
                }}
              >
                Decompose compound code explanations into factual claims and
                cross-check against repository commits, PRs, and ADRs with
                strict 3-state epistemological abstention.
              </p>
            </div>
            <Link
              href="/verify"
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-primary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              Open Verification Studio →
            </Link>
          </div>

          {/* Pillar 2 */}
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>⚡</span>
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    margin: 0,
                  }}
                >
                  Historical Intent Check
                </h2>
              </div>
              <p
                style={{
                  fontSize: "0.825rem",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "1rem",
                }}
              >
                Evaluate proposed diffs against documented architectural
                decisions, security invariants, and past reverts before code is
                merged.
              </p>
            </div>
            <Link
              href="/intent"
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-primary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              Open Historical Intent Studio →
            </Link>
          </div>

          {/* Pillar 3 */}
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🏛️</span>
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    margin: 0,
                  }}
                >
                  Engineering Decision Memory
                </h2>
              </div>
              <p
                style={{
                  fontSize: "0.825rem",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "1rem",
                }}
              >
                Maintain a persistent library of human-reviewed engineering
                decisions linked to concrete Git evidence, tracking candidate,
                accepted, and superseded lifecycles.
              </p>
            </div>
            <Link
              href="/decisions"
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-primary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              Open Decision Memory →
            </Link>
          </div>
        </section>

        {/* Workspace Metrics & Recent Activity Grid */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
          }}
        >
          {/* Workspace Stats */}
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "1.25rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--color-text)",
                marginBottom: "1rem",
              }}
            >
              Workspace Engineering History
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Connected Repositories
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginTop: "0.2rem",
                  }}
                >
                  {repositories.length}
                </div>
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Decision Invariants
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginTop: "0.2rem",
                  }}
                >
                  {decisionsCount}
                </div>
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Indexed Commits
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginTop: "0.2rem",
                  }}
                >
                  {totalCommits}
                </div>
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--color-card-muted)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Pull Requests
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginTop: "0.2rem",
                  }}
                >
                  {totalPRs}
                </div>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link
                href="/repositories"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-primary)",
                }}
              >
                Manage Repositories & Sync →
              </Link>
            </div>
          </div>

          {/* Recent Verifications */}
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
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                Recent Verification Sessions
              </h3>
              <Link
                href="/history"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-primary)",
                  fontWeight: 600,
                }}
              >
                View All →
              </Link>
            </div>

            {isLoading ? (
              <div
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "var(--color-text-muted)",
                }}
              >
                Loading activity...
              </div>
            ) : recentVerifications.length === 0 ? (
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
                No verification sessions recorded yet.
                <div style={{ marginTop: "0.5rem" }}>
                  <Link
                    href="/verify"
                    style={{ color: "var(--color-primary)", fontWeight: 600 }}
                  >
                    Run your first verification →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                {recentVerifications.slice(0, 4).map((v) => (
                  <Link
                    key={v.id}
                    href={`/verify?sessionId=${v.id}&repoId=${v.repositoryId}`}
                    style={{
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-card-muted)",
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        marginBottom: "0.2rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--color-primary)",
                        }}
                      >
                        {v.repositoryFullName || "Repository"}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {v.explanation}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
