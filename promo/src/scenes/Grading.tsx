import React from "react";
import { C } from "../theme";
import { press, ramp, typed, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check, Field } from "../ui";
import { CONTACT, DEMO } from "../config";

export const Grading: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(240);
  const caret = Math.floor(t / 8) % 2 === 0;
  const saved = ramp(t, 178, 190);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Theory grading, made simple"
        sub="Each answer sits beside its marking guide. Enter a mark and move on."
        url={`${CONTACT.site}/teacher/grading/midterm`}
      >
        <AppBar role="Teacher" />
        <div style={{ padding: 24 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>Tunde Bello · {DEMO.subject}</div>
              <Badge tone={saved > 0.5 ? "success" : "warning"}>{saved > 0.5 ? "graded" : "needs grading"}</Badge>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Explain why plants need sunlight. (5 marks)</div>
            <div style={{
              padding: "12px 14px", borderRadius: 10, background: C.bg, fontSize: 16, lineHeight: 1.5, marginBottom: 10,
              opacity: ramp(t, 12, 30),
            }}>
              Plants use sunlight to make food. Chlorophyll in the leaf takes in the light and they make glucose and oxygen.
            </div>
            <div style={{
              padding: "10px 14px", borderRadius: 10, background: C.accentMuted, fontSize: 14, color: C.accent, lineHeight: 1.45,
              marginBottom: 14, opacity: ramp(t, 50, 68),
            }}>
              <b>Marking guide:</b> 1 mark light energy · 2 marks chlorophyll absorbs it · 2 marks glucose and oxygen made.
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              <Field label="Marks (0 to 5)" value={typed("4", t, 110, 0.3)} focus={saved < 0.5} caret={caret} style={{ width: 170, marginBottom: 0 }} />
              <Btn p={press(t, 168)}>Save mark</Btn>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.success, fontWeight: 600, fontSize: 15, opacity: saved, paddingBottom: 12 }}>
                <Check size={16} />Saved · 2 left in the queue
              </div>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
