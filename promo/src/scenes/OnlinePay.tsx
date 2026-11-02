import React from "react";
import { C } from "../theme";
import { phase, press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, BigCheck, Btn, Card, Spinner } from "../ui";
import { DEMO, FEE, ONLINE_PAYMENTS_LIVE, naira } from "../config";

const OPTIONS = ["Card", "Bank transfer", "USSD"];

export const OnlinePay: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(270);
  const a = phase(t, 0, 130);
  const b = phase(t, 130, 214);
  const c = phase(t, 214);
  const redirecting = ramp(t, 84, 90);
  const url = t < 130 ? "benchmarkcbt.vercel.app/admin/billing" : "Nomba hosted checkout";
  const label = ONLINE_PAYMENTS_LIVE ? tag : tag ? `${tag} · Coming soon` : "Coming soon";
  return (
    <SceneShell>
      <Split
        tag={label}
        title="Or pay online with Nomba"
        sub="One tap from the Billing page. A webhook confirms it and unlocks the school."
        url={url}
      >
        {/* A: Pay now */}
        <div style={{ position: "absolute", inset: 0, opacity: a }}>
          <AppBar role="School admin" />
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Billing</div>
            <Card style={{ padding: 24 }}>
              <div style={{ fontSize: 15, color: C.text2 }}>Due this term</div>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1, margin: "4px 0 18px" }}>{naira(FEE)}</div>
              <Btn p={press(t, 78)} style={{ minWidth: 230 }}>
                {redirecting > 0.5 ? <><Spinner size={20} color="#fff" />Redirecting to Nomba…</> : "Pay now"}
              </Btn>
            </Card>
          </div>
        </div>

        {/* B: hosted checkout */}
        <div style={{ position: "absolute", inset: 0, opacity: b, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Card style={{ width: 460, padding: 26 }}>
            <div style={{ fontSize: 14, color: C.text2, fontWeight: 600 }}>Secure checkout · Nomba</div>
            <div style={{ fontSize: 16, color: C.text2, marginTop: 10 }}>{DEMO.school} · Benchmark subscription</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "2px 0 16px" }}>{naira(FEE)}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {OPTIONS.map((o, i) => (
                <div key={o} style={{
                  flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, fontSize: 15, fontWeight: 600,
                  border: `1.5px solid ${i === 1 ? C.accent : C.border}`, background: i === 1 ? C.accentMuted : C.white,
                  color: i === 1 ? C.accent : C.text2,
                }}>{o}</div>
              ))}
            </div>
            <Btn p={press(t, 190)} style={{ width: "100%" }}>Pay {naira(FEE)}</Btn>
          </Card>
        </div>

        {/* C: success */}
        <div style={{ position: "absolute", inset: 0, opacity: c, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <BigCheck p={ramp(t, 218, 238)} size={88} />
          <div style={{ fontSize: 26, fontWeight: 700 }}>Payment successful</div>
          <Badge tone="success">Confirmed by webhook · receipt {DEMO.receiptB}</Badge>
        </div>
      </Split>
    </SceneShell>
  );
};
