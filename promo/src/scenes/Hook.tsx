import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { phase, ramp, useT, useVertical } from "../hooks";
import { SceneShell } from "../Layout";
import { BRAND } from "../config";

const LINES = ["Slow to set.", "Slow to mark.", "Easy to cheat."];

export const Hook: React.FC<{ tag?: string }> = () => {
  const t = useT(270);
  const v = useVertical();
  const size = v ? 128 : 116;
  const problem = 1 - ramp(t, 150, 170);
  const brand = ramp(t, 165, 195);
  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", padding: v ? "0 80px" : "0 160px" }}>
        <div style={{ opacity: problem, position: "absolute", left: v ? 80 : 160, right: 80 }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: v ? 44 : 38, fontWeight: 600, marginBottom: 28 }}>Paper exams are…</div>
          {LINES.map((l, i) => (
            <div key={l} style={{
              color: C.white, fontSize: size, fontWeight: 800, lineHeight: 1.08, letterSpacing: -3,
              opacity: ramp(t, 20 + i * 38, 38 + i * 38), transform: `translateY(${(1 - ramp(t, 20 + i * 38, 38 + i * 38)) * 30}px)`,
            }}>{l}</div>
          ))}
        </div>
        <div style={{ opacity: brand, transform: `scale(${0.96 + 0.04 * brand})`, textAlign: "center" }}>
          <div style={{ color: C.white, fontSize: v ? 150 : 150, fontWeight: 800, letterSpacing: -5 }}>{BRAND.name}</div>
          <div style={{
            color: "rgba(255,255,255,0.82)", fontSize: v ? 46 : 42, fontWeight: 500, marginTop: 16,
            opacity: phase(t, 190, Infinity),
          }}>{BRAND.tagline}</div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
