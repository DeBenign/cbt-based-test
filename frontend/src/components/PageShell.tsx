import { ReactNode } from "react";

export default function PageShell({ children, maxWidth = 640 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div style={{ maxWidth, margin: "48px auto", padding: "0 20px" }}>
      {children}
    </div>
  );
}
