import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GRADIENT } from "../theme";
import { ramp, useT, useVertical } from "../hooks";
import { SceneShell } from "../Layout";
import { BRAND, CONTACT } from "../config";

export const Outro: React.FC<{ tag?: string }> = () => {
  const t = useT(210);
  const v = useVertical();
  const a = ramp(t, 6, 30);
  const b = ramp(t, 40, 64);
  const lines = [CONTACT.site, `WhatsApp / call ${CONTACT.phone}`, CONTACT.email];
  return (
    <SceneShell>
      <AbsoluteFill style={{ background: GRADIENT, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80 }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
          <div style={{ color: C.white, fontSize: v ? 150 : 140, fontWeight: 800, letterSpacing: -5 }}>{BRAND.name}</div>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: v ? 48 : 42, fontWeight: 500, marginTop: 10 }}>{BRAND.tagline}</div>
        </div>
        <div style={{ opacity: b, marginTop: 56 }}>
          <div style={{
            display: "inline-block", background: C.white, color: C.accent, fontSize: v ? 44 : 38, fontWeight: 700,
            padding: "20px 44px", borderRadius: 16,
          }}>Request access for your school</div>
          <div style={{ marginTop: 36, color: C.white, fontSize: v ? 38 : 32, fontWeight: 600, lineHeight: 1.6 }}>
            {lines.map((l) => <div key={l}>{l}</div>)}
          </div>
          <div style={{ marginTop: 24, color: "rgba(255,255,255,0.75)", fontSize: v ? 30 : 26 }}>{BRAND.by} · Built in Nigeria</div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
