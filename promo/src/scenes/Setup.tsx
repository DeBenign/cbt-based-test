import React from "react";
import { interpolateColors } from "remotion";
import { C } from "../theme";
import { press, ramp, useT } from "../hooks";
import { Split, SceneShell } from "../Layout";
import { AppBar, Badge, Btn, Card, Check } from "../ui";
import { CONTACT, DEMO } from "../config";

const CLASSES = ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"];
const SUBJECTS = ["Basic Science", "Mathematics", "English", "Civic Education", "Physics"];
const SWATCHES = ["#3d5afe", "#0d8f5a", "#d9480f", "#7b2cbf"];

export const Setup: React.FC<{ tag?: string }> = ({ tag }) => {
  const t = useT(300);
  const swap = ramp(t, 215, 235);
  const brand = interpolateColors(swap, [0, 1], [SWATCHES[0], SWATCHES[1]]);
  return (
    <SceneShell>
      <Split
        tag={tag}
        title="Build your school structure"
        sub="Add classes and subjects, then make it yours with your logo and color."
        url={`${CONTACT.site}/admin/setup`}
      >
        <AppBar role="School admin" />
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Classes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CLASSES.map((c, i) => (
                <Badge key={c} tone="accent" style={{ fontSize: 15, padding: "6px 14px", opacity: ramp(t, 20 + i * 12, 32 + i * 12) }}>{c}</Badge>
              ))}
            </div>
          </Card>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Subjects</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUBJECTS.map((s, i) => (
                <Badge key={s} style={{ fontSize: 15, padding: "6px 14px", opacity: ramp(t, 100 + i * 12, 112 + i * 12) }}>{s}</Badge>
              ))}
            </div>
          </Card>
          <Card style={{ gridColumn: "1 / span 2", padding: 18, opacity: ramp(t, 165, 185) }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Branding</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{
                width: 220, height: 56, borderRadius: 12, background: brand, color: C.white, fontWeight: 800,
                fontSize: 17, display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
              }}>
                <span style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>GA</span>
                {DEMO.school}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {SWATCHES.map((c, i) => (
                  <span key={c} style={{
                    width: 34, height: 34, borderRadius: 17, background: c,
                    boxShadow: (i === 0 && swap < 0.5) || (i === 1 && swap >= 0.5) ? `0 0 0 3px ${C.white}, 0 0 0 5px ${c}` : "none",
                  }} />
                ))}
              </div>
              <Btn p={press(t, 250)} style={{ marginLeft: "auto", padding: "10px 18px", fontSize: 15 }}>Save branding</Btn>
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: C.success, fontWeight: 600, opacity: ramp(t, 262, 276) }}>
              <Check size={16} />Your school's logo and color now appear for every teacher and student
            </div>
          </Card>
        </div>
      </Split>
    </SceneShell>
  );
};
