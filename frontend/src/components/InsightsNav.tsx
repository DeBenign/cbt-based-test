import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRolePath } from "../hooks/useRolePath";

// A small tab row shared by the analytics screens, so the top menu stays short.
export default function InsightsNav() {
  const { user } = useAuth();
  const rolePath = useRolePath();
  const here = useLocation().pathname;
  const items: [string, string][] = user?.role === "admin"
    ? [["/overview", "School overview"], ["/analytics", "Class analytics"], ["/remarks", "Overall remarks"], ["/report-cards", "Report cards"], ["/staff", "Staff indicators"]]
    : [["/analytics", "Class analytics"], ["/remarks", "Remarks"], ["/staff", "My indicators"]];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {items.map(([path, label]) => {
        const active = here.endsWith(path);
        return (
          <Link key={path} to={rolePath(path)} style={{ padding: "4px 12px", fontSize: 13, borderRadius: 999, border: `0.5px solid ${active ? "var(--accent)" : "var(--border)"}`, color: active ? "var(--accent)" : "var(--text-secondary)", background: active ? "var(--bg-accent-muted)" : "transparent" }}>{label}</Link>
        );
      })}
    </div>
  );
}
