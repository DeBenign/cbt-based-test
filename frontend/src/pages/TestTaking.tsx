import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import { useRolePath } from "../hooks/useRolePath";
import Spinner from "../components/Spinner";

interface AttemptQuestion {
  _id: string;
  questionText: string;
  type: "mcq" | "theory";
  marks: number;
  options: { text: string }[];
}

interface PendingAnswer {
  questionId: string;
  selectedOption?: string;
  answerText?: string;
  clientTimestamp: number;
}

function localStorageKey(attemptId: string) {
  return `cbt_pending_${attemptId}`;
}

function savePendingToStorage(attemptId: string, pending: Map<string, PendingAnswer>) {
  try {
    localStorage.setItem(localStorageKey(attemptId), JSON.stringify(Array.from(pending.values())));
  } catch {
    // storage full or unavailable -- the in-memory map still has it for this session
  }
}

function navKey(attemptId: string) {
  return `cbt_nav_${attemptId}`;
}

// Where the student was and which questions they moved past, so a reload keeps the colours.
function loadNav(attemptId: string): { current: number; seen: string[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(navKey(attemptId)) || "null");
    return { current: Number(raw?.current) || 0, seen: Array.isArray(raw?.seen) ? raw.seen : [] };
  } catch {
    return { current: 0, seen: [] };
  }
}

function saveNav(attemptId: string, current: number, seen: Set<string>) {
  try {
    localStorage.setItem(navKey(attemptId), JSON.stringify({ current, seen: Array.from(seen) }));
  } catch {
    // not critical
  }
}

function clearPendingStorage(attemptId: string) {
  try {
    localStorage.removeItem(navKey(attemptId));
    localStorage.removeItem(localStorageKey(attemptId));
  } catch {
    // nothing to do
  }
}

function loadPendingFromStorage(attemptId: string): PendingAnswer[] {
  try {
    const raw = localStorage.getItem(localStorageKey(attemptId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function TestTaking() {
  const { id: examId } = useParams();
  const navigate = useNavigate();
  const rolePath = useRolePath();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [lockdownRequired, setLockdownRequired] = useState(false);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingLocally, setHasPendingLocally] = useState(false);
  const [current, setCurrent] = useState(0); // index of the question on screen
  const [seen, setSeen] = useState<Set<string>>(new Set()); // questions the student has moved away from

  const pendingRef = useRef<Map<string, PendingAnswer>>(new Map());
  const attemptIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  // Track online/offline status for the UI indicator. navigator.onLine is
  // not perfectly reliable (it only knows about the network interface, not
  // whether the API server is actually reachable), but it's the right
  // signal for "don't bother trying to save right now" during a true outage.
  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(`/attempts/${examId}/start`);
        const { attempt, questions: qs, lockdownRequired: lockdown } = res.data;
        setAttemptId(attempt._id);
        setQuestions(qs);
        setLockdownRequired(!!lockdown);
        const end = new Date(attempt.serverEndTime).getTime();
        setRemainingMs(end - Date.now());

        const restored: Record<string, string> = {};
        for (const a of attempt.answers || []) {
          if (a.selectedOption) restored[a.questionId] = a.selectedOption;
          if (a.answerText) restored[a.questionId] = a.answerText;
        }

        // Recover anything that was answered but never confirmed saved --
        // e.g. the tab closed or the device lost power before the last
        // autosave went through. This is the whole point of persisting to
        // localStorage on every keystroke/selection rather than only
        // holding pending answers in memory.
        const leftover = loadPendingFromStorage(attempt._id);
        for (const p of leftover) {
          pendingRef.current.set(p.questionId, p);
          restored[p.questionId] = p.selectedOption || p.answerText || restored[p.questionId];
        }
        if (leftover.length > 0) setHasPendingLocally(true);

        setAnswers(restored);

        const nav = loadNav(attempt._id);
        setCurrent(Math.min(Math.max(0, nav.current), Math.max(0, qs.length - 1)));
        setSeen(new Set(nav.seen));
      } catch (err: any) {
        if (err.response?.data?.alreadySubmitted) {
          navigate(rolePath("/exams"), { state: { message: "This exam was already submitted." } });
          return;
        }
        setError(err.response?.data?.error || "Couldn't start the exam.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function reportFlag(type: string, meta?: string) {
    const id = attemptIdRef.current;
    if (!id || submittedRef.current) return;
    try {
      const res = await api.post(`/attempts/${id}/flag`, { type, meta });
      setViolationCount(res.data.violationCount || 0);
      if (res.data.terminated) {
        submittedRef.current = true;
        setSubmitted(true);
        navigate(rolePath("/exams"), {
          state: { message: "Your exam was ended early due to repeated integrity violations (tab switching, exiting fullscreen, or similar)." }
        });
      }
    } catch {
      // best-effort -- don't block the student on a logging failure
    }
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) reportFlag("tab-switch");
    }
    function onBlur() {
      reportFlag("window-blur");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lockdownRequired || loading) return;

    const el = document.documentElement as any;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (request) request.call(el).catch(() => {});

    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        reportFlag("fullscreen-exit");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockdownRequired, loading]);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    function onKeyDown(e: KeyboardEvent) {
      const blockedKey =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && ["c", "v", "u"].includes(e.key.toLowerCase()));
      if (blockedKey) {
        e.preventDefault();
        reportFlag("blocked-shortcut", e.key);
      }
    }
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remainingMs === null || submitted) return;
    const tick = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev === null) return prev;
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(tick);
          handleSubmit(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs !== null, submitted]);

  useEffect(() => {
    if (!attemptId || submitted) return;

    const flush = async () => {
      const pending = Array.from(pendingRef.current.values());
      if (pending.length === 0) return;
      if (!navigator.onLine) return; // don't even try -- avoids a pile of noisy failed requests
      try {
        const res = await api.post(`/attempts/${attemptId}/autosave`, { answers: pending });
        pendingRef.current.clear();
        clearPendingStorage(attemptId);
        setHasPendingLocally(false);
        setLastSavedAt(new Date());
        if (typeof res.data.remainingMs === "number") {
          setRemainingMs(res.data.remainingMs);
        }
      } catch {
        // stays queued in both memory and localStorage, retried next interval or on reconnect
      }
    };

    const interval = setInterval(flush, 15000);
    window.addEventListener("online", flush);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", flush);
    };
  }, [attemptId, submitted]);

  function persistPending(questionId: string, entry: PendingAnswer) {
    pendingRef.current.set(questionId, entry);
    setHasPendingLocally(true);
    if (attemptIdRef.current) {
      savePendingToStorage(attemptIdRef.current, pendingRef.current);
    }
  }

  function selectAnswer(questionId: string, optionText: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionText }));
    persistPending(questionId, { questionId, selectedOption: optionText, clientTimestamp: Date.now() });
  }

  function updateTheoryAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    persistPending(questionId, { questionId, answerText: text, clientTimestamp: Date.now() });
  }

  function goTo(index: number) {
    if (index < 0 || index >= questions.length || index === current) return;
    const nextSeen = new Set(seen);
    nextSeen.add(questions[current]._id); // leaving this one: if it is still blank it turns red
    setSeen(nextSeen);
    setCurrent(index);
    if (attemptIdRef.current) saveNav(attemptIdRef.current, index, nextSeen);
    window.scrollTo({ top: 0 });
  }

  const isAnswered = (qid: string) => (answers[qid] || "").trim().length > 0;

  // green = answered, red = moved past without answering, amber = not answered yet
  function statusOf(qid: string): "answered" | "skipped" | "pending" {
    if (isAnswered(qid)) return "answered";
    return seen.has(qid) ? "skipped" : "pending";
  }

  function confirmAndSubmit() {
    const blank = questions.filter((q) => !isAnswered(q._id)).length;
    if (blank > 0 && !window.confirm(`You have ${blank} unanswered question${blank > 1 ? "s" : ""}. Submit anyway?`)) return;
    handleSubmit(false);
  }

  async function handleSubmit(auto = false) {
    if (!attemptId || submitted) return;
    setSubmitted(true);
    try {
      const pending = Array.from(pendingRef.current.values());
      if (pending.length > 0) {
        await api.post(`/attempts/${attemptId}/autosave`, { answers: pending });
      }
      await api.post(`/attempts/${attemptId}/submit`);
      clearPendingStorage(attemptId);
      navigate(rolePath("/exams"), { state: { message: auto ? "Time's up — your exam was submitted automatically." : "Exam submitted." } });
        } catch (err: any) {
      if (!err.response) {
        // Genuine network failure -- no response came back at all.
        setError("Couldn't reach the server. Your answers are saved on this device and will submit once you're back online.");
        retrySubmitWhenOnline();
      } else if (err.response.status === 400 && /already finalized/i.test(err.response.data?.error || "")) {
        // The server already has this marked done -- the earlier submit likely
        // succeeded and only its response got lost. Nothing left to retry.
        clearPendingStorage(attemptId);
        navigate(rolePath("/exams"), { state: { message: "This exam was already submitted." } });
      } else {
        // A real server-side rejection -- show it plainly, don't misread it as
        // an offline issue, and don't retry blindly against the same error.
        setError(err.response.data?.error || "Couldn't submit the exam. Please try again.");
        setSubmitted(false);
      }
    }
  }

  function retrySubmitWhenOnline() {
    const retry = async () => {
      try {
        const pending = Array.from(pendingRef.current.values());
        if (pending.length > 0 && attemptId) {
          await api.post(`/attempts/${attemptId}/autosave`, { answers: pending });
        }
        await api.post(`/attempts/${attemptId}/submit`);
        if (attemptId) clearPendingStorage(attemptId);
        window.removeEventListener("online", retry);
        navigate(rolePath("/exams"), { state: { message: "Exam submitted." } });
      } catch {
        // wait for the next online event
      }
    };
    window.addEventListener("online", retry);
  }

  if (loading) return <PageShell><p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}><Spinner />Loading exam…</p></PageShell>;
  if (error && questions.length === 0) {
    return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  }

  const minutes = remainingMs !== null ? Math.max(0, Math.floor(remainingMs / 60000)) : 0;
  const seconds = remainingMs !== null ? Math.max(0, Math.floor((remainingMs % 60000) / 1000)) : 0;
  const timeLow = remainingMs !== null && remainingMs < 5 * 60 * 1000;

  let syncLabel: string;
  if (!isOnline) {
    syncLabel = "Offline — your answers are saved on this device and will sync once you're back online";
  } else if (hasPendingLocally) {
    syncLabel = "Saving…";
  } else if (lastSavedAt) {
    syncLabel = `Saved ${lastSavedAt.toLocaleTimeString()}`;
  } else {
    syncLabel = "Saves automatically as you answer";
  }

  const q = questions[current];
  const idx = current;
  const answeredCount = questions.filter((x) => isAnswered(x._id)).length;
  const isLast = current === questions.length - 1;
  const STATUS_COLORS = {
    answered: { bg: "#16a34a", fg: "#fff", label: "answered" },
    skipped: { bg: "#dc2626", fg: "#fff", label: "skipped, not answered" },
    pending: { bg: "#f59e0b", fg: "#1f1300", label: "not answered yet" }
  } as const;

  return (
    <PageShell maxWidth={600}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 12,
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 16,
            position: "sticky",
            top: 0,
            background: "var(--surface-1)"
          }}
        >
          <span style={{ fontWeight: 500 }}>Exam in progress</span>
          <Badge tone={timeLow ? "danger" : "warning"}>
            {`${minutes}:${seconds.toString().padStart(2, "0")}`}
          </Badge>
        </div>

        {!isOnline && (
          <p style={{ color: "var(--text-warning)", fontSize: 13, marginBottom: 12 }}>
            You're offline right now. Keep answering — nothing is lost, it'll sync automatically once your connection comes back.
          </p>
        )}

        {lockdownRequired && violationCount > 0 && (
          <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>
            Warning: {violationCount}/3 integrity violations recorded. Your exam will end automatically if this continues.
          </p>
        )}

        {error && <p style={{ color: "var(--text-warning)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {q && (
          <div key={q._id} style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 500, marginBottom: 8 }}>
              <span style={{ color: "var(--text-secondary)" }}>{idx + 1}.</span> {q.questionText}
              {q.type === "theory" && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                  ({q.marks} mark{q.marks > 1 ? "s" : ""} — graded by your teacher)
                </span>
              )}
            </p>

            {q.type === "mcq" ? (
              q.options.map((opt) => {
                const selected = answers[q._id] === opt.text;
                return (
                  <label
                    key={opt.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border: `0.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      background: selected ? "var(--bg-accent-muted)" : "transparent",
                      borderRadius: "var(--radius)",
                      marginBottom: 6,
                      fontSize: 14,
                      cursor: submitted ? "default" : "pointer"
                    }}
                  >
                    <input
                      type="radio"
                      name={q._id}
                      checked={selected}
                      onChange={() => selectAnswer(q._id, opt.text)}
                      disabled={submitted}
                    />
                    {opt.text}
                  </label>
                );
              })
            ) : (
              <textarea
                value={answers[q._id] || ""}
                onChange={(e) => updateTheoryAnswer(q._id, e.target.value)}
                disabled={submitted}
                style={{ width: "100%", minHeight: 120 }}
                placeholder="Type your answer here…"
              />
            )}
          </div>
        )}

        {questions.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0 || submitted}>← Previous</button>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Question {current + 1} of {questions.length} · {answeredCount} answered
              </span>
              <button type="button" onClick={() => goTo(current + 1)} disabled={isLast || submitted}>Next →</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Question navigator">
                {questions.map((item, i) => {
                  const st = STATUS_COLORS[statusOf(item._id)];
                  const here = i === current;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => goTo(i)}
                      disabled={submitted}
                      aria-label={`Question ${i + 1}, ${st.label}${here ? ", current question" : ""}`}
                      aria-current={here ? "step" : undefined}
                      style={{
                        width: 38,
                        height: 38,
                        padding: 0,
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 13,
                        background: st.bg,
                        color: st.fg,
                        border: "none",
                        outline: here ? "3px solid var(--text-primary, #111)" : "none",
                        outlineOffset: 2,
                        cursor: "pointer"
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                {(["answered", "pending", "skipped"] as const).map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLORS[k].bg, display: "inline-block" }} />
                    {k === "answered" ? "Answered" : k === "pending" ? "Not answered yet" : "Skipped / unanswered"}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: 12, color: isOnline ? "var(--text-muted)" : "var(--text-warning)" }}>
            {syncLabel}
          </span>
          <PrimaryButton onClick={confirmAndSubmit} disabled={submitted}>
            {submitted ? "Submitting…" : "Submit exam"}
          </PrimaryButton>
        </div>
      </Card>
    </PageShell>
  );
}