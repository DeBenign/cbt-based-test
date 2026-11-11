import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import { LineChart, HBars, trendLabel } from "../components/charts";

interface Point { examId: string; title: string; date: string; pct: number | null; absent: boolean; pending: boolean; classAvg: number | null }
interface SubjectView {
  subjectId: string; subjectName: string; series: Point[]; average: number | null; averageWithAbsent: number | null;
  classAverage: number | null; trend: "up" | "down" | "flat" | null; exams: number; sat: number; participation: number;
}
interface Topic { topic: string; questions: number; percentCorrect: number }
interface Data {
  message?: string;
  overall: null | {
    average: number | null; averageWithAbsent: number | null; classAverage: number | null; exams: number; sat: number; participation: number;
    trend: "up" | "down" | "flat" | null; passMark: number; strongestSubject: string | null; weakestSubject: string | null;
  };
  subjects: SubjectView[];
  topics: { weakest: Topic[]; strongest: Topic[] };
}

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div style={{ flex: "1 1 120px" }}>
    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{label}</p>
    <p style={{ fontSize: 22, fontWeight: 600, margin: "2px 0 0" }}>{value}</p>
    {note && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{note}</p>}
  </div>
);
const show = (v: number | null) => (v === null ? "—" : `${v}%`);

// A student's own progress: per subject over time against the class average, and which topics need practice.
export default function MyProgress() {
  const rolePath = useRolePath();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<{ kind: string; subjectName: string | null; text: string }[]>([]);

  useEffect(() => {
    api.get("/remarks/me").then((r) => setRemarks(r.data)).catch(() => { /* remarks are optional */ });
    api.get("/analytics/me").then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load your progress."));
  }, []);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!data) return <PageShell><Spinner /></PageShell>;

  const o = data.overall;
  return (
    <PageShell maxWidth={720}>
      <h1>My progress</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>Based on your exams taken on Benchmark CBT only. It does not include class work or assignments marked elsewhere.</p>

      {!o && <p style={{ color: "var(--text-secondary)" }}>{data.message || "No results yet."}</p>}
      {o && <p style={{ marginBottom: 16 }}><Link to={rolePath("/report-card")}>Print my report card</Link></p>}

      {remarks.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Remarks from your teachers</h3>
          {remarks.map((r, i) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i ? "0.5px solid var(--border)" : "none" }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{r.kind === "overall" ? "Overall" : r.subjectName}</p>
              <p style={{ margin: "2px 0 0", fontSize: 14 }}>{r.text}</p>
            </div>
          ))}
        </Card>
      )}

      {o && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Stat label="My average" value={show(o.average)} note={`${o.sat} of ${o.exams} exams taken`} />
              <Stat label="Class average" value={show(o.classAverage)} note="students who sat the exams" />
              <Stat label="Exams taken" value={`${o.participation}%`} note={o.participation < 100 ? `If missed exams count as 0: ${show(o.averageWithAbsent)}` : "Well done"} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Badge tone={trendLabel(o.trend).tone}>{trendLabel(o.trend).text}</Badge>
              {o.strongestSubject && <Badge tone="success">Strongest: {o.strongestSubject}</Badge>}
              {o.weakestSubject && <Badge tone="warning">Needs most work: {o.weakestSubject}</Badge>}
            </div>
          </Card>

          {data.subjects.map((s) => (
            <Card key={s.subjectId} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{s.subjectName}</h3>
                <Badge tone={trendLabel(s.trend).tone}>{trendLabel(s.trend).text}</Badge>
              </div>
              <LineChart
                labels={s.series.map((p) => p.title)}
                series={[
                  { name: "Me", color: "var(--accent)", values: s.series.map((p) => p.pct), hollow: s.series.map((p) => p.absent) },
                  { name: "Class average", color: "var(--text-muted)", dashed: true, values: s.series.map((p) => p.classAvg) }
                ]}
                passMark={o.passMark}
              />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                My average <b>{show(s.average)}</b> · class <b>{show(s.classAverage)}</b> · taken {s.sat} of {s.exams}
                {s.series.some((p) => p.absent) && " · a hollow red dot means an exam you didn't take (counts as 0)"}
                {s.series.some((p) => p.pending) && " · some theory marking is still pending"}
              </p>
            </Card>
          ))}

          {(data.topics.weakest.length > 0 || data.topics.strongest.length > 0) && (
            <Card>
              {data.topics.weakest.length > 0 && (<><h3 style={{ marginTop: 0 }}>Topics to practise</h3><HBars items={data.topics.weakest.map((t) => ({ label: t.topic, value: t.percentCorrect, note: `${t.questions} questions` }))} /></>)}
              {data.topics.strongest.length > 0 && (<><h3>Your strongest topics</h3><HBars items={data.topics.strongest.map((t) => ({ label: t.topic, value: t.percentCorrect, note: `${t.questions} questions` }))} /></>)}
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
