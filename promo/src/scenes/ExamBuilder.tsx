import React from "react";
import { C } from "../theme";
import { phase, press, ramp, typed, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check, Field } from "../ui";
import { CONTACT, DEMO } from "../config";

export const ExamBuilder: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(330);
  const caret = Math.floor(t / 8) % 2 === 0;
  const a = phase(t, 0, 150);
  const b = phase(t, 150);
  const count = Math.round(20 * ramp(t, 196, 236));
  const published = ramp(t, 292, 306);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Build and schedule the exam"
        sub="Set the class, duration and time window. Fill it from your question bank, then publish."
        url={`${CONTACT.site}/teacher/exams/new`}
      >
        <AppBar role="Teacher" />
        <div style={{ position: "absolute", left: 24, right: 24, top: 80, opacity: a }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>New exam</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Field label="Subject" value={DEMO.subject} />
              <Field label="Class" value={DEMO.cls} />
              <Field label="Exam title" value={typed("Midterm", t, 12, 0.3)} focus={t < 40} caret={caret} />
              <Field label="Duration (mins)" value={typed("30", t, 44, 0.3)} focus={t >= 40 && t < 64} caret={caret} />
              <Field label="Starts" value={typed("Mon 10 Nov, 9:00 am", t, 66, 0.5)} focus={t >= 64 && t < 100} caret={caret} />
              <Field label="Ends" value={typed("Mon 10 Nov, 9:30 am", t, 100, 0.5)} focus={t >= 100} caret={caret} />
            </div>
            <Btn p={press(t, 136)} style={{ marginTop: 4 }}>Create draft</Btn>
          </Card>
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, top: 80, opacity: b }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{DEMO.subject} · Midterm</div>
              <Badge tone="warning">Draft</Badge>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 4 }}>Topics (optional)</div>
                <div style={{ padding: "10px 12px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 10, fontSize: 15 }}>The cell, Photosynthesis</div>
              </div>
              <div style={{ width: 150 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 4 }}>Number of questions</div>
                <div style={{ padding: "10px 12px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 10, fontSize: 15 }}>20</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <Btn tone="ghost" p={press(t, 178)} style={{ padding: "10px 18px", fontSize: 15 }}>Auto-fill from bank</Btn>
              <div style={{ fontSize: 16, fontWeight: 700, color: count === 20 ? C.success : C.text2 }}>{count} / 20 questions added</div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: C.neutralBg, marginBottom: 16 }}>
              <div style={{ width: `${count * 5}%`, height: "100%", borderRadius: 4, background: C.accent2 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Btn tone="success" p={press(t, 276)}>Publish exam</Btn>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.success, fontWeight: 600, fontSize: 15, opacity: published }}>
                <Check size={16} />Exam published and scheduled.
              </div>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
