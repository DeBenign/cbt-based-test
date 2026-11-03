import React from "react";
import { C } from "../theme";
import { phase, press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check, Spinner } from "../ui";
import { CONTACT, DEMO } from "../config";

const Chip: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
  <span style={{
    padding: "6px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600,
    background: on ? C.accent : C.neutralBg, color: on ? C.white : C.text2,
  }}>{children}</span>
);
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: C.bg }}>
    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
  </div>
);

export const AIQuestions: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(330);
  const form = phase(t, 0, 108);
  const writing = phase(t, 108, 160);
  const drafts = phase(t, 160);
  const approved = ramp(t, 285, 295);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="AI writes. You approve."
        sub="Pick topics from your curriculum. Every draft is reviewed by a teacher before students see it."
        url={`${CONTACT.site}/teacher/ai-questions`}
      >
        <AppBar role="Teacher" />
        <div style={{ position: "absolute", left: 24, right: 24, top: 80, opacity: form }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Generate questions with AI</div>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Topics (leave all unticked to use the whole curriculum)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Chip on={t > 24}>The cell</Chip><Chip on={t > 40}>Photosynthesis</Chip><Chip on={false}>States of matter</Chip><Chip on={false}>Acids and bases</Chip>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <Stat label="Multiple-choice" value="6" /><Stat label="Theory" value="2" /><Stat label="Marks per theory" value="5" /><Stat label="Difficulty" value="Medium" />
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Up to 15 questions per run. Run it again for more.</div>
            <Btn p={press(t, 92)}>Generate questions</Btn>
          </Card>
        </div>

        <div style={{ position: "absolute", inset: 0, opacity: writing, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Spinner size={44} />
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text2 }}>Writing questions…</div>
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, top: 76, opacity: drafts }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>8 drafts <span style={{ color: C.muted, fontWeight: 500, fontSize: 15 }}>· {DEMO.subject}</span></div>
            <Btn tone="success" p={press(t, 270)} style={{ padding: "8px 16px", fontSize: 14 }}>Approve all</Btn>
          </div>
          <Card style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Badge tone={approved > 0.5 ? "success" : "warning"}>{approved > 0.5 ? "Approved" : "Draft"}</Badge><Badge tone="accent">AI-written</Badge><Badge>Multiple-choice</Badge>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Which organelle makes food in a plant cell?</div>
            <div style={{ display: "flex", gap: 8, fontSize: 14, flexWrap: "wrap" }}>
              {["Mitochondrion", "Chloroplast", "Nucleus", "Vacuole"].map((o, i) => (
                <span key={o} style={{
                  padding: "4px 10px", borderRadius: 8, border: `1px solid ${i === 1 ? C.success : C.border}`,
                  background: i === 1 ? C.successBg : C.white, color: i === 1 ? C.success : C.text2, fontWeight: i === 1 ? 700 : 500,
                }}>{"ABCD"[i]}. {o}{i === 1 ? " ✓" : ""}</span>
              ))}
            </div>
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Badge tone={approved > 0.5 ? "success" : "warning"}>{approved > 0.5 ? "Approved" : "Draft"}</Badge><Badge tone="accent">AI-written</Badge><Badge>Theory · 5 marks</Badge>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Explain why plants need sunlight.</div>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.45 }}>
              <b>Marking guide:</b> 1 mark light energy · 2 marks chlorophyll absorbs it · 2 marks glucose and oxygen made.
            </div>
          </Card>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: C.success, fontWeight: 600, fontSize: 14, opacity: approved }}>
            <Check size={16} />8 questions added to the question bank
          </div>
        </div>
      </Split>
    </SceneShell>
  );
};
