import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const useVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Timeline authored for `nominal` frames, stretched or squeezed to the scene's real length. */
export const useT = (nominal: number) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (f * nominal) / durationInFrames;
};

export const ramp = (t: number, from: number, to: number) =>
  interpolate(t, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** 1 between start and end (fading at both edges). start<=0 means "visible from the start". */
export const phase = (t: number, start: number, end: number = Infinity, fade = 10) => {
  const inn = start <= 0 ? 1 : ramp(t, start, start + fade);
  const out = Number.isFinite(end) ? 1 - ramp(t, end, end + fade) : 1;
  return inn * out;
};

export const typed = (text: string, t: number, start: number, perFrame = 0.4) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * perFrame)));

/** 0→1→0 button press pulse at time `at`. */
export const press = (t: number, at: number) => ramp(t, at, at + 3) * (1 - ramp(t, at + 4, at + 9));
