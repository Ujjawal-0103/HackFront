"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/"),
  );

  useEffect(() => {
    if (!isLoading && !user && !isPublicRoute) {
      // Safely preserve intended destination for post-login return
      const returnUrl =
        pathname && pathname !== "/"
          ? `?returnTo=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${returnUrl}`);
    }
  }, [isLoading, user, isPublicRoute, pathname, router]);

  // If on a public route, always render
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If loading session state, render honest loading indicator without exposing protected content
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}
        >
          Restoring secure workspace session...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not authenticated on a protected route, prevent flashing workspace content while redirecting
  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <p
          style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}
        >
          Redirecting to authentication...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
