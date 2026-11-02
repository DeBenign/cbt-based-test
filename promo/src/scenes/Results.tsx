import React from "react";
import { C } from "../theme";
import { phase, press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check } from "../ui";
import { CONTACT, DEMO } from "../config";

const ROWS = [
  { n: "Adaeze Okafor", mcq: 16, th: 8 },
  { n: "Tunde Bello", mcq: 14, th: 6 },
  { n: "Chiamaka Eze", mcq: 17, th: 9 },
  { n: "Ibrahim Musa", mcq: 12, th: 5 },
];
const MAX = 30;
const COLS = "1.5fr 0.7fr 0.8fr 0.8fr";
const AVG = Math.round((ROWS.reduce((a, r) => a + (r.mcq + r.th) / MAX, 0) / ROWS.length) * 100);

export const Results: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(270);
  const allDone = ramp(t, 196, 210);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Instant marking. Simple theory grading."
        sub="Multiple choice is scored the moment time is up. Theory waits in a queue."
        url={`${CONTACT.site}/teacher/results`}
      >
        <AppBar role="Teacher" />
        <div style={{ padding: 24 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{DEMO.subject} · {DEMO.cls}</div>
                <div style={{ fontSize: 14, color: C.text2 }}>Midterm results</div>
              </div>
              <div style={{ opacity: allDone }}><Badge tone="success">Class average {AVG}%</Badge></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, fontWeight: 600, color: C.muted, padding: "0 4px 8px" }}>
              <span>Student</span><span>MCQ /20</span><span>Theory /10</span><span>Total /{MAX}</span>
            </div>
            {ROWS.map((r, i) => {
              const graded = ramp(t, 110 + i * 24, 122 + i * 24);
              const mcq = Math.round(r.mcq * ramp(t, 20 + i * 8, 56 + i * 8));
              return (
                <div key={r.n} style={{
                  display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "11px 4px",
                  borderTop: `1px solid ${C.border}`, fontSize: 17, background: graded > 0 && graded < 1 ? C.accentMuted : "transparent",
                }}>
                  <span style={{ fontWeight: 600 }}>{r.n}</span>
                  <span>{mcq}</span>
                  <span>{graded > 0.5 ? r.th : <Badge tone="warning" style={{ fontSize: 12, padding: "2px 10px" }}>Pending</Badge>}</span>
                  <span style={{ fontWeight: 700 }}>{graded > 0.5 ? r.mcq + r.th : "—"}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.success, fontWeight: 600, opacity: phase(t, 238) }}>
                <Check size={16} />results.csv downloaded
              </div>
              <Btn tone="ghost" p={press(t, 226)} style={{ padding: "9px 18px", fontSize: 15 }}>Export CSV</Btn>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
