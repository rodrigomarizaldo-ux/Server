import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { setCurrentUserId } from "@/utils/userStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
}

interface AuthSession {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
}

// ─── API URL ──────────────────────────────────────────────────────────────────

/**
 * Returns an absolute URL to the API server.
 * On native (React Native): prefixes relative paths with the Expo dev domain.
 * On web: uses root-relative path (browser handles it automatically).
 */
export function apiUrl(path: string): string {
  // Explicit override wins
  if (process.env.EXPO_PUBLIC_API_URL) {
    return `${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")}${path}`;
  }

  // The API server is proxied at /api by Replit
  const relative = `/api${path}`;

  // On React Native native, `document` is not defined — need absolute URL
  if (typeof document === "undefined") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) {
      const base = domain.startsWith("http") ? domain : `https://${domain}`;
      return `${base}${relative}`;
    }
  }

  return relative;
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const SESSION_KEY = "auth_session_v1";

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore session on mount ──
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const session: AuthSession = JSON.parse(raw);
          setUser(session.user);
          setToken(session.token);
          setCurrentUserId(session.user.id);
        }
      } catch {
        // corrupted session — clear it
        await AsyncStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistSession = async (session: AuthSession) => {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session.user);
    setToken(session.token);
    setCurrentUserId(session.user.id);
  };

  // ── Register ──
  const register = useCallback(
    async (username: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(apiUrl("/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error ?? "Erro ao criar conta" };
        await persistSession({ token: data.token, user: data.user });
        return {};
      } catch {
        return { error: "Sem conexão com o servidor. Verifique sua rede." };
      }
    },
    [],
  );

  // ── Login ──
  const login = useCallback(
    async (username: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(apiUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error ?? "Credenciais inválidas" };
        await persistSession({ token: data.token, user: data.user });
        return {};
      } catch {
        return { error: "Sem conexão com o servidor. Verifique sua rede." };
      }
    },
    [],
  );

  // ── Logout ──
  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setCurrentUserId(null);
    setUser(null);
    setToken(null);
  }, []);

  // ── Verify password (for destructive actions) ──
  const verifyPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const res = await fetch(apiUrl("/auth/verify-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user.username, password }),
        });
        const data = await res.json();
        return data.valid === true;
      } catch {
        return false;
      }
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, verifyPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
