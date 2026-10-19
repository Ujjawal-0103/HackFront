"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Email is required");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required");
      return;
    }

    try {
      setIsLoading(true);
      await login({ email: email.trim(), password });
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "420px",
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
          Sign In to Traceback
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Verify AI code explanations against repository history
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid var(--color-contradicted)",
            borderRadius: "6px",
            color: "var(--color-contradicted)",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            htmlFor="login-email"
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
            id="login-email"
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

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="login-password"
            style={{
              display: "block",
              fontSize: "0.825rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.35rem",
            }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          id="login-submit-button"
          type="submit"
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.7rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "var(--color-primary)",
            color: "#FFFFFF",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            transition: "all 0.15s ease",
          }}
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

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
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          style={{
            color: "var(--color-primary)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Register here
        </Link>
      </div>
    </main>
  );
}
