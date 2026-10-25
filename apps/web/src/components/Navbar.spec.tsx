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

describe("Navbar Component — Design #2: Elevated with Workspace Selector", () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Traceback branding, problem statement, workspace badge, and user profile when authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      workspaces: [
        {
          id: "ws_alpha",
          name: "Alpha Corp Engineering",
          slug: "alpha-corp",
          role: "OWNER",
        },
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
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("renders Row 2 primary navigation with 7 links in the exact required order and styles active route", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      workspaces: [
        {
          id: "ws_alpha",
          name: "Alpha Corp",
          slug: "alpha-corp",
          role: "OWNER",
        },
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

    const nav = screen.getByRole("navigation", {
      name: /main workspace navigation/i,
    });
    expect(nav).toBeInTheDocument();

    const links = withinNav(nav);
    const expectedOrder = [
      { text: "Overview", href: "/" },
      { text: "Verify", href: "/verify" },
      { text: "Historical Intent", href: "/intent" },
      { text: "Decision Memory", href: "/decisions" },
      { text: "Evidence", href: "/evidence" },
      { text: "History & Reports", href: "/history" },
      { text: "Repositories", href: "/repositories" },
    ];

    expect(links.length).toBe(expectedOrder.length);
    expectedOrder.forEach((expected, idx) => {
      expect(links[idx]).toHaveTextContent(expected.text);
      expect(links[idx]).toHaveAttribute("href", expected.href);
    });

    // Active route (/repositories) has distinctive primary active styling & accessibility attributes
    const activeLink = links[6];
    expect(activeLink).toHaveAttribute("href", "/repositories");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveAttribute("data-active", "true");
    expect(links[0]).toHaveAttribute("data-active", "false");
    expect(links[0]).not.toHaveAttribute("aria-current");
  });

  it("renders wide Global Search input with placeholder and shortcut badge", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      workspaces: [
        {
          id: "ws_alpha",
          name: "Alpha Corp",
          slug: "alpha-corp",
          role: "OWNER",
        },
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

    const searchInput = screen.getByPlaceholderText(
      "Search repositories, decisions, or evidence...",
    );
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();

    // Focusing search opens quick overlay
    fireEvent.focus(searchInput);
    expect(screen.getByText("Quick Navigation")).toBeInTheDocument();
  });

  it("renders notification control without fabricated counts and toggles notification panel", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      workspaces: [
        {
          id: "ws_alpha",
          name: "Alpha Corp",
          slug: "alpha-corp",
          role: "OWNER",
        },
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

    const notifBtn = screen.getByRole("button", { name: /notifications/i });
    expect(notifBtn).toBeInTheDocument();
    // Verify no fake unread badge / fabricated count
    expect(notifBtn).not.toHaveTextContent("99+");
    expect(notifBtn).not.toHaveTextContent("5");

    // Click toggles notification panel
    fireEvent.click(notifBtn);
    expect(
      screen.getByText(
        /all repository sync tasks and background verification jobs/i,
      ),
    ).toBeInTheDocument();
  });

  it("displays Switch Account, Register New Account, and Sign Out in user menu when authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "user_1",
        email: "alex@company.com",
        name: "Alex Maintainer",
      },
      workspaces: [
        {
          id: "ws_alpha",
          name: "Alpha Corp",
          slug: "alpha-corp",
          role: "OWNER",
        },
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
    const userButton = screen.getByRole("button", {
      name: /user account menu/i,
    });
    fireEvent.click(userButton);

    expect(screen.getByText("Switch Account")).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("Register New Account")).toHaveAttribute(
      "href",
      "/register",
    );
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("renders Sign In and Register links with returnTo destination when unauthenticated without leaking workspace/search/nav", () => {
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
    expect(signInLink).toHaveAttribute(
      "href",
      "/login?returnTo=%2Frepositories",
    );

    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute(
      "href",
      "/register?returnTo=%2Frepositories",
    );

    // Must NOT leak protected workspace navigation, search, or workspace selector
    expect(
      screen.queryByRole("navigation", { name: /main workspace navigation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(
        "Search repositories, decisions, or evidence...",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^overview$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^verify$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^historical intent$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^decision memory$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^history & reports$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^repositories$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^evidence$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select workspace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /user account menu/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /notifications/i }),
    ).not.toBeInTheDocument();
  });
});

function withinNav(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll("a"));
}
