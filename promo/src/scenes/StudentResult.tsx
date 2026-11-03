import React from "react";
import { C } from "../theme";
import { phase, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { Badge, Card, LockIcon } from "../ui";
import { CONTACT, DEMO } from "../config";

export const StudentResult: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(210);
  const locked = phase(t, 0, 98);
  const open = phase(t, 98);
  const secs = Math.max(0, 41 * 60 + 12 - Math.floor(t / 3));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const score = Math.round(24 * ramp(t, 110, 150));
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Students see only their own result"
        sub="Results unlock one hour after the exam ends, so every student gets a fair finish."
        url={`${CONTACT.site}/student/results`}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Card style={{ width: 460, padding: 30, textAlign: "center", position: "absolute", opacity: locked }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><LockIcon size={44} color={C.accent} /></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Results aren't available yet</div>
            <div style={{ fontSize: 16, color: C.text2, margin: "8px 0 16px" }}>They unlock 1 hour after the exam ends.</div>
            <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: C.accent }}>{mm}:{ss}</div>
          </Card>

          <Card style={{ width: 460, padding: 30, position: "absolute", opacity: open }}>
            <div style={{ fontSize: 15, color: C.text2, fontWeight: 600 }}>Your result · {DEMO.subject} Midterm</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 14px" }}>
              <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, color: C.accent }}>{score}</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: C.muted }}>/ 30</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="success">Status: graded</Badge>
              <Badge>Multiple choice 16/20</Badge>
              <Badge>Theory 8/10</Badge>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
