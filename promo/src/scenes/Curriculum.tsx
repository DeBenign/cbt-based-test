import React from "react";
import { C } from "../theme";
import { press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check, Spinner } from "../ui";
import { CONTACT, DEMO } from "../config";

const TOPICS = ["The cell", "Photosynthesis", "States of matter", "Acids and bases", "Energy", "Forces"];

export const Curriculum: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(270);
  const reading = ramp(t, 40, 52) * (1 - ramp(t, 110, 120));
  const found = ramp(t, 118, 132);
  const listed = ramp(t, 170, 190);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Upload your curriculum"
        sub="PDF, Word or plain text. Benchmark splits it into topic sections."
        url={`${CONTACT.site}/teacher/curriculum`}
      >
        <AppBar role="Teacher" />
        <div style={{ padding: 24 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Add a curriculum</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Badge tone="accent" style={{ fontSize: 14, padding: "6px 14px" }}>{DEMO.subject} · {DEMO.cls}</Badge>
              <Badge tone="accent" style={{ fontSize: 14, padding: "6px 14px" }}>Upload a file</Badge>
              <Badge style={{ fontSize: 14, padding: "6px 14px" }}>Paste text</Badge>
            </div>
            <div style={{
              border: `2px dashed ${C.borderStrong}`, borderRadius: 12, padding: "16px 18px", display: "flex",
              alignItems: "center", gap: 12, opacity: ramp(t, 14, 30),
            }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>JSS2-Basic-Science-Term1.pdf</div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.text2 }}>
                {reading > 0.5 ? <><Spinner size={18} />Reading file…</> : found > 0.5 ? <><Check size={16} />Read</> : null}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, margin: "8px 2px 14px" }}>PDF, Word (.docx) or text, up to 4 MB.</div>
            <div style={{ opacity: found }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>8 topic sections found</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TOPICS.map((tp, i) => (
                  <Badge key={tp} tone="accent" style={{ opacity: ramp(t, 122 + i * 6, 130 + i * 6) }}>{tp}</Badge>
                ))}
                <Badge tone="neutral" style={{ opacity: ramp(t, 160, 168) }}>+2 more</Badge>
              </div>
            </div>
          </Card>
          <div style={{
            marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px",
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, opacity: listed,
          }}>
            <div style={{ fontSize: 15 }}><b>{DEMO.cls} · {DEMO.subject}</b> · 8 topic sections · JSS2-Basic-Science-Term1.pdf</div>
            <Btn p={press(t, 228)} style={{ padding: "9px 16px", fontSize: 15 }}>Generate questions</Btn>
          </div>
        </div>
      </Split>
    </SceneShell>
  );
};
