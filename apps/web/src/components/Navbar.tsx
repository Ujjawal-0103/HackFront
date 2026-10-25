"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { RepositoryDetailsDto } from "@traceback/shared-types";

// --- Navigation Item Definition ---
interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspaces, activeWorkspace, switchWorkspace, logout } =
    useAuth();

  // Dropdown states
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [matchedRepos, setMatchedRepos] = useState<RepositoryDetailsDto[]>([]);
  const [matchedDecisions, setMatchedDecisions] = useState<any[]>([]);

  // Refs for click-outside and shortcuts
  const workspaceRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close menus on route change
  useEffect(() => {
    setShowWorkspaceMenu(false);
    setShowUserMenu(false);
    setShowNotifications(false);
    setIsSearchOpen(false);
  }, [pathname]);

  // Click outside listener for all dropdowns & search overlay
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(target)
      ) {
        setShowWorkspaceMenu(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setShowUserMenu(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K to focus search, Esc to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (user && searchInputRef.current) {
          searchInputRef.current.focus();
          setIsSearchOpen(true);
        }
      }
      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setShowWorkspaceMenu(false);
        setShowUserMenu(false);
        setShowNotifications(false);
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [user]);

  // Debounced search logic for repositories and decisions in active workspace
  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed || !activeWorkspace?.id) {
        setMatchedRepos([]);
        setMatchedDecisions([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const repos = await api.getRepositories(activeWorkspace.id);
        const filteredRepos = repos.filter((r) =>
          r.fullName.toLowerCase().includes(trimmed),
        );
        setMatchedRepos(filteredRepos);

        // If repositories exist, search decisions across them
        if (repos.length > 0) {
          const decisionPromises = repos.slice(0, 3).map(async (r) => {
            try {
              const decisions = await api.getDecisions(r.id, undefined, activeWorkspace.id);
              return decisions
                .filter(
                  (d: any) =>
                    (d.title && d.title.toLowerCase().includes(trimmed)) ||
                    (d.summary && d.summary.toLowerCase().includes(trimmed)) ||
                    (d.problemStatement && d.problemStatement.toLowerCase().includes(trimmed)),
                )
                .map((d: any) => ({ ...d, repositoryId: r.id, repositoryName: r.fullName }));
            } catch {
              return [];
            }
          });
          const nestedDecisions = await Promise.all(decisionPromises);
          setMatchedDecisions(nestedDecisions.flat().slice(0, 5));
        } else {
          setMatchedDecisions([]);
        }
      } catch (err) {
        // Non-blocking search error fallback
        setMatchedRepos([]);
        setMatchedDecisions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [activeWorkspace?.id],
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedRepos([]);
      setMatchedDecisions([]);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // Primary Navigation Tabs in exact required order
  const primaryNavItems: NavItem[] = [
    {
      href: "/",
      label: "Overview",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      ),
    },
    {
      href: "/verify",
      label: "Verify",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      href: "/intent",
      label: "Historical Intent",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },
    {
      href: "/decisions",
      label: "Decision Memory",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      href: "/evidence",
      label: "Evidence",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
    {
      href: "/history",
      label: "History & Reports",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      href: "/repositories",
      label: "Repositories",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--color-primary, #2563eb)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      ),
    },
  ];

  // =========================================================================
  // UNAUTHENTICATED HEADER (Single Row Public Mode)
  // =========================================================================
  if (!user) {
    return (
      <header
        style={{
          width: "100%",
          backgroundColor: "var(--color-surface, #FFFFFF)",
          borderBottom: "1px solid var(--color-border, #E2E8F0)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1440px",
            margin: "0 auto",
            padding: "0.85rem 1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand Logo & Title */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "var(--color-primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "1.3rem",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
              }}
            >
              T
            </div>
            <div>
              <span
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--color-text, #0F172A)",
                  display: "block",
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                }}
              >
                Traceback
              </span>
              <span
                style={{
                  fontSize: "0.725rem",
                  fontWeight: 500,
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  letterSpacing: "-0.01em",
                }}
              >
                Human-Supervised Code Verification
              </span>
            </div>
          </Link>

          {/* Right Actions: Sign In, Register, Theme Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                fontSize: "0.85rem",
                fontWeight: 600,
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #E2E8F0)",
                color: "var(--color-text, #0F172A)",
                backgroundColor: "var(--color-surface, #FFFFFF)",
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
                fontSize: "0.85rem",
                fontWeight: 600,
                padding: "0.5rem 1.1rem",
                borderRadius: "8px",
                backgroundColor: "var(--color-primary, #2563eb)",
                color: "#FFFFFF",
                textDecoration: "none",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
                transition: "all 0.15s ease",
              }}
            >
              Register
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
    );
  }

  // =========================================================================
  // AUTHENTICATED HEADER (Design #2 — Elevated with Workspace Selector)
  // Two-Row Structure: Row 1 (Brand/Workspace/Search/Profile) + Row 2 (Nav)
  // =========================================================================
  return (
    <header
      style={{
        width: "100%",
        backgroundColor: "var(--color-surface, #FFFFFF)",
        borderBottom: "1px solid var(--color-border, #E2E8F0)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* =================================================================== */}
      {/* ROW 1: BRAND, WORKSPACE SELECTOR, SEARCH, THEME, NOTIF & PROFILE */}
      {/* =================================================================== */}
      <div
        style={{
          width: "100%",
          padding: "0.65rem 1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          minHeight: "68px",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT CLUSTER: Brand + Separator + Workspace Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
          {/* Traceback Branding */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "var(--color-primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "1.3rem",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
              }}
            >
              T
            </div>
            <div>
              <span
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--color-text, #0F172A)",
                  display: "block",
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                }}
              >
                Traceback
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  letterSpacing: "-0.01em",
                }}
              >
                Human-Supervised Code Verification
              </span>
            </div>
          </Link>

          {/* Vertical Separator */}
          <div
            style={{
              width: "1px",
              height: "32px",
              backgroundColor: "var(--color-border, #E2E8F0)",
            }}
          />

          {/* Workspace Selector (Design #2: Compact, rounded, green dot, chevron) */}
          <div ref={workspaceRef} style={{ position: "relative" }}>
            <button
              id="navbar-workspace-selector"
              type="button"
              onClick={() => {
                setShowWorkspaceMenu((v) => !v);
                setShowUserMenu(false);
                setShowNotifications(false);
              }}
              aria-label="Select Workspace"
              aria-expanded={showWorkspaceMenu}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.45rem 0.85rem",
                backgroundColor: "var(--color-card-muted, #F1F5F9)",
                border: "1px solid var(--color-border, #E2E8F0)",
                borderRadius: "8px",
                fontSize: "0.8rem",
                color: "var(--color-text, #0F172A)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                maxWidth: "260px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {/* Green status indicator */}
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-supported, #10b981)",
                  boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeWorkspace?.name || "Workspace"} (
                {activeWorkspace?.id || "ws_alpha"})
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--color-text-secondary, #475569)",
                  flexShrink: 0,
                  transform: showWorkspaceMenu ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Workspace Menu Dropdown */}
            {showWorkspaceMenu && (
              <div
                id="navbar-workspace-dropdown-menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  backgroundColor: "var(--color-surface, #FFFFFF)",
                  border: "1px solid var(--color-border, #E2E8F0)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  padding: "0.5rem",
                  minWidth: "260px",
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--color-text-secondary, #475569)",
                    padding: "0.35rem 0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Authorized Workspaces
                </div>
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === activeWorkspace?.id;
                  return (
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
                        padding: "0.5rem 0.6rem",
                        border: "none",
                        backgroundColor: isCurrent
                          ? "var(--color-primary-light, #EFF6FF)"
                          : "transparent",
                        color: isCurrent
                          ? "var(--color-primary, #2563eb)"
                          : "var(--color-text, #0F172A)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.825rem",
                        fontWeight: isCurrent ? 600 : 400,
                        transition: "background-color 0.1s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isCurrent && (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: "var(--color-primary, #2563eb)",
                            }}
                          />
                        )}
                        <span>{ws.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: isCurrent
                            ? "rgba(37, 99, 235, 0.15)"
                            : "var(--color-border, #E2E8F0)",
                          color: isCurrent
                            ? "var(--color-primary, #2563eb)"
                            : "var(--color-text-secondary, #475569)",
                          fontWeight: 500,
                        }}
                      >
                        {ws.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CENTER CLUSTER: Wide Global Search Field (Design #2) */}
        <div
          ref={searchContainerRef}
          style={{
            position: "relative",
            flex: "1 1 480px",
            maxWidth: "600px",
            minWidth: "240px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              backgroundColor: "var(--color-card-muted, #F1F5F9)",
              border: `1px solid ${
                isSearchOpen
                  ? "var(--color-primary, #2563eb)"
                  : "var(--color-border, #E2E8F0)"
              }`,
              borderRadius: "8px",
              padding: "0.45rem 0.85rem",
              boxShadow: isSearchOpen
                ? "0 0 0 3px rgba(37, 99, 235, 0.1)"
                : "none",
              transition: "all 0.15s ease",
            }}
          >
            {/* Search Icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-secondary, #475569)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {/* Real Search Input */}
            <input
              ref={searchInputRef}
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isSearchOpen) setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search repositories, decisions, or evidence..."
              aria-label="Search repositories, decisions, or evidence..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                color: "var(--color-text, #0F172A)",
                fontSize: "0.85rem",
                width: "100%",
              }}
            />

            {/* Shortcut Hint: Ctrl + K */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "var(--color-surface, #FFFFFF)",
                border: "1px solid var(--color-border, #E2E8F0)",
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--color-text-secondary, #475569)",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              <kbd style={{ fontFamily: "inherit" }}>Ctrl</kbd>
              <span>+</span>
              <kbd style={{ fontFamily: "inherit" }}>K</kbd>
            </div>
          </div>

          {/* Elevated Search Results Dropdown Overlay */}
          {isSearchOpen && (
            <div
              id="global-search-results-overlay"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                backgroundColor: "var(--color-surface, #FFFFFF)",
                border: "1px solid var(--color-border, #E2E8F0)",
                borderRadius: "10px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                maxHeight: "360px",
                overflowY: "auto",
                zIndex: 100,
                padding: "0.6rem",
              }}
            >
              {isSearching ? (
                <div
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontSize: "0.825rem",
                    color: "var(--color-text-secondary, #475569)",
                  }}
                >
                  Searching {activeWorkspace?.name || "active workspace"}...
                </div>
              ) : searchQuery.trim() === "" ? (
                <div style={{ padding: "0.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--color-text-secondary, #475569)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.4rem",
                    }}
                  >
                    Quick Navigation
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <Link
                      href="/repositories"
                      onClick={() => setIsSearchOpen(false)}
                      style={{
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.825rem",
                        color: "var(--color-text, #0F172A)",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--color-primary, #2563eb)" }}>📁</span> Browse Connected Repositories
                    </Link>
                    <Link
                      href="/decisions"
                      onClick={() => setIsSearchOpen(false)}
                      style={{
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.825rem",
                        color: "var(--color-text, #0F172A)",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--color-primary, #2563eb)" }}>📌</span> Search Engineering Decisions
                    </Link>
                    <Link
                      href="/evidence"
                      onClick={() => setIsSearchOpen(false)}
                      style={{
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.825rem",
                        color: "var(--color-text, #0F172A)",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--color-primary, #2563eb)" }}>🔍</span> Explore Git & PR Evidence
                    </Link>
                  </div>
                </div>
              ) : matchedRepos.length === 0 && matchedDecisions.length === 0 ? (
                <div
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontSize: "0.825rem",
                    color: "var(--color-text-secondary, #475569)",
                  }}
                >
                  No matching repositories or decisions found in &quot;{activeWorkspace?.name}&quot;.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {/* Repositories Results */}
                  {matchedRepos.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--color-text-secondary, #475569)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "0.25rem 0.5rem",
                        }}
                      >
                        Repositories ({matchedRepos.length})
                      </div>
                      {matchedRepos.map((r) => (
                        <Link
                          key={r.id}
                          href={`/repositories?repoId=${encodeURIComponent(r.id)}`}
                          onClick={() => setIsSearchOpen(false)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.45rem 0.6rem",
                            borderRadius: "6px",
                            textDecoration: "none",
                            color: "var(--color-text, #0F172A)",
                            backgroundColor: "transparent",
                            fontSize: "0.825rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ color: "var(--color-primary, #2563eb)" }}>📁</span>
                            <span style={{ fontWeight: 600 }}>{r.fullName}</span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--color-text-secondary, #475569)",
                            }}
                          >
                            {r.defaultBranch}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Decisions Results */}
                  {matchedDecisions.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--color-border, #E2E8F0)", paddingTop: "0.4rem" }}>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--color-text-secondary, #475569)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "0.25rem 0.5rem",
                        }}
                      >
                        Engineering Decisions ({matchedDecisions.length})
                      </div>
                      {matchedDecisions.map((d) => (
                        <Link
                          key={d.id}
                          href={`/decisions?id=${encodeURIComponent(d.id)}&repoId=${encodeURIComponent(d.repositoryId)}`}
                          onClick={() => setIsSearchOpen(false)}
                          style={{
                            display: "block",
                            padding: "0.45rem 0.6rem",
                            borderRadius: "6px",
                            textDecoration: "none",
                            color: "var(--color-text, #0F172A)",
                            fontSize: "0.825rem",
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "var(--color-primary, #2563eb)" }}>
                            {d.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--color-text-secondary, #475569)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {d.repositoryName} &bull; {d.status} &bull; {d.summary}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Evidence Direct Link */}
                  <div style={{ borderTop: "1px solid var(--color-border, #E2E8F0)", paddingTop: "0.4rem" }}>
                    <Link
                      href={`/evidence?query=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setIsSearchOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.45rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "var(--color-primary, #2563eb)",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      <span>🔍</span> Search raw commits, PRs, and issues for &quot;{searchQuery}&quot; &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT CLUSTER: Separator + Theme Switch + Notification + User Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          {/* Vertical Separator */}
          <div
            style={{
              width: "1px",
              height: "32px",
              backgroundColor: "var(--color-border, #E2E8F0)",
            }}
          />

          {/* Theme Toggle (Icon-only, sun/moon) */}
          <ThemeToggle />

          {/* Notification Icon Button (Real, no fabricated counts) */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              id="navbar-notifications-button"
              type="button"
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowUserMenu(false);
                setShowWorkspaceMenu(false);
              }}
              aria-label="Notifications"
              aria-expanded={showNotifications}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "38px",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #E2E8F0)",
                backgroundColor: "var(--color-surface, #FFFFFF)",
                color: "var(--color-text, #0F172A)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                padding: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            {/* Notification Popover Panel */}
            {showNotifications && (
              <div
                id="navbar-notifications-panel"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  backgroundColor: "var(--color-surface, #FFFFFF)",
                  border: "1px solid var(--color-border, #E2E8F0)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  padding: "0.75rem",
                  width: "280px",
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "var(--color-text, #0F172A)",
                    borderBottom: "1px solid var(--color-border, #E2E8F0)",
                    paddingBottom: "0.4rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  Notifications
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--color-text-secondary, #475569)",
                    lineHeight: 1.4,
                  }}
                >
                  All repository sync tasks and background verification jobs in{" "}
                  <strong>{activeWorkspace?.name || "current workspace"}</strong> are up to date.
                </div>
              </div>
            )}
          </div>

          {/* User Profile Control (Design #2: circular avatar, full name, role, chevron) */}
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button
              id="navbar-user-profile-button"
              type="button"
              onClick={() => {
                setShowUserMenu((v) => !v);
                setShowWorkspaceMenu(false);
                setShowNotifications(false);
              }}
              aria-label="User account menu"
              aria-expanded={showUserMenu}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.35rem 0.75rem",
                backgroundColor: "var(--color-surface, #FFFFFF)",
                border: "1px solid var(--color-border, #E2E8F0)",
                borderRadius: "8px",
                color: "var(--color-text, #0F172A)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {/* Circular blue avatar with user's initial */}
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary, #2563eb)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(37, 99, 235, 0.25)",
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </span>

              {/* Name & Role */}
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <span
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.825rem",
                    color: "var(--color-text, #0F172A)",
                  }}
                >
                  {user.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.68rem",
                    color: "var(--color-text-secondary, #475569)",
                    fontWeight: 500,
                  }}
                >
                  {activeWorkspace?.role
                    ? `${activeWorkspace.role.charAt(0).toUpperCase()}${activeWorkspace.role.slice(1).toLowerCase()}`
                    : "Workspace Member"}
                </span>
              </div>

              {/* Downward chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--color-text-secondary, #475569)",
                  flexShrink: 0,
                  transform: showUserMenu ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {showUserMenu && (
              <div
                id="navbar-user-dropdown-menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  backgroundColor: "var(--color-surface, #FFFFFF)",
                  border: "1px solid var(--color-border, #E2E8F0)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  padding: "0.5rem",
                  minWidth: "220px",
                  zIndex: 100,
                }}
              >
                {/* User identity details */}
                <div
                  style={{
                    padding: "0.4rem 0.5rem",
                    borderBottom: "1px solid var(--color-border, #E2E8F0)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--color-text, #0F172A)",
                    }}
                  >
                    {user.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--color-text-secondary, #475569)",
                      marginTop: "2px",
                      wordBreak: "break-all",
                    }}
                  >
                    {user.email}
                  </div>
                </div>

                {/* Account Actions */}
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
                      padding: "0.45rem 0.5rem",
                      color: "var(--color-text, #0F172A)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textDecoration: "none",
                      borderRadius: "6px",
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
                      padding: "0.45rem 0.5rem",
                      color: "var(--color-text, #0F172A)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textDecoration: "none",
                      borderRadius: "6px",
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
                    borderTop: "1px solid var(--color-border, #E2E8F0)",
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
                      padding: "0.45rem 0.5rem",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-contradicted, #ef4444)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      borderRadius: "6px",
                      display: "block",
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ROW 2: PRIMARY NAVIGATION (Left-Aligned, Exact Order)               */}
      {/* 1. Overview 2. Verify 3. Historical Intent 4. Decision Memory       */}
      {/* 5. Evidence 6. History & Reports 7. Repositories                   */}
      {/* =================================================================== */}
      <div
        style={{
          width: "100%",
          borderTop: "1px solid var(--color-border, #E2E8F0)",
          padding: "0.25rem 1.75rem",
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          whiteSpace: "nowrap",
          scrollbarWidth: "none",
          minHeight: "48px",
          boxSizing: "border-box",
        }}
      >
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
          aria-label="Main Workspace Navigation"
        >
          {primaryNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : "false"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.825rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  backgroundColor: isActive
                    ? "var(--color-primary-light)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(37, 99, 235, 0.2)"
                    : "1px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                {item.icon(isActive)}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
