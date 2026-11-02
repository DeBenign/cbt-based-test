import { Link } from "react-router-dom";

// The Benchmark CBT logo (platform brand). It is deliberately separate from a school's own
// logo (Branding page): the school's logo leads inside the app, Benchmark leads on public pages.
// To change the logo, replace public/icon-192.png, icon-512.png, favicon-32.png and favicon.ico.
interface Props {
  size?: number;
  showName?: boolean;
  onDark?: boolean;          // on a coloured/dark background: white outline + white text
  to?: string | null;        // link target; null = not a link
  centered?: boolean;
}

export default function BrandLogo({ size = 28, showName = true, onDark = false, to = "/", centered = false }: Props) {
  const content = (
    <>
      <img
        src="/icon-192.png"
        alt={showName ? "" : "Benchmark CBT"}
        width={size}
        height={size}
        style={{ borderRadius: size * 0.24, boxShadow: onDark ? "0 0 0 2px rgba(255,255,255,0.9)" : "none", display: "block" }}
      />
      {showName && <span style={{ fontWeight: 700, fontSize: Math.max(13, size * 0.55), color: onDark ? "#fff" : "var(--text-primary)" }}>Benchmark CBT</span>}
    </>
  );
  const style = { display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", justifyContent: centered ? "center" : "flex-start" } as const;
  return to ? <Link to={to} style={style}>{content}</Link> : <span style={style}>{content}</span>;
}
