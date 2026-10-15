import React from "react";
import "@testing-library/jest-dom";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../lib/api";

jest.mock("../lib/api", () => {
  const original = jest.requireActual("../lib/api");
  return {
    ...original,
    api: {
      ...original.api,
      login: jest.fn(),
      register: jest.fn(),
      getSession: jest.fn(),
      logout: jest.fn(),
    },
  };
});

function AuthConsumer() {
  const { user, activeWorkspace, workspaces, login, logout, switchWorkspace } =
    useAuth();

  return (
    <div>
      <span data-testid="user-id">{user?.id || "anonymous"}</span>
      <span data-testid="active-workspace">
        {activeWorkspace?.id || "none"}
      </span>
      <span data-testid="workspace-count">{workspaces.length}</span>
      <button
        onClick={() =>
          login({ email: "alex@company.com", password: "Password123!" })
        }
      >
        Login User 1
      </button>
      <button onClick={() => switchWorkspace("ws_beta")}>Switch Beta</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe("AuthContext (Session and Workspace Context Management)", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    (api.login as jest.Mock).mockResolvedValue({
      token: "tb_live_user_1_abcdef1234567890",
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
        {
          id: "ws_beta",
          name: "Beta Labs Security",
          slug: "beta-labs",
          role: "MEMBER",
        },
      ],
    });

    (api.getSession as jest.Mock).mockResolvedValue({
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
        {
          id: "ws_beta",
          name: "Beta Labs Security",
          slug: "beta-labs",
          role: "MEMBER",
        },
      ],
      activeWorkspaceId: "ws_alpha",
    });

    (api.logout as jest.Mock).mockResolvedValue({
      success: true,
      message: "Session revoked",
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("restores active session on initial mount when stored token is present", async () => {
    localStorage.setItem(
      "traceback_auth_token",
      "tb_live_user_1_abcdef1234567890",
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("user_1");
    });

    expect(screen.getByTestId("active-workspace").textContent).toBe("ws_alpha");
    expect(screen.getByTestId("workspace-count").textContent).toBe("2");
    expect(localStorage.getItem("traceback_auth_token")).toBe(
      "tb_live_user_1_abcdef1234567890",
    );
  });

  it("allows logging in with verified credentials and updates session state", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Initial state is unauthenticated
    expect(screen.getByTestId("user-id").textContent).toBe("anonymous");

    const loginBtn = screen.getByText("Login User 1");
    await act(async () => {
      fireEvent.click(loginBtn);
    });

    expect(screen.getByTestId("user-id").textContent).toBe("user_1");
    expect(screen.getByTestId("active-workspace").textContent).toBe("ws_alpha");
    expect(localStorage.getItem("traceback_auth_token")).toBe(
      "tb_live_user_1_abcdef1234567890",
    );
  });

  it("allows switching active workspace and persists choice to localStorage", async () => {
    localStorage.setItem(
      "traceback_auth_token",
      "tb_live_user_1_abcdef1234567890",
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-workspace").textContent).toBe(
        "ws_alpha",
      );
    });

    const switchBtn = screen.getByText("Switch Beta");
    act(() => {
      fireEvent.click(switchBtn);
    });

    expect(screen.getByTestId("active-workspace").textContent).toBe("ws_beta");
    expect(localStorage.getItem("traceback_active_workspace")).toBe("ws_beta");
  });

  it("clears session and tokens on logout", async () => {
    localStorage.setItem(
      "traceback_auth_token",
      "tb_live_user_1_abcdef1234567890",
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("user_1");
    });

    const logoutBtn = screen.getByText("Logout");
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    expect(screen.getByTestId("user-id").textContent).toBe("anonymous");
    expect(screen.getByTestId("active-workspace").textContent).toBe("none");
    expect(localStorage.getItem("traceback_auth_token")).toBeNull();
  });
});
