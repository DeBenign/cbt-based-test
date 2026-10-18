import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import { useConfirm } from "../context/ConfirmContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

export default function AttemptDetail() {
  const { id } = useParams<{ id: string }>();
  const rolePath = useRolePath();
  const confirm = useConfirm();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState(15);
  const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await api.get(`/review/attempts/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't load this attempt.");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function act(path: string, body: Record<string, unknown>, confirmText?: string) {
    setMsg(null);
    if (reason.trim().length < 5) { setMsg("Type a reason first — it's saved in the activity log."); return; }
    if (confirmText && !(await confirm(confirmText))) return;
    try {
      const res = await api.post(`/review/attempts/${id}/${path}`, { reason, ...body });
      setMsg(res.data.message || "Done.");
      await load();
    } catch (err: any) {
      setMsg(err.response?.data?.error || "That didn't work.");
    }
  }

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!data) return <PageShell><p>Loading…</p></PageShell>;
  const { attempt, exam, student, questions, maxScore } = data;
  const done = attempt.status !== "in-progress";

  return (
    <PageShell maxWidth={820}>
      <Link to={rolePath("/activity")} style={{ fontSize: 13 }}>← Back to activity</Link>
      <h1 style={{ marginTop: 8 }}>{student?.name || "Deleted user"} — {exam.title}</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <Badge tone={attempt.status === "flagged" ? "danger" : attempt.status === "in-progress" ? "accent" : "success"}>{attempt.status}</Badge>
        {attempt.score !== null && <Badge>score {attempt.score} / {maxScore}</Badge>}
        {attempt.needsGrading && <Badge tone="warning">theory needs grading</Badge>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Started {new Date(attempt.startedAt).toLocaleString()} · {attempt.submittedAt ? `submitted ${new Date(attempt.submittedAt).toLocaleString()}` : `deadline ${new Date(attempt.serverEndTime).toLocaleString()}`}
      </p>

      <Card style={{ marginBottom: 16 }}>
        <h3>Corrections</h3>
        <label>Reason (required — recorded in the activity log)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Power cut at 10:20, school confirmed" style={{ width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {done && (
            <>
              <input type="number" min={1} max={180} value={extra} onChange={(e) => setExtra(Number(e.target.value))} style={{ width: 80 }} />
              <button type="button" onClick={() => act("reopen", { extraMinutes: extra }, `Reopen this attempt for ${extra} more minutes? The student resumes with their saved answers.`)}>Reopen</button>
              <button type="button" onClick={() => act("regrade", {})}>Regrade</button>
            </>
          )}
          {attempt.status === "flagged" && (
            <button type="button" onClick={() => act("dismiss-flags", {}, "Lift the integrity termination and treat this as a normal submission? The flag events stay on record.")}>Dismiss false alarm</button>
          )}
          <button type="button" onClick={() => act("reset", {}, "Delete this attempt entirely so the student can start from scratch? This can't be undone.")}>Reset for a fresh start</button>
        </div>
        {msg && <p style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>{msg}</p>}
      </Card>

      {attempt.flaggedEvents.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3>Integrity events ({attempt.flaggedEvents.length})</h3>
          {attempt.flaggedEvents.map((f: any, i: number) => (
            <p key={i} style={{ fontSize: 13, marginBottom: 2 }}>{new Date(f.timestamp).toLocaleTimeString()} — {f.type}{f.meta ? ` (${f.meta})` : ""}</p>
          ))}
        </Card>
      )}

      <h3>Answers</h3>
      {questions.map((q: any, i: number) => (
        <Card key={String(q.questionId)} style={{ marginBottom: 8 }}>
          {q.missing ? <p style={{ marginBottom: 0 }}>Question {i + 1} was deleted.</p> : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <Badge>Q{i + 1}</Badge><Badge tone={q.type === "mcq" ? "accent" : "warning"}>{q.type}</Badge><Badge>{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge>
                {q.source === "ai" && <Badge>AI-written</Badge>}
                {q.type === "mcq" && q.answered && <Badge tone={q.isCorrect ? "success" : "danger"}>{q.isCorrect ? "correct" : "wrong"}</Badge>}
                {!q.answered && <Badge tone="neutral">not answered</Badge>}
              </div>
              <p style={{ fontWeight: 500 }}>{q.questionText}</p>
              {q.type === "mcq" ? (
                <p style={{ fontSize: 13, marginBottom: 0 }}>
                  Student chose: <b>{q.selectedOption ?? "—"}</b> · Answer key: <b style={{ color: "var(--text-success)" }}>{q.correctOption ?? "none set"}</b>
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, background: "var(--bg-neutral)", padding: 10, borderRadius: "var(--radius)", whiteSpace: "pre-wrap" }}>{q.answerText || "(blank)"}</p>
                  {q.modelAnswer && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}><b>Marking guide:</b> {q.modelAnswer}</p>}
                  {q.answered && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Marks: {q.marksAwarded ?? "ungraded"} / {q.marks}</span>
                      <input type="number" min={0} max={q.marks} step="0.5" value={marksDraft[q.questionId] ?? ""} onChange={(e) => setMarksDraft({ ...marksDraft, [q.questionId]: e.target.value })} placeholder="New marks" style={{ width: 100 }} />
                      <button type="button" disabled={!(marksDraft[q.questionId] ?? "").length} onClick={() => act("marks", { questionId: q.questionId, marks: Number(marksDraft[q.questionId]) })}>Override</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      ))}
    </PageShell>
  );
}
