"use client";

import React from "react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.4rem 0.8rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        borderRadius: "6px",
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        color: "var(--color-text)",
        cursor: "pointer",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1rem" }}>
        {isDark ? "🌙" : "☀️"}
      </span>
      <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
    </button>
  );
}
