import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import { Question } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";

interface Run {
  id: string;
  createdAt: string;
  kind: "generate" | "regenerate";
  summary: string;
  requested: number;
  saved: number;
  rejected: number;
  approved?: number;
  draft?: number;
  discarded?: number;
  params?: Record<string, unknown>;
}

// The teacher's own past AI runs: what was asked, what became of each question, and a one-tap
// way to run the same settings again.
export default function AIHistory() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/questions/ai-history").then((res) => setRuns(res.data)).catch((err) => setError(err.response?.data?.error || "Couldn't load your history."));
  }, []);

  async function toggle(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (!questions[id]) {
      try {
        const res = await api.get(`/questions/ai-history/${id}`);
        setQuestions((prev) => ({ ...prev, [id]: res.data.questions }));
      } catch { setQuestions((prev) => ({ ...prev, [id]: [] })); }
    }
  }

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!runs) return <PageShell><Spinner /></PageShell>;

  return (
    <PageShell maxWidth={780}>
      <h1>AI history</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
        Your recent AI runs. <Link to={rolePath("/ai-questions")}>Back to AI questions</Link>
      </p>
      {runs.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nothing generated yet.</p>}
      {runs.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontWeight: 500, marginBottom: 2 }}>{r.summary}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                {new Date(r.createdAt).toLocaleString()} · {r.kind === "regenerate" ? "regenerate" : `asked for ${r.requested}, kept ${r.saved}${r.rejected ? `, ${r.rejected} left out` : ""}`}
              </p>
              {r.kind === "generate" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge tone="success">{r.approved} approved</Badge>
                  <Badge tone="warning">{r.draft} waiting for review</Badge>
                  <Badge>{r.discarded} discarded</Badge>
                </div>
              )}
            </div>
            {r.kind === "generate" && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <button type="button" onClick={() => toggle(r.id)} style={{ padding: "4px 12px", fontSize: 12 }}>{open === r.id ? "Hide" : "View questions"}</button>
                {r.params && (
                  <button type="button" style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={() => navigate(rolePath("/ai-questions"), { state: { prefill: r.params } })}>Use these settings</button>
                )}
              </div>
            )}
          </div>
          {open === r.id && (
            <div style={{ marginTop: 10 }}>
              {!questions[r.id] && <Spinner />}
              {questions[r.id]?.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>None of this run's questions are left (all discarded).</p>}
              {questions[r.id]?.map((q) => (
                <div key={q._id} style={{ borderTop: "0.5px solid var(--border)", padding: "8px 0", fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <Badge tone={q.reviewStatus === "draft" ? "warning" : "success"}>{q.reviewStatus === "draft" ? "waiting" : "approved"}</Badge>
                    <Badge>{q.type}</Badge>
                    {q.aiCheck && q.aiCheck.status !== "agreed" && <Badge tone="danger">flagged by second check</Badge>}
                  </div>
                  {q.questionText}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </PageShell>
  );
}
