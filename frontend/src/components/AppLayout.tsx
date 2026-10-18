import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface Branding {
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

// Simple darken for a hover shade -- good enough for a school-chosen accent
// color without needing a full color-manipulation library for one field.
function darken(hex: string, amount = 0.15): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 255) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function AppLayout() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!user) return;
    api.get("/branding").then((res) => {
      setBranding(res.data);
      if (res.data.primaryColor) {
        document.documentElement.style.setProperty("--accent", res.data.primaryColor);
        document.documentElement.style.setProperty("--accent-hover", darken(res.data.primaryColor));
        document.documentElement.style.setProperty("--bg-accent-muted", `${res.data.primaryColor}1A`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // App-wide version of the same online/offline signal TestTaking.tsx
  // already uses during an exam -- here it's just an informational banner,
  // since most pages (unlike an exam) have no local queue to report on.
  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-0)" }}>
      <Navbar logoUrl={branding?.logoUrl} schoolName={branding?.schoolName} />
      {!isOnline && (
        <div style={{ padding: "8px 24px", fontSize: 13, color: "var(--text-warning)", background: "var(--bg-warning)", textAlign: "center" }}>
          You're offline. The app still works, but anything needing a connection — saving, submitting, loading new data — will wait until you're back online.
        </div>
      )}
      {user && (
        <div style={{ padding: "10px 24px", fontSize: 13, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border)" }}>
          Welcome back, {user.name}
        </div>
      )}
      <Outlet />
    </div>
  );
}