import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const FONT = `${fontFamily}, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

// Same tokens as frontend/src/styles/global.css, so the mock UI matches the real app.
export const C = {
  accent: "#3d5afe",
  accent2: "#00c896",
  accentMuted: "#eef1ff",
  ink: "#14161f",
  text2: "#5c626e",
  muted: "#8a8f99",
  border: "#e7e9ee",
  borderStrong: "#d5d8e0",
  bg: "#f7f8fb",
  white: "#ffffff",
  successBg: "#e3f9ef",
  success: "#0d8f5a",
  warnBg: "#fff4e5",
  warn: "#b06a05",
  dangerBg: "#fdecec",
  danger: "#c22f2f",
  neutralBg: "#eef0f4",
  night: "#0c1022",
};
export const GRADIENT = "linear-gradient(135deg, #3d5afe 0%, #6c7bff 55%, #00c896 100%)";
