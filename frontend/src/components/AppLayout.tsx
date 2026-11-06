import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import Navbar from "./Navbar";
import DaysLeftBadge from "./DaysLeftBadge";
import Badge from "./Badge";
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

const REMINDER_WINDOW_DAYS = 14;

export default function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [expiry, setExpiry] = useState<{ daysLeft: number; paid: boolean; blocked: boolean; endsAt: string } | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // While a temporary password is still in place the server only allows changing it.
    if (!user || user.mustChangePassword) return;
    api.get("/branding").then((res) => {
      setBranding(res.data);
      if (res.data.primaryColor) {
        document.documentElement.style.setProperty("--accent", res.data.primaryColor);
        document.documentElement.style.setProperty("--accent-hover", darken(res.data.primaryColor));
        document.documentElement.style.setProperty("--bg-accent-muted", `${res.data.primaryColor}1A`);
      }
    }).catch(() => { /* branding is cosmetic; the page works without it */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.mustChangePassword]);

  // School admins always see how long their access has left (header chip), and get
  // a stronger banner in the last two weeks. The email reminder is a second channel.
  useEffect(() => {
    if (user?.role !== "admin" || user.mustChangePassword) return;
    api.get("/billing/status").then((res) => {
      const d = res.data;
      setExpiry({ daysLeft: d.accessDaysLeft, paid: !!d.isPaidActive, blocked: !!d.accessBlocked, endsAt: d.accessEndsAt });
    }).catch(() => { /* not important enough to interrupt the page */ });
  }, [user?.role, user?.mustChangePassword]);

  // Tab title: the school's name first, platform second. (The tab icon is always Benchmark's.)
  useEffect(() => {
    const name = branding?.schoolName;
    document.title = name && name !== "Benchmark" ? `${name} · Benchmark CBT` : "Benchmark CBT";
  }, [branding?.schoolName]);

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
      {expiry && !expiry.blocked && expiry.daysLeft <= REMINDER_WINDOW_DAYS && (
        <div style={{ padding: "8px 24px", fontSize: 13, color: "var(--text-warning)", background: "var(--bg-warning)", textAlign: "center" }}>
          Your school's {expiry.paid ? "subscription" : "free trial"}{" "}
          {expiry.daysLeft <= 1 ? "ends within a day" : `ends in ${expiry.daysLeft} days`}. After that, teachers and students can't sign in.{" "}
          <Link to="/admin/billing">See how to renew</Link>
        </div>
      )}
      {user && (
        <div style={{ padding: "10px 24px", fontSize: 13, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>Welcome back, {user.name}</span>
          {user.role === "admin" && expiry && (
            <Link to="/admin/billing" title={`Access ends ${new Date(expiry.endsAt).toLocaleDateString()}`} style={{ textDecoration: "none" }}>
              {expiry.blocked
                ? <Badge tone="danger">Access locked</Badge>
                : <DaysLeftBadge days={expiry.daysLeft} kind={expiry.paid ? "paid" : "trial"} />}
            </Link>
          )}
        </div>
      )}
      <Outlet />
      {user && user.role !== "superadmin" && !/\/exams\/[^/]+\/take/.test(pathname) && (
        <div style={{ padding: "18px 24px 28px", textAlign: "center", fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          Powered by <BrandLogo size={16} to={null} />
        </div>
      )}
    </div>
  );
}