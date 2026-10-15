"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspaces, activeWorkspace, switchWorkspace, logout } =
    useAuth();

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/verify", label: "Verify" },
    { href: "/history", label: "History & Reports" },
    { href: "/repositories", label: "Repositories" },
    { href: "/evidence", label: "Evidence" },
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
              Human-Supervised Code Verification
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
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
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
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
        {user && (
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
                {activeWorkspace?.name || "Workspace"} (
                {activeWorkspace?.id || "ws_alpha"})
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
                  Authorized Workspaces
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
        )}

        {/* User Account State */}
        {user ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setShowUserMenu((v) => !v);
                setShowWorkspaceMenu(false);
              }}
              aria-label="User Account Menu"
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
              <span style={{ fontWeight: 600 }}>{user.name}</span>
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
                  minWidth: "200px",
                  zIndex: 100,
                }}
              >
                <div style={{ padding: "0.25rem 0.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    {user.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {user.email}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    marginTop: "0.35rem",
                    paddingTop: "0.35rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      setShowUserMenu(false);
                      router.push("/login");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.4rem 0.5rem",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-contradicted)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      borderRadius: "4px",
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link
              href="/login"
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                backgroundColor: "var(--color-primary)",
                color: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              Register
            </Link>
          </div>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
