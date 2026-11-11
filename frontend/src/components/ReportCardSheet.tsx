// One printable report card (A4). Plain black-on-white so it prints well on any printer.
export interface CardSubject {
  subjectId: string; subjectName: string; average: number | null; classAverage: number | null;
  sat: number; exams: number; participation: number; band: "good" | "pass" | "below" | null; remark: string | null;
}
export interface Card {
  student: { id: string; name: string };
  subjects: CardSubject[];
  overall: { average: number | null; classAverage: number | null; sat: number; exams: number; participation: number; band: "good" | "pass" | "below" | null; remark: string | null };
  enoughData: boolean;
}
export interface CardHead {
  school: { name: string; logoUrl: string | null; primaryColor: string | null };
  className: string;
  period: { from: string | null; to: string | null };
  passMark: number;
}

// Hides the app's menu and footers when printing, and starts every card on a new page.
export const PRINT_CSS = `
@media print {
  nav, .no-print { display: none !important; }
  body { background: #fff !important; }
  .rc-wrap { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .rc-card { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; break-after: page; page-break-after: always; }
  .rc-card:last-child { break-after: auto; page-break-after: auto; }
  @page { size: A4; margin: 14mm; }
}`;

const BAND = { good: "Doing well", pass: "Passing", below: "Below the pass mark" } as const;
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function ReportCardSheet({ head, card, termLabel }: { head: CardHead; card: Card; termLabel: string }) {
  const accent = head.school.primaryColor || "#3d5afe";
  const thin = card.subjects.some((s) => s.sat > 0 && s.sat < 3);
  const cell = { padding: "7px 8px", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: 12.5 } as const;
  const period = head.period.from || head.period.to
    ? `Exams from ${head.period.from ? day(head.period.from) : "the start"} to ${head.period.to ? day(head.period.to) : "today"}`
    : "All exams to date";

  return (
    <div className="rc-card" style={{ background: "#fff", color: "#111", border: "1px solid var(--border)", borderRadius: 8, padding: "26px 30px", marginBottom: 20, fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `3px solid ${accent}`, paddingBottom: 12 }}>
        {head.school.logoUrl && <img src={head.school.logoUrl} alt="" style={{ height: 52, width: "auto" }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: accent }}>{head.school.name}</div>
          <div style={{ fontSize: 13, color: "#444" }}>Student report card{termLabel ? ` · ${termLabel}` : ""}</div>
        </div>
      </div>

      <table style={{ width: "100%", margin: "14px 0", fontSize: 13 }}><tbody>
        <tr><td style={{ width: "50%" }}><b>Student:</b> {card.student.name}</td><td><b>Class:</b> {head.className}</td></tr>
        <tr><td colSpan={2} style={{ color: "#555", paddingTop: 4 }}>{period}</td></tr>
      </tbody></table>

      <div style={{ display: "flex", gap: 0, border: "1px solid #ccc", borderRadius: 6, marginBottom: 14 }}>
        {([
          ["Overall average", pct(card.overall.average)],
          ["Class average", pct(card.overall.classAverage)],
          ["Exams taken", `${card.overall.sat} of ${card.overall.exams}`],
          ["Standing", card.overall.band ? BAND[card.overall.band] : "—"]
        ] as [string, string][]).map(([l, v], i) => (
          <div key={l} style={{ flex: 1, padding: "8px 10px", borderLeft: i ? "1px solid #ccc" : "none" }}>
            <div style={{ fontSize: 11, color: "#666" }}>{l}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f3f4f6", textAlign: "left", fontSize: 12 }}>
            <th style={cell}>Subject</th><th style={cell}>Average</th><th style={cell}>Class avg</th><th style={cell}>Exams taken</th><th style={cell}>Teacher's remark</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((s) => (
            <tr key={s.subjectId} style={{ breakInside: "avoid" }}>
              <td style={{ ...cell, fontWeight: 600 }}>{s.subjectName}</td>
              <td style={cell}>{pct(s.average)}{s.sat > 0 && s.sat < 3 ? " *" : ""}<div style={{ fontSize: 11, color: "#666" }}>{s.band ? BAND[s.band] : ""}</div></td>
              <td style={cell}>{pct(s.classAverage)}</td>
              <td style={cell}>{s.sat} of {s.exams}</td>
              <td style={{ ...cell, fontSize: 12 }}>{s.remark ?? <span style={{ color: "#999" }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, breakInside: "avoid" }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Overall remark</div>
        <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", minHeight: 48, fontSize: 12.5 }}>
          {card.overall.remark ?? <span style={{ color: "#999" }}>—</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 38, fontSize: 12, color: "#444", breakInside: "avoid" }}>
        <div style={{ flex: 1, borderTop: "1px solid #444", paddingTop: 4 }}>Class teacher</div>
        <div style={{ flex: 1, borderTop: "1px solid #444", paddingTop: 4 }}>Head / Proprietor</div>
        <div style={{ flex: 1, borderTop: "1px solid #444", paddingTop: 4 }}>Parent / Guardian</div>
      </div>

      <p style={{ fontSize: 10.5, color: "#666", marginTop: 14, marginBottom: 0 }}>
        Based on exams taken on Benchmark CBT only; it does not include classwork or assignments marked elsewhere. Averages count the exams the student sat, and "Exams taken" shows any missed.
        Class average is of students who sat the exams. Pass mark {head.passMark}%.{thin ? " * Based on fewer than 3 exams, so treat it as an early indication." : ""} Powered by Benchmark CBT.
      </p>
    </div>
  );
}
