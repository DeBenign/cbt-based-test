import React from "react";
import { C } from "../theme";
import { phase, press, ramp, typed, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AlertIcon, AppBar, Badge, BigCheck, Btn, Card, Field } from "../ui";
import { CONTACT, DEMO } from "../config";

const LOG: [string, string, "neutral" | "warning" | "success"][] = [
  [`${DEMO.teacher} approved 8 AI questions`, "Basic Science", "success"],
  [`${DEMO.student} submitted Midterm`, "1 tab switch · flagged", "warning"],
  [`${DEMO.admin} reset a student's password`, "Tunde Bello", "neutral"],
  [`${DEMO.teacher} published Midterm`, "JSS 2", "neutral"],
];

export const Activity: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(300);
  const caret = Math.floor(t / 8) % 2 === 0;
  const a = phase(t, 0, 128);
  const b = phase(t, 128);
  const done = ramp(t, 250, 264);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Every action is traceable"
        sub="Admins review flagged attempts, then reopen or regrade with a reason on record."
        url={`${CONTACT.site}/admin/activity`}
      >
        <AppBar role="School admin" />
        <div style={{ position: "absolute", left: 24, right: 24, top: 76, opacity: a }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["Everyone", "Teachers", "Students", "Admins"].map((x, i) => (
              <Badge key={x} tone={i === 0 ? "accent" : "neutral"} style={{ fontSize: 14, padding: "6px 14px" }}>{x}</Badge>
            ))}
          </div>
          <Card style={{ padding: 6 }}>
            {LOG.map(([what, meta, tone], i) => (
              <div key={what} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 14px",
                borderTop: i ? `1px solid ${C.border}` : "none", opacity: ramp(t, 14 + i * 16, 28 + i * 16),
                background: i === 1 && t > 86 ? C.warnBg : "transparent",
              }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{what}</span>
                <Badge tone={tone}>{meta}</Badge>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, top: 76, opacity: b }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{DEMO.student} · Midterm</div>
              <Badge tone="warning"><AlertIcon size={14} color={C.warn} />Flagged</Badge>
            </div>
            <Field label="Reason (required, recorded in the activity log)" value={typed("Network dropped during the exam", t, 150, 0.6)} focus={done < 0.5} caret={caret} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Btn tone="ghost" style={{ padding: "10px 16px", fontSize: 15 }}>Reopen</Btn>
              <Btn tone="ghost" style={{ padding: "10px 16px", fontSize: 15 }}>Regrade</Btn>
              <Btn p={press(t, 238)} style={{ padding: "10px 16px", fontSize: 15 }}>Dismiss false alarm</Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, opacity: done }}>
              <BigCheck p={done} size={40} />
              <div style={{ fontSize: 16, fontWeight: 600, color: C.success }}>Flag dismissed and recorded in the activity log</div>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
