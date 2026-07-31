import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@/services/auth";
import { login as loginService, me as meService } from "@/services/auth";
import { getStoredToken, setStoredToken } from "@/services/api";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    meService(token)
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await loginService(email, password);
    setStoredToken(result.token);
    setUser(result.user);
  }

  function logout() {
    setStoredToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
