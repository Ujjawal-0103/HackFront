"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { AuthenticatedUser, WorkspaceSummary } from "@traceback/shared-types";
import { api, setApiAuthToken, setApiActiveWorkspaceId } from "../lib/api";

interface AuthContextType {
  user: AuthenticatedUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (userId?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_TOKEN = "traceback_auth_token";
const STORAGE_KEY_WORKSPACE = "traceback_active_workspace";
const STORAGE_KEY_USER = "traceback_user_id";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceSummary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback(
    (
      newToken: string,
      newUser: AuthenticatedUser,
      newWorkspaces: WorkspaceSummary[],
      preferredWsId?: string,
    ) => {
      setToken(newToken);
      setUser(newUser);
      setWorkspaces(newWorkspaces);

      setApiAuthToken(newToken);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
        localStorage.setItem(STORAGE_KEY_USER, newUser.id);
      }

      // Determine active workspace
      const targetWsId =
        preferredWsId ||
        (typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_WORKSPACE)
          : null) ||
        newWorkspaces[0]?.id ||
        "ws_alpha";

      const matchedWs = newWorkspaces.find((w) => w.id === targetWsId) ||
        newWorkspaces[0] || {
          id: targetWsId,
          name: "Alpha Corp Engineering",
          slug: "alpha-corp",
          role: "OWNER",
        };

      setActiveWorkspace(matchedWs);
      setApiActiveWorkspaceId(matchedWs.id);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_WORKSPACE, matchedWs.id);
      }
    },
    [],
  );

  const login = useCallback(
    async (userId: string = "user_1") => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.login({ userId });
        applySession(res.token, res.user, res.workspaces);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Login failed: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [applySession],
  );

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const session = await api.getSession();
      const existingToken =
        token ||
        (typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_TOKEN)
          : null) ||
        "";

      applySession(
        existingToken,
        session.user,
        session.workspaces,
        session.activeWorkspaceId,
      );
    } catch {
      // If session retrieval fails, bootstrap with default dev user
      await login("user_1");
    } finally {
      setIsLoading(false);
    }
  }, [token, applySession, login]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        setActiveWorkspace(found);
        setApiActiveWorkspaceId(found.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_WORKSPACE, found.id);
        }
      }
    },
    [workspaces],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      setApiAuthToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_WORKSPACE);
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_TOKEN)
          : null;
      const storedUserId =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_USER)
          : "user_1";

      if (storedToken) {
        setApiAuthToken(storedToken);
        try {
          const session = await api.getSession();
          if (isMounted) {
            applySession(
              storedToken,
              session.user,
              session.workspaces,
              session.activeWorkspaceId,
            );
            setIsLoading(false);
            return;
          }
        } catch {
          // Token expired or server restarted
        }
      }

      if (isMounted) {
        await login(storedUserId || "user_1");
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [applySession, login]);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        token,
        isLoading,
        error,
        login,
        logout,
        switchWorkspace,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback for standalone component unit tests
    return {
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
      token: "mock-test-token",
      isLoading: false,
      error: null,
      login: async () => {},
      logout: async () => {},
      switchWorkspace: () => {},
      refreshSession: async () => {},
    };
  }
  return context;
}
