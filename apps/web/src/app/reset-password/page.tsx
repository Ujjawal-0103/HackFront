"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../lib/api";
import { PasswordInput } from "../../components/PasswordInput";
import {
  PasswordStrengthIndicator,
  evaluatePasswordStrength,
} from "../../components/PasswordStrengthIndicator";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!token) {
    return (
      <main
        id="main-content"
        style={{
          maxWidth: "440px",
          margin: "3rem auto",
          padding: "2rem",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "2rem",
            marginBottom: "1rem",
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "0.5rem",
          }}
        >
          Invalid Reset Link
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
            marginBottom: "1.5rem",
          }}
        >
          No reset token was supplied in the URL. Please request a new password
          reset link.
        </p>
        <Link
          id="reset-password-request-new-link"
          href="/forgot-password"
          style={{
            display: "inline-block",
            padding: "0.65rem 1.25rem",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#FFFFFF",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Request Reset Link
        </Link>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.isValid) {
      setErrorMessage(
        "Password must be at least 8 characters long and contain both letters and numbers.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    try {
      setIsLoading(true);
      await api.resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset password.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "460px",
        margin: "3rem auto",
        padding: "2rem",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "0.5rem",
          }}
        >
          Create New Password
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Choose a strong password to protect your account and workspaces
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid var(--color-contradicted, #ef4444)",
            borderRadius: "6px",
            color: "var(--color-contradicted, #ef4444)",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      {isSuccess ? (
        <div
          style={{
            textAlign: "center",
            padding: "1rem 0",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "var(--color-supported, #10b981)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
              fontSize: "1.5rem",
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            Password Reset Complete
          </h2>
          <p
            id="reset-password-success-message"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              marginBottom: "1.75rem",
            }}
          >
            Your password has been securely updated. Any existing active
            sessions have been invalidated for security. Please sign in with
            your new password.
          </p>

          <Link
            id="reset-password-signin-link"
            href="/login"
            style={{
              display: "inline-block",
              width: "100%",
              padding: "0.7rem",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary, #2563eb)",
              color: "#FFFFFF",
              fontSize: "0.95rem",
              fontWeight: 600,
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Sign In with New Password
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.1rem" }}>
            <label
              htmlFor="reset-new-password"
              style={{
                display: "block",
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: "0.35rem",
              }}
            >
              New Password
            </label>
            <PasswordInput
              id="reset-new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              disabled={isLoading}
              required
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="reset-confirm-password"
              style={{
                display: "block",
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: "0.35rem",
              }}
            >
              Confirm New Password
            </label>
            <PasswordInput
              id="reset-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              disabled={isLoading}
              required
            />
          </div>

          <button
            id="reset-password-submit-button"
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.7rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--color-primary, #2563eb)",
              color: "#FFFFFF",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: "3rem" }}>
          Loading password reset...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
