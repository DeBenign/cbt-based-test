export interface AiUsage { limit: number; used: number; remaining: number; resetsOn: string }

// "AI questions this month: 42 of 300 used" with a bar. Amber when 20% or less is left, red at zero.
export default function AiUsageMeter({ usage }: { usage: AiUsage | null }) {
  if (!usage) return null;
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 100;
  const low = usage.remaining <= usage.limit * 0.2;
  const colour = usage.remaining === 0 ? "var(--text-danger)" : low ? "var(--text-warning)" : "var(--text-success)";
  const resets = new Date(usage.resetsOn).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>AI questions this month: <b>{usage.used}</b> of <b>{usage.limit}</b> used</span>
        <span style={{ color: "var(--text-secondary)" }}>resets {resets}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-neutral)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colour }} />
      </div>
    </div>
  );
}
