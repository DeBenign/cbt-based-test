import React from "react";
import { C } from "../theme";
import { phase, press, ramp, typed, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { BigCheck, Btn, Card, Field } from "../ui";
import { CONTACT, DEMO } from "../config";

export const Login: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(270);
  const caret = Math.floor(t / 8) % 2 === 0;
  const a = phase(t, 0, 128);
  const b = phase(t, 128, 232);
  const c = phase(t, 232);
  const signing = ramp(t, 100, 104);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Sign in with email or username"
        sub="First time in? Everyone picks their own password."
        url={`${CONTACT.site}/login`}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Card style={{ width: 400, padding: 30, position: "absolute", opacity: a }}>
            <div style={{ textAlign: "center", fontSize: 24, fontWeight: 700 }}>Sign in</div>
            <div style={{ textAlign: "center", color: C.text2, fontSize: 14, margin: "4px 0 20px" }}>School CBT</div>
            <Field label="Email or username" value={typed(DEMO.username, t, 14, 0.4)} focus={t < 58} caret={caret} />
            <Field label="Password" value={typed("tempPass1", t, 62, 0.35)} mask focus={t >= 58} caret={caret} />
            <Btn p={press(t, 100)} style={{ width: "100%", marginTop: 6 }}>{signing > 0.5 ? "Signing in…" : "Sign in"}</Btn>
          </Card>

          <Card style={{ width: 420, padding: 30, position: "absolute", opacity: b }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Choose a new password</div>
            <div style={{ fontSize: 14, color: C.warn, background: C.warnBg, padding: "8px 12px", borderRadius: 8, marginBottom: 18 }}>
              You signed in with a temporary password.
            </div>
            <Field label="New password" value={typed("myOwnPass26", t, 146, 0.4)} mask focus={t < 190} caret={caret} />
            <Field label="Confirm password" value={typed("myOwnPass26", t, 186, 0.45)} mask focus={t >= 190} caret={caret} />
            <Btn p={press(t, 212)} style={{ width: "100%", marginTop: 6 }}>Save and continue</Btn>
          </Card>

          <div style={{ position: "absolute", opacity: c, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><BigCheck p={ramp(t, 236, 256)} size={92} /></div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 18 }}>Welcome back, {DEMO.firstName}</div>
            <div style={{ fontSize: 17, color: C.text2, marginTop: 6 }}>Your {DEMO.subject} exam is open.</div>
          </div>
        </div>
      </Split>
    </SceneShell>
  );
};
