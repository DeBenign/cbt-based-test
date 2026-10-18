import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRolePath } from "../hooks/useRolePath";

export default function RequireExactRole({ allow }: { allow: Array<"superadmin" | "admin" | "teacher" | "student"> }) {
  const { user } = useAuth();
  const rolePath = useRolePath();

  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) {
    const fallback = user.role === "superadmin" ? "/schools" : "/exams";
    return <Navigate to={rolePath(fallback)} replace />;
  }

  return <Outlet />;
}