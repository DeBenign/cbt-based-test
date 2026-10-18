import { ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "accent";

const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
  success: { bg: "var(--bg-success)", text: "var(--text-success)" },
  warning: { bg: "var(--bg-warning)", text: "var(--text-warning)" },
  danger: { bg: "var(--bg-danger)", text: "var(--text-danger)" },
  neutral: { bg: "var(--bg-neutral)", text: "var(--text-neutral)" },
  accent: { bg: "var(--bg-accent-muted)", text: "var(--accent)" }
};

export default function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const { bg, text } = toneStyles[tone];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color: text,
        padding: "3px 10px",
        borderRadius: "var(--radius)",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}