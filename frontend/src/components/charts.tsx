// Small dependency-free SVG charts that follow the app's light/dark colours.

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  hollow?: boolean[]; // draw this point as a hollow red ring (e.g. exam not taken)
}

const W = 360;
const H = 190;
const PAD = { l: 30, r: 14, t: 10, b: 24 };

// Percent (0-100) over a list of exams. A dotted line marks the pass mark.
export function LineChart({ labels, series, passMark = 50 }: { labels: string[]; series: LineSeries[]; passMark?: number }) {
  const n = labels.length;
  const x = (i: number) => PAD.l + (n <= 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + ((100 - v) * (H - PAD.t - PAD.b)) / 100;
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth={0.5} />
            <text x={PAD.l - 4} y={y(g) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">{g}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(passMark)} y2={y(passMark)} stroke="var(--text-danger)" strokeWidth={0.8} strokeDasharray="2 3" />
        {labels.map((l, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 8} fontSize={9} textAnchor={n > 1 && i === n - 1 ? "end" : "middle"} fill="var(--text-muted)">{l.length > 9 ? `${l.slice(0, 8)}…` : l}</text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          // Join consecutive known points; a gap (null) breaks the line.
          const segs: string[] = [];
          let cur: string[] = [];
          pts.forEach((p) => { if (p) cur.push(`${p[0]},${p[1]}`); else { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; } });
          if (cur.length > 1) segs.push(cur.join(" "));
          return (
            <g key={s.name}>
              {segs.map((d, i) => <polyline key={i} points={d} fill="none" stroke={s.color} strokeWidth={1.8} strokeDasharray={s.dashed ? "4 3" : undefined} />)}
              {pts.map((p, i) => p && (
                <circle key={i} cx={p[0]} cy={p[1]} r={3.2}
                  fill={s.hollow?.[i] ? "var(--surface-1, #fff)" : s.color}
                  stroke={s.hollow?.[i] ? "var(--text-danger)" : s.color} strokeWidth={s.hollow?.[i] ? 1.6 : 1}>
                  <title>{`${labels[i]}: ${s.values[i]}%${s.hollow?.[i] ? " (not taken)" : ""}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
        {series.map((s) => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 0, borderTop: `2px ${s.dashed ? "dashed" : "solid"} ${s.color}` }} />{s.name}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 0, borderTop: "1px dotted var(--text-danger)" }} />Pass mark
        </span>
      </div>
    </div>
  );
}

// Vertical bars, e.g. how many students fall in each 10-point band.
export function Histogram({ bins }: { bins: { label: string; count: number }[] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const bw = (W - PAD.l - PAD.r) / bins.length;
  return (
    <svg viewBox={`0 0 ${W} 150`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
      {bins.map((b, i) => {
        const h = (b.count / max) * 100;
        const low = i < 5;
        return (
          <g key={b.label}>
            <rect x={PAD.l + i * bw + 3} y={115 - h} width={bw - 6} height={h} rx={2} fill={low ? "var(--text-warning)" : "var(--text-success)"} opacity={0.85}>
              <title>{`${b.label}%: ${b.count} student${b.count === 1 ? "" : "s"}`}</title>
            </rect>
            {b.count > 0 && <text x={PAD.l + i * bw + bw / 2} y={111 - h} fontSize={9} textAnchor="middle" fill="var(--text-secondary)">{b.count}</text>}
            <text x={PAD.l + i * bw + bw / 2} y={130} fontSize={8} textAnchor="middle" fill="var(--text-muted)">{b.label.replace("-", "–")}</text>
          </g>
        );
      })}
      <line x1={PAD.l} x2={W - PAD.r} y1={115} y2={115} stroke="var(--border)" strokeWidth={0.8} />
    </svg>
  );
}

// Labelled horizontal bars for topics and questions (percent correct).
export function HBars({ items }: { items: { label: string; value: number; note?: string }[] }) {
  return (
    <div>
      {items.map((it) => (
        <div key={it.label} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
            <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{it.value}%{it.note ? ` · ${it.note}` : ""}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--bg-neutral)", overflow: "hidden" }}>
            <div style={{ width: `${it.value}%`, height: "100%", background: it.value < 50 ? "var(--text-danger)" : it.value < 75 ? "var(--text-warning)" : "var(--text-success)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function trendLabel(t: "up" | "down" | "flat" | null): { text: string; tone: "success" | "danger" | "neutral" } {
  if (t === "up") return { text: "Rising ↑", tone: "success" };
  if (t === "down") return { text: "Falling ↓", tone: "danger" };
  if (t === "flat") return { text: "Steady →", tone: "neutral" };
  return { text: "Not enough exams yet", tone: "neutral" };
}
