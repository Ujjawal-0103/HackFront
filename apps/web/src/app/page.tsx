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
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [activeWorkspace]);

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Sprints 1 through 6 Operational Banner */}
      <div
        style={{
          backgroundColor: "var(--color-card-muted)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0.5rem 2rem",
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <span>
          <strong>Traceback V1 Operational:</strong> Grounded claim assessment,
          persistent verification history, and human-supervised review active.
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/verify"
            style={{
              fontWeight: 600,
              fontSize: "0.8125rem",
              color: "var(--color-primary)",
            }}
          >
            Launch Verification Workspace →
          </Link>
        </div>
      </div>

      {/* Main Dashboard */}
      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: "1160px",
          width: "100%",
          margin: "0 auto",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {/* Welcome & Primary Actions Hero */}
        <section
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ maxWidth: "700px" }}>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--color-text)",
                marginBottom: "0.5rem",
              }}
            >
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </h1>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
                marginBottom: "1.5rem",
              }}
            >
              Traceback bridges the trust gap between AI coding assistants and
              repository history. Decompose explanations into technical claims,
              cross-check against Git commits and PRs, and record authoritative
              human verdicts.
            </p>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link
                href="/verify"
                style={{
                  padding: "0.7rem 1.4rem",
                  backgroundColor: "var(--color-primary)",
                  color: "#FFFFFF",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>🔍</span>
                <span>Verify AI Explanation</span>
              </Link>

              <Link
                href="/history"
                style={{
                  padding: "0.7rem 1.4rem",
                  backgroundColor: "var(--color-card-muted)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>📜</span>
                <span>View Verification History</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-secondary)",
                marginBottom: "0.25rem",
              }}
            >
              Active Workspace
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              {activeWorkspace?.name || "Loading..."}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                marginTop: "0.25rem",
              }}
            >
              Role: <code>{activeWorkspace?.role || "MEMBER"}</code>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-secondary)",
                marginBottom: "0.25rem",
              }}
            >
              Connected Repositories
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              {isLoading ? "..." : repositories.length}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-primary)",
                marginTop: "0.25rem",
              }}
            >
              <Link
                href="/repositories"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                Manage repositories →
              </Link>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-secondary)",
                marginBottom: "0.25rem",
              }}
            >
              Past Verifications
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              {isLoading ? "..." : recentVerifications.length}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-primary)",
                marginTop: "0.25rem",
              }}
            >
              <Link
                href="/history"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                Browse full history →
              </Link>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-secondary)",
                marginBottom: "0.25rem",
              }}
            >
              System Trust Layer
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-success)",
              }}
            >
              Verified (SEC-09)
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                marginTop: "0.25rem",
              }}
            >
              Zero-tolerance citation check
            </div>
          </div>
        </section>

        {/* Recent Verifications Shelf */}
        <section
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            padding: "1.5rem",
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
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              Recent Workspace Verifications
            </h2>
            <Link
              href="/history"
              style={{
                fontSize: "0.85rem",
                color: "var(--color-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View All History →
            </Link>
          </div>

          {isLoading ? (
            <div
              style={{
                padding: "1.5rem",
                textAlign: "center",
                color: "var(--color-text-secondary)",
              }}
            >
              Loading recent sessions...
            </div>
          ) : recentVerifications.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                backgroundColor: "var(--color-card-muted)",
                borderRadius: "6px",
                color: "var(--color-text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              No verifications saved yet. Click &ldquo;Verify AI
              Explanation&rdquo; above to start.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {recentVerifications.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: "0.85rem 1rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "var(--color-text)",
                      }}
                    >
                      {v.repositoryFullName}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "500px",
                      }}
                    >
                      &ldquo;{v.explanation}&rdquo;
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {v.claimsCount} claims
                    </span>
                    <Link
                      href={`/verify?sessionId=${v.id}&repoId=${v.repositoryId}`}
                      style={{
                        padding: "0.35rem 0.75rem",
                        backgroundColor: "var(--color-card-muted)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--color-primary)",
                        textDecoration: "none",
                      }}
                    >
                      Reopen →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          padding: "1rem 2rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--color-text-secondary)",
        }}
      >
        Traceback V1 • Epistemological Evidence Verification • Sprints 1–6
        Complete
      </footer>
    </div>
  );
}
