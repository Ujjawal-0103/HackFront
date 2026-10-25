"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setShowWorkspaceMenu(false);
    setShowUserMenu(false);
    setMobileNavOpen(false);
  }, [pathname]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(event.target as Node)
      ) {
        setShowWorkspaceMenu(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        padding: "0.75rem 1.5rem",
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
      {/* LEFT: Logo & Branding */}
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
              backgroundColor: "var(--color-primary, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "1.125rem",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            }}
          >
            T
          </div>
          <div>
            <span
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-text)",
                display: "block",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
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
      </div>

      {/* CENTER: Navigation Tabs (ONLY visible when authenticated) */}
      {user && (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
          aria-label="Main Workspace Navigation"
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
                    ? "var(--color-primary, #2563eb)"
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
      )}

      {/* RIGHT: Actions (Authenticated Profile / Unauthenticated Sign In + Theme Toggle) */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {user ? (
          <>
            {/* Workspace Selector */}
            <div ref={workspaceRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setShowWorkspaceMenu((v) => !v);
                  setShowUserMenu(false);
                }}
                aria-label="Select Workspace"
                aria-expanded={showWorkspaceMenu}
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
                  transition: "background-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-supported, #10b981)",
                  }}
                />
                <span style={{ fontWeight: 500 }}>
                  {activeWorkspace?.name || "Workspace"} (
                  {activeWorkspace?.id || "ws_alpha"})
                </span>
                <span style={{ fontSize: "0.6rem", color: "var(--color-text-secondary)" }}>
                  ▼
                </span>
              </button>

              {showWorkspaceMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
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
                      letterSpacing: "0.05em",
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
                      <span style={{ fontWeight: ws.id === activeWorkspace?.id ? 600 : 400 }}>
                        {ws.name}
                      </span>
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

            {/* Profile Dropdown */}
            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button
                id="navbar-user-profile-button"
                type="button"
                onClick={() => {
                  setShowUserMenu((v) => !v);
                  setShowWorkspaceMenu(false);
                }}
                aria-label="User Account Menu"
                aria-expanded={showUserMenu}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.75rem",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-primary, #2563eb)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                  }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </span>
                <span style={{ fontWeight: 600 }}>{user.name}</span>
                <span style={{ fontSize: "0.6rem", color: "var(--color-text-secondary)" }}>
                  ▼
                </span>
              </button>

              {showUserMenu && (
                <div
                  id="navbar-user-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                    padding: "0.5rem",
                    minWidth: "220px",
                    zIndex: 100,
                  }}
                >
                  {/* User identity details */}
                  <div style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--color-text)",
                      }}
                    >
                      {user.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                        marginTop: "2px",
                        wordBreak: "break-all",
                      }}
                    >
                      {user.email}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      paddingTop: "0.35rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <Link
                      id="navbar-switch-account-link"
                      href="/login"
                      onClick={() => setShowUserMenu(false)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.4rem 0.5rem",
                        color: "var(--color-text)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        textDecoration: "none",
                        borderRadius: "4px",
                        display: "block",
                        boxSizing: "border-box",
                      }}
                    >
                      Switch Account
                    </Link>
                    <Link
                      id="navbar-register-account-link"
                      href="/register"
                      onClick={() => setShowUserMenu(false)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.4rem 0.5rem",
                        color: "var(--color-text)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        textDecoration: "none",
                        borderRadius: "4px",
                        display: "block",
                        boxSizing: "border-box",
                      }}
                    >
                      Register New Account
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div
                    style={{
                      borderTop: "1px solid var(--color-border)",
                      marginTop: "0.35rem",
                      paddingTop: "0.35rem",
                    }}
                  >
                    <button
                      id="navbar-sign-out-button"
                      type="button"
                      onClick={async () => {
                        setShowUserMenu(false);
                        await logout();
                        router.push("/login");
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.4rem 0.5rem",
                        border: "none",
                        background: "transparent",
                        color: "var(--color-contradicted, #ef4444)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        borderRadius: "4px",
                        display: "block",
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Unauthenticated Navbar: Sign In & Register buttons */
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link
              id="navbar-sign-in-link"
              href={
                pathname &&
                pathname !== "/login" &&
                pathname !== "/register" &&
                pathname !== "/forgot-password" &&
                pathname !== "/reset-password"
                  ? `/login?returnTo=${encodeURIComponent(pathname)}`
                  : "/login"
              }
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              Sign In
            </Link>
            <Link
              id="navbar-register-link"
              href={
                pathname &&
                pathname !== "/login" &&
                pathname !== "/register" &&
                pathname !== "/forgot-password" &&
                pathname !== "/reset-password"
                  ? `/register?returnTo=${encodeURIComponent(pathname)}`
                  : "/register"
              }
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                backgroundColor: "var(--color-primary, #2563eb)",
                color: "#FFFFFF",
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                transition: "all 0.15s ease",
              }}
            >
              Register
            </Link>
          </div>
        )}

        {/* Theme Toggle Button (Icon-Only) */}
        <ThemeToggle />
      </div>
    </header>
  );
}
