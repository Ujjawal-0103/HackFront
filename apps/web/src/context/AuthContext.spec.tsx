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
      <button onClick={() => login("user_1")}>Login User 1</button>
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
      token: "tb_token_user_1_abcdef1234567890",
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

    (api.logout as jest.Mock).mockResolvedValue({
      success: true,
      message: "Session revoked",
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("bootstraps session on initial mount and establishes active workspace", async () => {
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
      "tb_token_user_1_abcdef1234567890",
    );
  });

  it("allows switching active workspace and persists choice to localStorage", async () => {
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
