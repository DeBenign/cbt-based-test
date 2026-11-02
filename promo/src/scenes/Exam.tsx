import React from "react";
import { C } from "../theme";
import { phase, press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AlertIcon, Badge, Btn, Card, Check, LockIcon } from "../ui";
import { CONTACT, DEMO } from "../config";

const QS = [
  { q: "Which part of a cell controls its activities?", o: ["Cell wall", "Nucleus", "Vacuole", "Cell membrane"] },
  { q: "Which gas do plants take in for photosynthesis?", o: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"] },
];

export const Exam: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(360);
  const remaining = 29 * 60 + 59 - Math.floor(t / 30);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const qi = t < 180 ? 0 : 1;
  const picked = qi === 0 ? ramp(t, 90, 96) : 0;
  const saved = Math.max(phase(t, 108, 170), phase(t, 262, 330));
  const warn = phase(t, 228, 335);
  const q = QS[qi];
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Exams that run themselves"
        sub="Server-side timer, autosave, and a lockdown that flags tab-switching."
        url={`${CONTACT.site}/student/exams/take`}
      >
        <div style={{ padding: 24, position: "relative", height: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{DEMO.subject}</div>
              <div style={{ fontSize: 14, color: C.text2 }}>{DEMO.cls} · Midterm</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ opacity: saved }}><Badge tone="success"><Check size={14} />Saved</Badge></div>
              <div style={{
                fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "6px 14px", borderRadius: 10,
                background: C.white, border: `1px solid ${C.border}`,
              }}>{mm}:{ss}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: C.text2, margin: "18px 0 6px" }}>
            <span>Question {qi + 4} of 20</span><span>Order shuffled for you</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.neutralBg }}>
            <div style={{ width: `${((qi + 4) / 20) * 100}%`, height: "100%", borderRadius: 4, background: C.accent }} />
          </div>

          <Card style={{ marginTop: 16, padding: 20 }}>
            <div style={{ fontSize: 21, fontWeight: 600, marginBottom: 14, lineHeight: 1.3 }}>{q.q}</div>
            {q.o.map((o, i) => {
              const on = qi === 0 && i === 1 ? picked : 0;
              return (
                <div key={o} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8, borderRadius: 10,
                  border: `1.5px solid ${on > 0.5 ? C.accent : C.border}`, background: on > 0.5 ? C.accentMuted : C.white, fontSize: 17,
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, background: on > 0.5 ? C.accent : C.neutralBg, color: on > 0.5 ? C.white : C.text2,
                  }}>{"ABCD"[i]}</span>
                  {o}
                </div>
              );
            })}
          </Card>

          <div style={{ position: "absolute", left: 24, right: 24, bottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Badge><LockIcon size={14} />Lockdown on</Badge>
            <Btn p={press(t, 172)} style={{ padding: "10px 22px" }}>Next</Btn>
          </div>

          <div style={{
            position: "absolute", left: 24, right: 24, bottom: 70, opacity: warn, transform: `translateY(${(1 - warn) * 16}px)`,
            background: C.dangerBg, border: `1.5px solid ${C.danger}`, borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12, color: C.danger, fontWeight: 600, fontSize: 16,
          }}>
            <AlertIcon />You left the exam. Warning 1 of 3, logged for your teacher.
          </div>
        </div>
      </Split>
    </SceneShell>
  );
};
