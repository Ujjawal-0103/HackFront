"use client";

import React, { useMemo } from "react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export type StrengthLevel = "Too short" | "Weak" | "Fair" | "Strong";

export function evaluatePasswordStrength(password: string): {
  level: StrengthLevel;
  score: number; // 0 to 4
  color: string;
  hasMinLength: boolean;
  hasLetters: boolean;
  hasNumbers: boolean;
  hasMixedCase: boolean;
  hasSpecial: boolean;
  isValid: boolean;
} {
  const hasMinLength = password.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const isValid = hasMinLength && hasLetters && hasNumbers;

  if (password.length === 0) {
    return {
      level: "Too short",
      score: 0,
      color: "var(--color-border)",
      hasMinLength: false,
      hasLetters: false,
      hasNumbers: false,
      hasMixedCase: false,
      hasSpecial: false,
      isValid: false,
    };
  }

  if (!hasMinLength) {
    return {
      level: "Too short",
      score: 1,
      color: "var(--color-contradicted, #ef4444)",
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasMixedCase,
      hasSpecial,
      isValid: false,
    };
  }

  if (!hasLetters || !hasNumbers) {
    return {
      level: "Weak",
      score: 1,
      color: "var(--color-contradicted, #ef4444)",
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasMixedCase,
      hasSpecial,
      isValid: false,
    };
  }

  // At this point, password meets minimum backend requirements (>=8 chars, letters and numbers)
  let score = 2;
  if (hasMixedCase) score += 1;
  if (hasSpecial) score += 1;
  if (password.length >= 12 && score >= 3) score = 4;

  if (score >= 4) {
    return {
      level: "Strong",
      score: 4,
      color: "var(--color-supported, #10b981)",
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasMixedCase,
      hasSpecial,
      isValid: true,
    };
  } else if (score === 3) {
    return {
      level: "Fair",
      score: 3,
      color: "var(--color-accent-amber, #f59e0b)",
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasMixedCase,
      hasSpecial,
      isValid: true,
    };
  } else {
    return {
      level: "Weak",
      score: 2,
      color: "var(--color-accent-amber, #f59e0b)",
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasMixedCase,
      hasSpecial,
      isValid: true,
    };
  }
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  if (!password) {
    return null;
  }

  return (
    <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }} aria-live="polite">
      {/* Strength Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
        <div
          style={{
            flex: 1,
            height: "4px",
            backgroundColor: "var(--color-border)",
            borderRadius: "2px",
            overflow: "hidden",
            display: "flex",
            gap: "2px",
          }}
        >
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              style={{
                flex: 1,
                backgroundColor: step <= strength.score ? strength.color : "transparent",
                transition: "background-color 0.2s ease",
              }}
            />
          ))}
        </div>
        <span
          id="password-strength-label"
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: strength.color,
            minWidth: "65px",
            textAlign: "right",
          }}
        >
          {strength.level}
        </span>
      </div>

      {/* Requirement Checkpoints */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0.4rem 0 0 0",
          fontSize: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
          color: "var(--color-text-secondary)",
        }}
      >
        <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: strength.hasMinLength ? "var(--color-supported, #10b981)" : "inherit" }}>
            {strength.hasMinLength ? "✓" : "○"}
          </span>
          <span>At least 8 characters</span>
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: strength.hasLetters && strength.hasNumbers ? "var(--color-supported, #10b981)" : "inherit" }}>
            {strength.hasLetters && strength.hasNumbers ? "✓" : "○"}
          </span>
          <span>Contains letters and numbers</span>
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: strength.hasMixedCase || strength.hasSpecial ? "var(--color-supported, #10b981)" : "inherit" }}>
            {strength.hasMixedCase || strength.hasSpecial ? "✓" : "○"}
          </span>
          <span>Mixed case or symbols (recommended for higher strength)</span>
        </li>
      </ul>
    </div>
  );
}
