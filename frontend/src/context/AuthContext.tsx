import { createContext, useContext, useState, ReactNode } from "react";

interface AuthUser {
  id: string;
  name: string;
  role: "superadmin" | "admin" | "teacher" | "student";
  classId?: string;
  subjectIds?: string[];
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  clearMustChangePassword: () => void;
  replaceToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restored from storage so a page refresh (or a student reloading mid-exam)
  // doesn't sign them out. The token itself still expires on the server.
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("cbt_user");
      return saved && localStorage.getItem("cbt_token") ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  function login(token: string, user: AuthUser) {
    localStorage.setItem("cbt_token", token);
    localStorage.setItem("cbt_role", user.role);
    localStorage.setItem("cbt_user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("cbt_token");
    localStorage.removeItem("cbt_role");
    localStorage.removeItem("cbt_user");
    setUser(null);
  }

  function clearMustChangePassword() {
    setUser((u) => {
      if (!u) return u;
      const updated = { ...u, mustChangePassword: false };
      localStorage.setItem("cbt_user", JSON.stringify(updated));
      return updated;
    });
  }

  // After a password change the server issues a fresh token (the old one is retired).
  function replaceToken(token: string) {
    localStorage.setItem("cbt_token", token);
  }

  return <AuthContext.Provider value={{ user, login, logout, clearMustChangePassword, replaceToken }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}