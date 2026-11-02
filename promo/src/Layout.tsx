import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, FONT } from "./theme";
import { useVertical } from "./hooks";
import { BRAND, CONTACT } from "./config";

export const UI_W = 800;
export const UI_H = 620;

/** Persistent animated background under every scene. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const d = Math.sin(frame / 120);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: FONT }}>
      <div style={{
        position: "absolute", width: 1400, height: 1400, borderRadius: "50%", left: -400 + d * 60, top: -520,
        background: "radial-gradient(circle, rgba(61,90,254,0.55), transparent 65%)",
      }} />
      <div style={{
        position: "absolute", width: 1200, height: 1200, borderRadius: "50%", right: -320 - d * 50, bottom: -520,
        background: "radial-gradient(circle, rgba(0,200,150,0.32), transparent 65%)",
      }} />
    </AbsoluteFill>
  );
};

/** Fades a scene in and out at its edges. */
export const SceneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity, fontFamily: FONT }}>{children}</AbsoluteFill>;
};

const Browser: React.FC<{ url: string; scale: number; children: React.ReactNode }> = ({ url, scale, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <div style={{
      width: UI_W * scale, height: UI_H * scale, opacity: enter,
      transform: `translateY(${(1 - enter) * 50}px)`,
    }}>
      <div style={{
        width: UI_W, height: UI_H, transform: `scale(${scale})`, transformOrigin: "top left", borderRadius: 16,
        overflow: "hidden", background: C.bg, boxShadow: "0 40px 120px rgba(0,0,0,0.5)", fontFamily: FONT,
      }}>
        <div style={{
          height: 44, background: C.white, borderBottom: `1px solid ${C.border}`, display: "flex",
          alignItems: "center", padding: "0 16px", gap: 8,
        }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
          <div style={{
            marginLeft: 16, flex: 1, height: 28, borderRadius: 14, background: C.bg, color: C.text2,
            fontSize: 14, display: "flex", alignItems: "center", padding: "0 14px",
          }}>{url}</div>
        </div>
        <div style={{ height: UI_H - 44, position: "relative", overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
};

/** Headline on one side, mock browser on the other. Stacks vertically for 9:16. */
export const Split: React.FC<{
  title: string; sub: string; url: string; tag?: string; children: React.ReactNode;
}> = ({ title, sub, url, tag, children }) => {
  const v = useVertical();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = v ? 1.3 : 1.15;

  const text = (
    <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>
      {tag && (
        <div style={{
          display: "inline-block", padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.14)",
          color: C.white, fontSize: v ? 30 : 26, fontWeight: 600, marginBottom: 24,
        }}>{tag}</div>
      )}
      <div style={{ color: C.white, fontSize: v ? 88 : 74, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
      <div style={{
        color: "rgba(255,255,255,0.78)", fontSize: v ? 40 : 32, fontWeight: 500, lineHeight: 1.35,
        marginTop: 24, maxWidth: v ? undefined : 640,
      }}>{sub}</div>
    </div>
  );
  const browser = <Browser url={url} scale={scale}>{children}</Browser>;

  if (v) {
    return (
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 70, right: 70, top: 150 }}>{text}</div>
        <div style={{ position: "absolute", left: (1080 - UI_W * scale) / 2, top: 740 }}>{browser}</div>
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 110, textAlign: "center", color: "rgba(255,255,255,0.7)",
          fontSize: 34, fontWeight: 600,
        }}>{BRAND.name} · {CONTACT.site}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, width: 700, display: "flex", alignItems: "center" }}>{text}</div>
      <div style={{ position: "absolute", left: 1920 - 110 - UI_W * scale, top: (1080 - UI_H * scale) / 2 }}>{browser}</div>
    </AbsoluteFill>
  );
};
