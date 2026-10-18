import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireRole() {
  const { user } = useAuth();
  const { role } = useParams<{ role: string }>();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  if (role !== user.role) return <Navigate to={`/${user.role}/exams`} replace />;

  // Accounts created in bulk (or reset by an admin) start with a temporary
  // password and must choose their own before using anything else.
  if (user.mustChangePassword && !location.pathname.endsWith("/change-password")) {
    return <Navigate to={`/${user.role}/change-password`} replace />;
  }

  return <Outlet />;
}