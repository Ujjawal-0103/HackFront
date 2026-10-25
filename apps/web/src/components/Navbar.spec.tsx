import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { ThemeProvider } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/repositories",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("../context/AuthContext");

describe("Navbar Component", () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Traceback branding, problem statement, and workspace badge when authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
      workspaces: [
        { id: "ws_alpha", name: "Alpha Corp Engineering", slug: "alpha-corp", role: "OWNER" },
      ],
      activeWorkspace: {
        id: "ws_alpha",
        name: "Alpha Corp Engineering",
        slug: "alpha-corp",
        role: "OWNER",
      },
      logout: mockLogout,
    });

    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    expect(screen.getByText("Traceback")).toBeInTheDocument();
    expect(
      screen.getByText("Human-Supervised Code Verification"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Alpha Corp Engineering (ws_alpha)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Alex Maintainer")).toBeInTheDocument();
  });

  it("displays Switch Account, Register New Account, and Sign Out in user menu when authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
      workspaces: [
        { id: "ws_alpha", name: "Alpha Corp", slug: "alpha-corp", role: "OWNER" },
      ],
      activeWorkspace: {
        id: "ws_alpha",
        name: "Alpha Corp",
        slug: "alpha-corp",
        role: "OWNER",
      },
      logout: mockLogout,
    });

    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    // Open user menu
    const userButton = screen.getByRole("button", { name: /user account menu/i });
    fireEvent.click(userButton);

    expect(screen.getByText("Switch Account")).toHaveAttribute("href", "/login");
    expect(screen.getByText("Register New Account")).toHaveAttribute("href", "/register");
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("renders Sign In and Register links with returnTo destination when unauthenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      workspaces: [],
      activeWorkspace: null,
      logout: mockLogout,
    });

    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    const signInLink = screen.getByRole("link", { name: /sign in/i });
    const registerLink = screen.getByRole("link", { name: /register/i });

    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute("href", "/login?returnTo=%2Frepositories");

    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register?returnTo=%2Frepositories");
  });

  it("renders navigation links to Overview, Verify, History, Repositories, and Evidence", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
      workspaces: [],
      activeWorkspace: null,
      logout: mockLogout,
    });

    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    const overviewLink = screen.getByRole("link", { name: /^overview$/i });
    const verifyLink = screen.getByRole("link", { name: /^verify$/i });
    const historyLink = screen.getByRole("link", {
      name: /^history & reports$/i,
    });
    const reposLink = screen.getByRole("link", { name: /^repositories$/i });
    const evidenceLink = screen.getByRole("link", { name: /^evidence$/i });

    expect(overviewLink).toHaveAttribute("href", "/");
    expect(verifyLink).toHaveAttribute("href", "/verify");
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(reposLink).toHaveAttribute("href", "/repositories");
    expect(evidenceLink).toHaveAttribute("href", "/evidence");
  });
});
