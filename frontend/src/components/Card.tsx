import { ReactNode, CSSProperties } from "react";

export default function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 22px",
        boxShadow: "var(--shadow-sm)",
        ...style
      }}
    >
      {children}
    </div>
  );
}