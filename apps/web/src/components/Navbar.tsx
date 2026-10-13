"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const { user, workspaces, activeWorkspace, switchWorkspace, login, logout } =
    useAuth();

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/repositories", label: "Repositories & Ingestion" },
    { href: "/evidence", label: "Evidence Explorer" },
  ];

  const devUsers = [
    { id: "user_1", name: "Alex Maintainer", org: "Alpha Corp (Owner)" },
    { id: "user_2", name: "Sam Reviewer", org: "Alpha Corp (Member)" },
    { id: "user_3", name: "Jordan Security", org: "Beta Labs (Owner)" },
  ];

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        padding: "0.75rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "1.125rem",
            }}
          >
            T
          </div>
          <div>
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--color-text)",
                display: "block",
                lineHeight: 1.2,
              }}
            >
              Traceback
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-secondary)",
                display: "block",
              }}
            >
              Code Rationale Verification (T1.1)
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginLeft: "1rem",
          }}
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  backgroundColor: isActive
                    ? "var(--color-card-muted)"
                    : "transparent",
                  textDecoration: "none",
                  border: isActive
                    ? "1px solid var(--color-border)"
                    : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Workspace Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setShowWorkspaceMenu((v) => !v);
              setShowUserMenu(false);
            }}
            aria-label="Select Workspace"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.75rem",
              backgroundColor: "var(--color-card-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--color-success)",
              }}
            />
            <span>
              {activeWorkspace?.id === "ws_alpha"
                ? "Alpha Corp (ws_alpha)"
                : `${activeWorkspace?.name || "Workspace"} (${activeWorkspace?.id || "ws_alpha"})`}
            </span>
            <span style={{ fontSize: "0.6rem" }}>▼</span>
          </button>

          {showWorkspaceMenu && (
            <div
              style={{
                position: "absolute",
                top: "120%",
                right: 0,
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                padding: "0.5rem",
                minWidth: "220px",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  padding: "0.25rem 0.5rem",
                  textTransform: "uppercase",
                }}
              >
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setShowWorkspaceMenu(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0.5rem",
                    border: "none",
                    background:
                      ws.id === activeWorkspace?.id
                        ? "var(--color-card-muted)"
                        : "transparent",
                    color: "var(--color-text)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.8rem",
                  }}
                >
                  <span>{ws.name}</span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {ws.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Switcher Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((v) => !v);
              setShowWorkspaceMenu(false);
            }}
            aria-label="Select User Account"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.35rem 0.75rem",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              fontSize: "0.75rem",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <span>👤</span>
            <span>{user?.name || "Sign in"}</span>
            <span style={{ fontSize: "0.6rem" }}>▼</span>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                top: "120%",
                right: 0,
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                padding: "0.5rem",
                minWidth: "220px",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  padding: "0.25rem 0.5rem",
                  textTransform: "uppercase",
                }}
              >
                Current User: {user?.id}
              </div>
              {devUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={async () => {
                    await login(u.id);
                    setShowUserMenu(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "0.4rem 0.5rem",
                    border: "none",
                    background:
                      u.id === user?.id
                        ? "var(--color-card-muted)"
                        : "transparent",
                    color: "var(--color-text)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {u.org}
                  </span>
                </button>
              ))}
              <div
                style={{
                  borderTop: "1px solid var(--color-border)",
                  marginTop: "0.25rem",
                  paddingTop: "0.25rem",
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setShowUserMenu(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.35rem 0.5rem",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-contradicted)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
