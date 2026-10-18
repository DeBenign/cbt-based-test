import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRolePath } from "../hooks/useRolePath";

interface NavbarProps {
  logoUrl?: string | null;
  schoolName?: string | null;
}

export default function Navbar({ logoUrl, schoolName }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rolePath = useRolePath();
  const homePath = user?.role === "superadmin" ? rolePath("/schools") : rolePath("/exams");

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface-1)" }}>
      <Link to={homePath} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>
        {logoUrl ? (
          <img src={logoUrl} alt={schoolName || "School logo"} style={{ height: 24, width: "auto", borderRadius: 4 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : (
          "CBT"
        )}
        {schoolName && schoolName !== "Benchmark" ? schoolName : logoUrl ? "" : ""}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 14 }}>
        {user?.role === "admin" && (
          <Link to={rolePath("/setup")} style={{ color: "var(--text-secondary)" }}>Setup</Link>
        )}
        {(user?.role === "teacher" || user?.role === "admin") && (
          <Link to={rolePath("/questions")} style={{ color: "var(--text-secondary)" }}>Questions</Link>
        )}
        {(user?.role === "teacher" || user?.role === "admin") && (
          <Link to={rolePath("/curriculum")} style={{ color: "var(--text-secondary)" }}>Curriculum</Link>
        )}
        {user?.role === "teacher" && (
          <Link to={rolePath("/ai-questions")} style={{ color: "var(--text-secondary)" }}>AI questions</Link>
        )}
        {user?.role !== "superadmin" && (
          <Link to={rolePath("/exams")} style={{ color: "var(--text-secondary)" }}>Exams</Link>
        )}
        {user?.role === "superadmin" && (
          <Link to={rolePath("/schools")} style={{ color: "var(--text-secondary)" }}>Schools</Link>
        )}
        {user?.role === "admin" && (
          <>
            <Link to={rolePath("/users")} style={{ color: "var(--text-secondary)" }}>Users</Link>
            <Link to={rolePath("/activity")} style={{ color: "var(--text-secondary)" }}>Activity</Link>
            <Link to={rolePath("/billing")} style={{ color: "var(--text-secondary)" }}>Billing</Link>
            <Link to={rolePath("/branding")} style={{ color: "var(--text-secondary)" }}>Branding</Link>
          </>
        )}
        <button onClick={handleLogout} style={{ padding: "6px 14px" }}>Log out</button>
      </div>
    </nav>
  );
}