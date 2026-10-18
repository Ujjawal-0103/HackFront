"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Full name is required");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Email address is required");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage("Password must contain both letters and numbers");
      return;
    }
    if (password !== passwordConfirmation) {
      setErrorMessage("Password confirmation does not match");
      return;
    }

    try {
      setIsLoading(true);
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        passwordConfirmation,
      });
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
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
        margin: "2.5rem auto",
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
          Create Traceback Account
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Set up verified repository access and human verification workspaces
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
        <div style={{ marginBottom: "1.1rem" }}>
          <label
            htmlFor="register-name"
            style={{
              display: "block",
              fontSize: "0.825rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.35rem",
            }}
          >
            Full Name
          </label>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Maintainer"
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

        <div style={{ marginBottom: "1.1rem" }}>
          <label
            htmlFor="register-email"
            style={{
              display: "block",
              fontSize: "0.825rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.35rem",
            }}
          >
            Work Email Address
          </label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@company.com"
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

        <div style={{ marginBottom: "1.1rem" }}>
          <label
            htmlFor="register-password"
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
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters (letters + numbers)"
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
            htmlFor="register-password-confirm"
            style={{
              display: "block",
              fontSize: "0.825rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.35rem",
            }}
          >
            Confirm Password
          </label>
          <input
            id="register-password-confirm"
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            placeholder="Repeat password"
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
          id="register-submit-button"
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
          {isLoading ? "Creating account..." : "Create Account"}
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
        Already have an account?{" "}
        <Link
          href="/login"
          style={{
            color: "var(--color-primary)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
