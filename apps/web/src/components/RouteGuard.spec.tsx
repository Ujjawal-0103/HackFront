import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { RouteGuard } from "./RouteGuard";
import { useAuth } from "../context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

jest.mock("../context/AuthContext");
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

describe("RouteGuard Component", () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });
  });

  it("renders public routes like /login without requiring authenticated user", () => {
    (usePathname as jest.Mock).mockReturnValue("/login");
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(
      <RouteGuard>
        <div data-testid="public-page">Login Page Content</div>
      </RouteGuard>,
    );

    expect(screen.getByTestId("public-page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders public routes like /forgot-password and /reset-password without redirect", () => {
    (usePathname as jest.Mock).mockReturnValue("/forgot-password");
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(
      <RouteGuard>
        <div data-testid="forgot-page">Forgot Password Page</div>
      </RouteGuard>,
    );

    expect(screen.getByTestId("forgot-page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login?returnTo=... when visiting protected routes", () => {
    (usePathname as jest.Mock).mockReturnValue("/verify");
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-page">Secret Verification Content</div>
      </RouteGuard>,
    );

    // Must NOT render protected content!
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/login?returnTo=%2Fverify");
  });

  it("renders protected content when user is authenticated", () => {
    (usePathname as jest.Mock).mockReturnValue("/verify");
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      isLoading: false,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-page">Secret Verification Content</div>
      </RouteGuard>,
    );

    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows session restoring indicator during loading and does not flash protected data", () => {
    (usePathname as jest.Mock).mockReturnValue("/history");
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-page">History Content</div>
      </RouteGuard>,
    );

    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    expect(
      screen.getByText(/restoring secure workspace session/i),
    ).toBeInTheDocument();
  });
});
