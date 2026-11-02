import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "./theme";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";
const TONES: Record<Tone, [string, string]> = {
  neutral: [C.neutralBg, C.text2],
  success: [C.successBg, C.success],
  warning: [C.warnBg, C.warn],
  danger: [C.dangerBg, C.danger],
  accent: [C.accentMuted, C.accent],
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; style?: React.CSSProperties }> = ({
  tone = "neutral", children, style,
}) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999,
    background: TONES[tone][0], color: TONES[tone][1], fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", ...style,
  }}>{children}</span>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24,
    boxShadow: "0 4px 16px rgba(20,22,31,0.06)", ...style,
  }}>{children}</div>
);

export const AppBar: React.FC<{ role: string }> = ({ role }) => (
  <div style={{
    height: 56, background: C.white, borderBottom: `1px solid ${C.border}`, display: "flex",
    alignItems: "center", justifyContent: "space-between", padding: "0 24px",
  }}>
    <div style={{ fontWeight: 800, fontSize: 20, color: C.accent, letterSpacing: -0.5 }}>Benchmark</div>
    <Badge>{role}</Badge>
  </div>
);

/** `p` is a 0..1 press amount (use press() from hooks). */
export const Btn: React.FC<{
  children: React.ReactNode; p?: number; tone?: "accent" | "ghost" | "success"; style?: React.CSSProperties;
}> = ({ children, p = 0, tone = "accent", style }) => {
  const bg = tone === "accent" ? C.accent : tone === "success" ? C.success : C.white;
  const fg = tone === "ghost" ? C.ink : C.white;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 22px",
      borderRadius: 10, fontWeight: 600, fontSize: 16, background: bg, color: fg,
      border: tone === "ghost" ? `1px solid ${C.borderStrong}` : "none",
      transform: `scale(${1 - 0.05 * p})`,
      boxShadow: p > 0 ? `0 0 0 ${7 * p}px rgba(61,90,254,${0.25 * p})` : "none", ...style,
    }}>{children}</div>
  );
};

export const Field: React.FC<{
  label: string; value: string; focus?: boolean; mask?: boolean; caret?: boolean; style?: React.CSSProperties;
}> = ({ label, value, focus, mask, caret, style }) => (
  <div style={{ marginBottom: 14, ...style }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{label}</div>
    <div style={{
      border: `1.5px solid ${focus ? C.accent : C.borderStrong}`, boxShadow: focus ? `0 0 0 4px ${C.accentMuted}` : "none",
      borderRadius: 10, padding: "0 14px", fontSize: 16, height: 46, color: C.ink, background: C.white,
      display: "flex", alignItems: "center",
    }}>
      {mask ? "•".repeat(value.length) : value}
      {focus && <span style={{ width: 2, height: 20, background: C.accent, marginLeft: 2, opacity: caret ? 1 : 0 }} />}
    </div>
  </div>
);

export const Check: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = C.success }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const LockIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = C.text2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

export const MailIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
  </svg>
);

export const AlertIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = C.danger }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" />
  </svg>
);

export const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = C.accent }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${frame * 12}deg)` }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={C.border} strokeWidth="3" />
      <path d="M12 3a9 9 0 019 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

/** Success tick that pops in. `p` is 0..1. */
export const BigCheck: React.FC<{ p: number; size?: number }> = ({ p, size = 72 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", background: C.successBg, display: "flex",
    alignItems: "center", justifyContent: "center", transform: `scale(${0.6 + 0.4 * p})`, opacity: p,
  }}>
    <Check size={size * 0.5} />
  </div>
);
