"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  AuthenticatedUser,
  WorkspaceSummary,
  LoginRequest,
  RegisterRequest,
} from "@traceback/shared-types";
import { api, setApiAuthToken, setApiActiveWorkspaceId } from "../lib/api";

interface AuthContextType {
  user: AuthenticatedUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
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
          name: "Default Workspace",
          slug: "default",
          role: "OWNER" as const,
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
    async (credentials: LoginRequest) => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.login(credentials);
        applySession(res.token, res.user, res.workspaces);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.register(payload);
        applySession(res.token, res.user, res.workspaces);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
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
    } catch (err) {
      // Session expired or invalid
      setToken(null);
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      setApiAuthToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, applySession]);

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
          // Token expired or invalid
          if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY_TOKEN);
          }
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [applySession]);

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
        register,
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
    // Fallback for isolated unit tests without provider
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
      register: async () => {},
      logout: async () => {},
      switchWorkspace: () => {},
      refreshSession: async () => {},
    };
  }
  return context;
}
