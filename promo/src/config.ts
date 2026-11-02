// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE FIRST: switches, copy and timings live here.
// ─────────────────────────────────────────────────────────────
export const FPS = 30;
export const sec = (n: number) => Math.round(n * FPS);

// ---- switches ------------------------------------------------
export const HAS_MUSIC = true; // true after you drop public/music.mp3
export const MUSIC_VOLUME_SOLO = 0.45; // music only
export const MUSIC_VOLUME_WITH_VOICE = 0.12; // music under narration
// true per video after you drop public/voice/<video>/<scene>.mp3 files
export const HAS_VOICE = { pitch: true, teaser: true, demo: true };
// Online (Nomba) payments are OFF in the product today. While false, the
// online-payment scene is labelled "Coming soon" so the video stays honest.
export const ONLINE_PAYMENTS_LIVE = false;

// ---- brand ---------------------------------------------------
export const BRAND = {
  name: "Benchmark",
  tagline: "Computer-based testing, built for your school.",
  by: "by De-Benign",
};
export const CONTACT = {
  site: "benchmarkcbt.vercel.app",
  phone: "08158447480",
  email: "olalekanibrahim011@gmail.com",
  whatsapp: "wa.me/2348158447480",
};

// ---- demo data (fictional school) ----------------------------
export const DEMO = {
  school: "Greenfield Academy",
  admin: "Mrs. Eze",
  adminEmail: "admin@greenfield.sch.ng",
  student: "Adaeze Okafor",
  firstName: "Adaeze",
  username: "adaeze.okafor",
  cls: "JSS 2",
  subject: "Basic Science",
  students: 240,
  // Placeholders in the product too (backend/src/utils/billingConfig.ts).
  // Change these to your real prices before sending to investors.
  pricePerStudent: 500,
  minTerm: 15000,
  receiptA: "BMK-2026-00001",
  receiptB: "BMK-2026-00002",
};
export const FEE = Math.max(DEMO.minTerm, DEMO.students * DEMO.pricePerStudent);
export const naira = (n: number) => "₦" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ---- timelines (seconds per scene) ---------------------------
export type SceneId =
  | "hook" | "onboarding" | "login" | "exam" | "results"
  | "manualPay" | "onlinePay" | "mail" | "outro";
export type VideoKind = "pitch" | "teaser" | "demo";

export const TIMELINES: Record<VideoKind, { id: SceneId; sec: number }[]> = {
  // A. Pitch / investor explainer, 16:9, ~86s
  pitch: [
    { id: "hook", sec: 9 }, { id: "onboarding", sec: 11 }, { id: "login", sec: 9 },
    { id: "exam", sec: 12 }, { id: "results", sec: 9 }, { id: "manualPay", sec: 12 },
    { id: "onlinePay", sec: 9 }, { id: "mail", sec: 8 }, { id: "outro", sec: 7 },
  ],
  // B. Social teaser, 9:16, ~30s
  teaser: [
    { id: "hook", sec: 4 }, { id: "login", sec: 4.5 }, { id: "exam", sec: 5 },
    { id: "manualPay", sec: 5 }, { id: "onlinePay", sec: 4 }, { id: "mail", sec: 4 },
    { id: "outro", sec: 3.5 },
  ],
  // C. Product demo walkthrough, 16:9, ~71s (numbered steps, no hook)
  demo: [
    { id: "onboarding", sec: 10 }, { id: "login", sec: 9 }, { id: "exam", sec: 11 },
    { id: "results", sec: 9 }, { id: "manualPay", sec: 11 }, { id: "onlinePay", sec: 8 },
    { id: "mail", sec: 8 }, { id: "outro", sec: 5 },
  ],
};
export const totalFrames = (k: VideoKind) =>
  TIMELINES[k].reduce((a, x) => a + sec(x.sec), 0);
