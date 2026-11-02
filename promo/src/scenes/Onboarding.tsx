import React from "react";
import { C } from "../theme";
import { phase, press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Btn, Card, Check } from "../ui";
import { CONTACT, DEMO } from "../config";

const ROWS = [
  ["Adaeze Okafor", "JSS 2", "adaeze.okafor", "Tq4x-9mNb"],
  ["Tunde Bello", "JSS 2", "tunde.bello", "Zk7p-2cWd"],
  ["Chiamaka Eze", "JSS 1", "chiamaka.eze", "Rb3n-8vLx"],
  ["Ibrahim Musa", "SS 1", "ibrahim.musa", "Hf6s-4yQe"],
  ["Funke Adeyemi", "SS 3", "funke.adeyemi", "Ua9m-5tJk"],
];
const COLS = "1.3fr 0.6fr 1.2fr";

export const Onboarding: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(330);
  const count = Math.round(DEMO.students * ramp(t, 120, 200));
  const done = ramp(t, 205, 220);
  const sheet = ramp(t, 255, 275);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Set up a school in a day"
        sub="Upload one spreadsheet. Every student and teacher gets a login."
        url={`${CONTACT.site}/admin/users`}
      >
        <AppBar role="School admin" />
        <div style={{ padding: 24 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Bulk upload</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 10, background: C.bg,
                fontSize: 14, fontWeight: 600, opacity: ramp(t, 8, 22),
              }}><Check size={16} />students.csv</div>
            </div>

            <div style={{ position: "relative", height: 258 }}>
              <div style={{ opacity: 1 - sheet }}>
                <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, fontWeight: 600, color: C.muted, padding: "0 4px 8px" }}>
                  <span>Name</span><span>Class</span><span>Username (generated)</span>
                </div>
                {ROWS.map((r, i) => (
                  <div key={r[0]} style={{
                    display: "grid", gridTemplateColumns: COLS, padding: "10px 4px", borderTop: `1px solid ${C.border}`, fontSize: 16,
                    opacity: ramp(t, 28 + i * 14, 40 + i * 14),
                  }}>
                    <span style={{ fontWeight: 600 }}>{r[0]}</span>
                    <span style={{ color: C.text2 }}>{r[1]}</span>
                    <span style={{ color: C.accent, fontWeight: 600, opacity: ramp(t, 110 + i * 8, 122 + i * 8) }}>{r[2]}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, opacity: sheet }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Login sheet</div>
                {ROWS.slice(0, 4).map((r) => (
                  <div key={r[0]} style={{
                    display: "grid", gridTemplateColumns: COLS, padding: "10px 4px", borderTop: `1px solid ${C.border}`, fontSize: 16,
                  }}>
                    <span style={{ fontWeight: 600 }}>{r[0]}</span>
                    <span style={{ color: C.accent, fontWeight: 600 }}>{r[2]}</span>
                    <span style={{ fontFamily: "monospace", color: C.text2 }}>{r[3]}</span>
                  </div>
                ))}
                <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>Temporary passwords are shown once.</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: C.text2, marginBottom: 6 }}>
                <span>{done > 0.5 ? "Import complete" : "Importing…"}</span>
                <span>{count} / {DEMO.students}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: C.neutralBg, overflow: "hidden" }}>
                <div style={{ width: `${(count / DEMO.students) * 100}%`, height: "100%", background: done > 0.5 ? C.accent2 : C.accent }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, opacity: done }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.success, fontWeight: 600, fontSize: 16 }}>
                <Check size={18} />{DEMO.students} students imported
              </div>
              <Btn p={press(t, 245)} style={{ padding: "10px 18px", fontSize: 15 }}>Download login sheet</Btn>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
