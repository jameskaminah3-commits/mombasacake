import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

interface AdminSession {
  token: string;
  refreshToken: string | null;
  expiresAt: string | null;
}

interface AuthResponse {
  token: string;
  refreshToken: string | null;
  expiresAt: string | null;
  admin: AdminUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "creme_admin_session";

function readStoredSession(): AdminSession | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<AdminSession>;
    if (!parsed.token) return null;
    return {
      token: parsed.token,
      refreshToken: parsed.refreshToken ?? null,
      expiresAt: parsed.expiresAt ?? null,
    };
  } catch {
    return null;
  }
}

function storeSession(session: AdminSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function parseExpiration(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(readStoredSession()));
const token = session?.token ?? null;

  // Set synchronously so queries fired on first render already have the token.
  // The useEffect below keeps it in sync after token changes.
  setAuthTokenGetter(() => token);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const clearSession = () => {
      storeSession(null);
      setSession(null);
      setAdmin(null);
    };

    const refreshSession = async (refreshToken: string) => {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Session refresh failed");
      }

      return (await response.json()) as AuthResponse;
    };

    const fetchCurrentAdmin = async (accessToken: string) => {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      return (await response.json()) as AdminUser;
    };

    const validateSession = async () => {
      if (!session?.token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const expiresAtMs = parseExpiration(session.expiresAt);
      const isExpired = expiresAtMs != null && expiresAtMs <= Date.now();

      try {
        if (isExpired && session.refreshToken) {
          const refreshed = await refreshSession(session.refreshToken);
          if (cancelled) return;

          const nextSession = {
            token: refreshed.token,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
          };

          storeSession(nextSession);
          setSession(nextSession);
          setAdmin(refreshed.admin);
          return;
        }

        const currentAdmin = await fetchCurrentAdmin(session.token);
        if (cancelled) return;

        setAdmin(currentAdmin);
      } catch {
        if (cancelled) return;

        if (session.refreshToken) {
          try {
            const refreshed = await refreshSession(session.refreshToken);
            if (cancelled) return;

            const nextSession = {
              token: refreshed.token,
              refreshToken: refreshed.refreshToken,
              expiresAt: refreshed.expiresAt,
            };

            storeSession(nextSession);
            setSession(nextSession);
            setAdmin(refreshed.admin);
            return;
          } catch {
            if (cancelled) return;
          }
        }

        clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, [session?.expiresAt, session?.refreshToken, session?.token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      const data = (await res.json()) as AuthResponse;
      const nextSession = {
        token: data.token,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      };
      storeSession(nextSession);
      setSession(nextSession);
      setAdmin(data.admin);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    storeSession(null);
    setSession(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
