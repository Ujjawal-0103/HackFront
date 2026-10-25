"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your account email address.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.forgotPassword({ email: trimmedEmail });
      setStatusMessage(res.message);
      setIsSubmitted(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to process request.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
          Reset Password
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Enter your registered email address and we will dispatch recovery
          instructions.
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

      {isSubmitted ? (
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
            ✉️
          </div>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            Check Your Email
          </h2>
          <p
            id="forgot-password-success-message"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              marginBottom: "1.75rem",
            }}
          >
            {statusMessage ||
              "If an account exists for that email, password-reset instructions will be sent."}
          </p>

          <Link
            id="forgot-password-return-login-link"
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
            Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="forgot-password-email"
              style={{
                display: "block",
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: "0.35rem",
              }}
            >
              Email Address
            </label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@company.com"
              disabled={isLoading}
              required
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            id="forgot-password-submit-button"
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
            {isLoading ? "Sending Instructions..." : "Send Reset Instructions"}
          </button>

          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--color-border)",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Remember your password?{" "}
            <Link
              id="forgot-password-login-link"
              href="/login"
              style={{
                color: "var(--color-primary, #2563eb)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
