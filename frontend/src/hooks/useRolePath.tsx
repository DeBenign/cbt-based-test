import { useAuth } from "../context/AuthContext";

// Builds a path prefixed with the current user's role, e.g. rolePath("/exams")
// -> "/teacher/exams". Falls back to a bare path if somehow called with no
// user (shouldn't happen inside RequireRole-guarded routes).
export function useRolePath() {
  const { user } = useAuth();
  return (path: string) => {
    const clean = path.startsWith("/") ? path : `/${path}`;
    return user ? `/${user.role}${clean}` : clean;
  };
}