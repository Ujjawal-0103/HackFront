"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/repositories", label: "Repositories & Ingestion" },
    { href: "/evidence", label: "Evidence Explorer" },
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

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Workspace Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.35rem 0.75rem",
            backgroundColor: "var(--color-card-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            color: "var(--color-text-secondary)",
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
          <span>Alpha Corp (ws_alpha)</span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
