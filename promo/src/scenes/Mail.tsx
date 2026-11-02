import React from "react";
import { C } from "../theme";
import { phase, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { Badge, MailIcon } from "../ui";
import { DEMO, FEE, naira } from "../config";

const Row: React.FC<{ subject: string; preview: string; active?: boolean; style?: React.CSSProperties }> = ({
  subject, preview, active, style,
}) => (
  <div style={{
    padding: "12px 14px", borderBottom: `1px solid ${C.border}`, background: active ? C.accentMuted : C.white, ...style,
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Benchmark</div>
    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, margin: "2px 0" }}>{subject}</div>
    <div style={{ fontSize: 12.5, color: C.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</div>
  </div>
);

export const Mail: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(240);
  const toast = phase(t, 14, 90);
  const reminder = phase(t, 60, 150);
  const reset = phase(t, 150);
  const second = ramp(t, 130, 150);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Email that keeps schools on track"
        sub="Renewal reminders and password-reset links go straight to the admin's inbox."
        url="Inbox · admin@greenfield.sch.ng"
      >
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "290px 1fr", background: C.white }}>
          <div style={{ borderRight: `1px solid ${C.border}`, background: C.bg }}>
            <div style={{ padding: "14px 14px 10px", fontSize: 18, fontWeight: 700 }}>Inbox</div>
            <div style={{ height: second * 112, overflow: "hidden", opacity: second }}>
              <Row subject="Reset your password" preview="Use this link to choose a new password (valid for 30 minutes)." active={t > 150} />
            </div>
            <Row subject={`${DEMO.school}: your free trial ends in 3 days`} preview="Your school's free trial for Greenfield Academy ends in 3 days." active={t <= 150} />
          </div>

          <div style={{ position: "relative", padding: 26 }}>
            <div style={{ position: "absolute", inset: 26, opacity: reminder }}>
              <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>{DEMO.school}: your free trial ends in 3 days</div>
              <div style={{ fontSize: 13, color: C.muted, margin: "6px 0 16px" }}>To: {DEMO.adminEmail}</div>
              <div style={{ fontSize: 16, lineHeight: 1.55, color: C.ink }}>
                <p style={{ margin: "0 0 10px" }}>Hello {DEMO.admin},</p>
                <p style={{ margin: "0 0 10px" }}>
                  Your school's free trial for <b>{DEMO.school}</b> ends in 3 days (4 November 2026). When it ends, teachers and students can't sign in until a payment is recorded.
                </p>
                <p style={{ margin: "0 0 10px" }}>Current fee per term: <b>{naira(FEE)}</b> ({DEMO.students} student accounts).</p>
                <p style={{ margin: 0, color: C.accent, fontWeight: 600 }}>Sign in and open Billing</p>
              </div>
            </div>
            <div style={{ position: "absolute", inset: 26, opacity: reset }}>
              <div style={{ fontSize: 21, fontWeight: 700 }}>Reset your password</div>
              <div style={{ fontSize: 13, color: C.muted, margin: "6px 0 16px" }}>To: {DEMO.adminEmail}</div>
              <div style={{ fontSize: 16, lineHeight: 1.55 }}>
                <p style={{ margin: "0 0 10px" }}>Hello {DEMO.admin},</p>
                <p style={{ margin: "0 0 14px" }}>Use this link to choose a new password. It is valid for 30 minutes.</p>
                <div style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, background: C.accent, color: C.white, fontWeight: 600 }}>Choose a new password</div>
                <p style={{ margin: "16px 0 0", fontSize: 14, color: C.text2 }}>If you didn't ask for this, ignore this email. Your password stays the same.</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          position: "absolute", top: 16, right: 16, opacity: toast, transform: `translateY(${(1 - toast) * -16}px)`,
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: C.ink, color: C.white,
          fontSize: 15, fontWeight: 600, boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        }}>
          <MailIcon size={18} />Email sent
          <Badge tone="success" style={{ marginLeft: 4 }}>Delivered</Badge>
        </div>
      </Split>
    </SceneShell>
  );
};
