import { useEffect, useState } from "react";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";

const LABEL: Record<string, string> = {
  wrong_answer: "Wrong answer", unclear: "Unclear", off_curriculum: "Off curriculum",
  wrong_level: "Wrong level", duplicate: "Duplicate", other: "Other"
};

interface Report {
  id: string; createdAt: string; schoolName: string; teacherName: string; reason: string; note?: string; modelName?: string;
  snapshot: { questionText: string; options?: { text: string; isCorrect: boolean }[]; topic?: string; aiCheck?: string };
}
interface Data { total: number; byReason: Record<string, number>; byModel: Record<string, number>; reports: Report[] }

// Superadmin: what teachers flagged as wrong with AI questions. Use the pattern (reasons, model) to tune prompts.
export default function AIReports() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setData((await api.get(`/ai-reports?status=${status}`)).data); setError(null); }
    catch (err: any) { setError(err.response?.data?.error || "Couldn't load reports."); }
  }
  useEffect(() => { setData(null); void load(); }, [status]);

  async function resolve(id: string) {
    await api.put(`/ai-reports/${id}/resolve`);
    await load();
  }

  return (
    <PageShell maxWidth={780}>
      <h1>AI question reports</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setStatus("open")} style={status === "open" ? { borderColor: "var(--accent)" } : undefined}>Open</button>
        <button type="button" onClick={() => setStatus("resolved")} style={status === "resolved" ? { borderColor: "var(--accent)" } : undefined}>Resolved</button>
      </div>
      {error && <p style={{ color: "var(--text-danger)" }}>{error}</p>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
            {data.total} {status} report(s) (latest 200). By reason: {Object.entries(data.byReason).map(([k, n]) => `${LABEL[k] || k} ${n}`).join(", ") || "—"}.
            {" "}By model: {Object.entries(data.byModel).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}.
          </p>
          {data.reports.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nothing here.</p>}
          {data.reports.map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <Badge tone="warning">{LABEL[r.reason] || r.reason}</Badge>
                {r.modelName && <Badge>{r.modelName}</Badge>}
                {r.snapshot.aiCheck && r.snapshot.aiCheck !== "agreed" && <Badge tone="danger">second check: {r.snapshot.aiCheck}</Badge>}
              </div>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>{r.snapshot.questionText}</p>
              {r.snapshot.options?.map((o, i) => (
                <p key={i} style={{ fontSize: 13, margin: 0, color: o.isCorrect ? "var(--text-success)" : "var(--text-secondary)" }}>
                  {String.fromCharCode(65 + i)}. {o.text}{o.isCorrect ? " ✓ marked correct" : ""}
                </p>
              ))}
              {r.note && <p style={{ fontSize: 13, marginTop: 6 }}>Teacher's note: {r.note}</p>}
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0" }}>
                {r.teacherName} · {r.schoolName} · {new Date(r.createdAt).toLocaleString()}
              </p>
              {status === "open" && <button type="button" onClick={() => resolve(r.id)} style={{ padding: "4px 12px", fontSize: 12 }}>Mark resolved</button>}
            </Card>
          ))}
        </>
      )}
    </PageShell>
  );
}
