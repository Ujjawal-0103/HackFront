"use client";

import React, { useState } from "react";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  ariaDescribedBy?: string;
  style?: React.CSSProperties;
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "••••••••",
  disabled = false,
  required = false,
  autoComplete = "current-password",
  ariaDescribedBy,
  style,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
      <input
        id={id}
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-describedby={ariaDescribedBy}
        style={{
          width: "100%",
          padding: "0.6rem 2.75rem 0.6rem 0.85rem",
          borderRadius: "6px",
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-background)",
          color: "var(--color-text)",
          fontSize: "0.9rem",
          outline: "none",
          boxSizing: "border-box",
          fontFamily: showPassword ? "inherit" : "monospace",
          letterSpacing: showPassword ? "normal" : "0.1em",
          ...style,
        }}
      />
      <button
        id={`${id}-toggle-visibility`}
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        disabled={disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        title={showPassword ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          padding: "6px",
          cursor: disabled ? "not-allowed" : "pointer",
          color: "var(--color-text-secondary)",
          borderRadius: "4px",
          lineHeight: 0,
        }}
      >
        {showPassword ? (
          // Eye-Off Icon (indicates clicking will hide)
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
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // Eye Icon (indicates clicking will show)
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
