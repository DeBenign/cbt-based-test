import React from "react";
import { C } from "../theme";
import { phase, press, ramp, typed, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, BigCheck, Btn, Card, Field } from "../ui";
import { CONTACT, DEMO, FEE, naira } from "../config";

export const ManualPay: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(360);
  const caret = Math.floor(t / 8) % 2 === 0;
  const a = phase(t, 0, 124);
  const b = phase(t, 124, 258);
  const c = phase(t, 258);
  const url = t < 124 ? `${CONTACT.site}/admin/billing` : `${CONTACT.site}/superadmin/schools`;
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Pay by cash or bank transfer"
        sub="The owner records it, access returns instantly, and a numbered receipt is issued."
        url={url}
      >
        {/* A: school's Billing page */}
        <div style={{ position: "absolute", inset: 0, opacity: a }}>
          <AppBar role="School admin" />
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Billing</div>
            <Card style={{ padding: 20 }}>
              <Badge tone="warning">Free trial · 3 days left</Badge>
              <div style={{ fontSize: 15, color: C.text2, margin: "16px 0 4px" }}>Fee per term</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{naira(FEE)}</span>
                <span style={{ fontSize: 16, color: C.text2 }}>{DEMO.students} students × {naira(DEMO.pricePerStudent)}</span>
              </div>
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: C.bg, fontSize: 16, lineHeight: 1.5 }}>
                <b>Cash or bank transfer:</b> pay the amount above to the platform owner and keep your receipt. They record it and your access is restored.
              </div>
            </Card>
          </div>
        </div>

        {/* B: owner records payment */}
        <div style={{ position: "absolute", inset: 0, opacity: b }}>
          <AppBar role="Platform owner" />
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{DEMO.school} · Record payment</div>
            <Card style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Amount (₦)" value={naira(FEE)} focus={false} />
                <Field label="Reference" value={typed("TRF-20418", t, 140, 0.3)} focus={t < 172} caret={caret} />
                <Field label="Terms covered" value="1" />
                <Field label="Label" value={typed("2026/27 Term 1", t, 176, 0.45)} focus={t >= 172} caret={caret} />
              </div>
              <Btn tone="success" p={press(t, 238)} style={{ marginTop: 8 }}>Record payment</Btn>
            </Card>
          </div>
        </div>

        {/* C: confirmation + receipt */}
        <div style={{ position: "absolute", inset: 0, opacity: c, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <BigCheck p={ramp(t, 262, 282)} size={84} />
          <div style={{ fontSize: 26, fontWeight: 700 }}>Payment recorded. Access restored.</div>
          <Card style={{ width: 460, padding: 20, opacity: ramp(t, 285, 305), transform: `translateY(${(1 - ramp(t, 285, 305)) * 20}px)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: C.text2 }}>Receipt</div>
              <Badge tone="success">Paid</Badge>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 10px", letterSpacing: -0.5 }}>{DEMO.receiptA}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: C.text2 }}>
              <span>{DEMO.school} · cash / transfer · 1 term</span><b style={{ color: C.ink }}>{naira(FEE)}</b>
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
