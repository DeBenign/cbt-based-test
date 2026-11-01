import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CONTACT } from "../utils/contact";

// Header links for pages anyone can open (no sign-in).
export function PublicNav({ onDark = false }: { onDark?: boolean }) {
  const color = onDark ? "#fff" : "var(--text-primary)";
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 960, margin: "0 auto 24px", fontSize: 14 }}>
      <Link to="/" style={{ color, fontWeight: 700, textDecoration: "none" }}>Benchmark CBT</Link>
      <span style={{ display: "flex", gap: 18 }}>
        <Link to="/pricing" style={{ color }}>Pricing</Link>
        <Link to="/privacy" style={{ color }}>Privacy</Link>
        <Link to="/login" style={{ color, fontWeight: 600 }}>Sign in</Link>
      </span>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "22px 20px 36px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
      <p style={{ marginBottom: 6 }}>
        <Link to="/pricing">Pricing</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/login">Sign in</Link>
      </p>
      <p style={{ marginBottom: 0 }}>
        {CONTACT.name} · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a href={`tel:${CONTACT.phoneIntl}`}>{CONTACT.phoneDisplay}</a>
      </p>
    </footer>
  );
}

export default function PublicLayout({ children, maxWidth = 860 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "28px 20px 40px" }}>
        <PublicNav />
        <div style={{ maxWidth, margin: "0 auto" }}>{children}</div>
      </div>
      <PublicFooter />
    </div>
  );
}
