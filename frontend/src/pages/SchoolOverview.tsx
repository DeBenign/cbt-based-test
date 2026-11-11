import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import InsightsNav from "../components/InsightsNav";
import { trendLabel } from "../components/charts";

type Trend = "up" | "down" | "flat" | null;
interface Person { studentId: string; name: string; className: string; average: number | null; participation: number; reasons: string[]; weakSubjects: string[] }
interface Data {
  message?: string;
  summary: null | { students: number; classes: number; exams: number; schoolAverage: number | null; participation: number; attention: number; doingWell: number; improving: number; enoughData: boolean };
  classes: { classId: string; className: string; students: number; exams: number; average: number | null; participation: number; trend: Trend; attention: number; doingWell: number }[];
  subjects: { subjectId: string; subjectName: string; exams: number; average: number | null; participation: number; trend: Trend }[];
  attention: Person[]; doingWell: Person[]; improving: Person[];
}
const show = (v: number | null) => (v === null ? "—" : `${v}%`);

function PeopleList({ title, hint, tone, people }: { title: string; hint: string; tone: "danger" | "success" | "accent"; people: Person[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 8);
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>{title} <Badge tone={tone}>{people.length}</Badge></h3>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 8px" }}>{hint}</p>
      {people.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No one right now.</p>}
      {shown.map((p) => (
        <div key={p.studentId} style={{ padding: "8px 0", borderTop: "0.5px solid var(--border)", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500 }}>{p.name} <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>· {p.className}</span></span>
            <span style={{ color: "var(--text-secondary)" }}>average {show(p.average)} · took {p.participation}% of exams</span>
          </div>
          {p.reasons.map((r) => <p key={r} style={{ margin: "2px 0 0", color: "var(--text-danger)" }}>• {r}</p>)}
          {p.weakSubjects.length > 0 && <p style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>Below the pass mark in: {p.weakSubjects.join(", ")}</p>}
        </div>
      ))}
      {people.length > 8 && <button type="button" onClick={() => setAll(!all)} style={{ marginTop: 8, padding: "3px 12px", fontSize: 12 }}>{all ? "Show fewer" : `Show all ${people.length}`}</button>}
    </Card>
  );
}

// Admin: how the whole school is doing, and who to encourage or support.
export default function SchoolOverview() {
  const rolePath = useRolePath();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get("/analytics/overview").then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load the overview.")); }, []);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!data) return <PageShell><Spinner /></PageShell>;
  const s = data.summary;

  return (
    <PageShell maxWidth={820}>
      <h1>School overview</h1>
      <InsightsNav />
      {!s && <p style={{ color: "var(--text-secondary)" }}>{data.message}</p>}
      {s && (
        <>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>Based on Benchmark CBT exams only. Averages count students who sat the exams; missed exams show separately as "took the exams".</p>
          {!s.enoughData && (
            <p style={{ padding: 10, borderRadius: "var(--radius)", background: "var(--bg-warning)", color: "var(--text-warning)", fontSize: 13, marginBottom: 12 }}>
              Only {s.exams} exam{s.exams === 1 ? "" : "s"} and {s.students} students so far. Treat this as a rough guide until there are at least 3 exams.
            </p>
          )}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {([["School average", show(s.schoolAverage)], ["Took the exams", `${s.participation}%`], ["Students", String(s.students)], ["Need attention", String(s.attention)], ["Doing well", String(s.doingWell)]] as [string, string][]).map(([l, v]) => (
                <div key={l} style={{ flex: "1 1 110px" }}><p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{l}</p><p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{v}</p></div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Classes</h3>
            {data.classes.map((c) => (
              <div key={c.classId} style={{ padding: "8px 0", borderTop: "0.5px solid var(--border)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <Link to={`${rolePath("/analytics")}?class=${c.classId}`} style={{ fontWeight: 500 }}>{c.className}</Link>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge tone={trendLabel(c.trend).tone}>{trendLabel(c.trend).text}</Badge>
                    {c.attention > 0 && <Badge tone="danger">{c.attention} need attention</Badge>}
                    {c.doingWell > 0 && <Badge tone="success">{c.doingWell} doing well</Badge>}
                  </span>
                </div>
                <p style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>Average {show(c.average)} · took {c.participation}% of exams · {c.students} students · {c.exams} exams</p>
              </div>
            ))}
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Subjects</h3>
            {data.subjects.map((x) => (
              <div key={x.subjectId} style={{ padding: "8px 0", borderTop: "0.5px solid var(--border)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontWeight: 500 }}>{x.subjectName}</span><Badge tone={trendLabel(x.trend).tone}>{trendLabel(x.trend).text}</Badge></div>
                <p style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>Average {show(x.average)} across classes · took {x.participation}% of exams · {x.exams} exams</p>
              </div>
            ))}
          </Card>

          <PeopleList title="Needs attention" tone="danger" hint="Low average, many missed exams, or a sharp recent drop. A conversation or extra support may help." people={data.attention} />
          <PeopleList title="Doing well" tone="success" hint="High average with good attendance. Worth recognising." people={data.doingWell} />
          <PeopleList title="Improving" tone="accent" hint="Clearly rising results. Encourage them to keep going." people={data.improving} />
        </>
      )}
    </PageShell>
  );
}
