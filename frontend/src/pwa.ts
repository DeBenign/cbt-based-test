import { registerSW } from "virtual:pwa-register";

// Phones keep tabs (and the installed app) open for days, so they can keep running an
// old build after a deploy. This checks for a new version regularly and when the tab
// comes back to the front, then switches to it — but never while a student is writing
// an exam (the swap reloads the page); it waits until they leave the exam screen.
const EXAM_SCREEN = /\/exams\/[^/]+\/take/;

export function initPwa() {
  let registration: ServiceWorkerRegistration | undefined;
  let updateReady = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      applyIfSafe();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
    }
  });

  function applyIfSafe() {
    if (updateReady && !EXAM_SCREEN.test(window.location.pathname)) {
      updateReady = false;
      updateSW(true);
    }
  }

  const check = () => registration?.update().catch(() => { /* offline: try again later */ });
  setInterval(check, 30 * 60 * 1000);
  setInterval(applyIfSafe, 10 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}
