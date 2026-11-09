import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import { LineChart, Histogram, HBars, trendLabel } from "../components/charts";

interface Option { classId: string; subjectId: string; className: string; subjectName: string; exams: number }
interface ExamRow { examId: string; title: string; date: string; average: number | null; sat: number; classSize: number; absent: number; participation: number; pendingGrading: number }
interface StudentRow {
  studentId: string; name: string; average: number | null; participation: number; exams: number; sat: number;
  trend: "up" | "down" | "flat" | null; flag: "attention" | "doing_well" | "improving" | null; reasons: string[]; enoughData: boolean;
}
interface Data {
  className: string; subjectName: string; passMark: number; message?: string;
  summary: null | { exams: number; students: number; classAverage: number | null; participation: number; trend: "up" | "down" | "flat" | null; attention: number; doingWell: number; improving: number; enoughData: boolean };
  exams: ExamRow[]; students: StudentRow[];
  distribution: { label: string; count: number }[];
  mostMissed: { questionId: string; text: string; topic: string; answers: number; percentCorrect: number }[];
  topics: { topic: string; questions: number; percentCorrect: number }[];
}

type Filter = "all" | "attention" | "doing_well" | "improving";
const show = (v: number | null) => (v === null ? "—" : `${v}%`);
const FLAG: Record<string, { text: string; tone: "danger" | "success" | "accent" }> = {
  attention: { text: "Needs attention", tone: "danger" },
  doing_well: { text: "Doing well", tone: "success" },
  improving: { text: "Improving", tone: "accent" }
};

// Teacher: how a class is doing in one subject. Admin: the same screen for any class, read-only.
export default function Analytics() {
  const { user } = useAuth();
  const [options, setOptions] = useState<Option[] | null>(null);
  const [pick, setPick] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/analytics/options").then((r) => { setOptions(r.data); if (r.data[0]) setPick(`${r.data[0].classId}|${r.data[0].subjectId}`); })
      .catch((e) => setError(e.response?.data?.error || "Couldn't load your classes."));
  }, []);

  useEffect(() => {
    if (!pick) return;
    const [classId, subjectId] = pick.split("|");
    setData(null);
    api.get("/analytics/class", { params: { classId, subjectId } }).then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || "Couldn't load the analytics."));
  }, [pick]);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!options) return <PageShell><Spinner /></PageShell>;

  const s = data?.summary;
  const shown = data ? data.students.filter((st) => filter === "all" || st.flag === filter) : [];

  return (
    <PageShell maxWidth={820}>
      <h1>Class analytics</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
        {user?.role === "admin" ? "Read-only view of how each class is doing." : "How your classes are doing in the subjects you teach."} Based on Benchmark CBT exams only.
      </p>

      {options.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>Nothing to show yet. Results appear here one hour after an exam ends.</p>
      ) : (
        <select value={pick} onChange={(e) => { setPick(e.target.value); setFilter("all"); }} style={{ width: "100%", marginBottom: 16 }}>
          {options.map((o) => <option key={`${o.classId}|${o.subjectId}`} value={`${o.classId}|${o.subjectId}`}>{o.className} · {o.subjectName} ({o.exams} exam{o.exams === 1 ? "" : "s"})</option>)}
        </select>
      )}

      {pick && !data && <Spinner />}
      {data && !s && <p style={{ color: "var(--text-secondary)" }}>{data.message}</p>}

      {data && s && (
        <>
          {!s.enoughData && (
            <p style={{ padding: 10, borderRadius: "var(--radius)", background: "var(--bg-warning)", color: "var(--text-warning)", fontSize: 13, marginBottom: 12 }}>
              Only {s.exams} exam{s.exams === 1 ? "" : "s"} and {s.students} student{s.students === 1 ? "" : "s"} so far. Treat this as a rough guide: trends and "needs attention" flags need at least 3 exams per student.
            </p>
          )}

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 110px" }}><p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Class average</p><p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{show(s.classAverage)}</p><p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>of students who sat</p></div>
              <div style={{ flex: "1 1 110px" }}><p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Took the exams</p><p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{s.participation}%</p><p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{s.students} students</p></div>
              <div style={{ flex: "1 1 110px" }}><p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Direction</p><div style={{ marginTop: 6 }}><Badge tone={trendLabel(s.trend).tone}>{trendLabel(s.trend).text}</Badge></div></div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Exam by exam</h3>
            <LineChart
              labels={data.exams.map((e) => e.title)}
              series={[
                { name: "Class average", color: "var(--accent)", values: data.exams.map((e) => e.average) },
                { name: "Took the exam", color: "var(--accent-2)", dashed: true, values: data.exams.map((e) => e.participation) }
              ]}
              passMark={data.passMark}
            />
            {data.exams.some((e) => e.absent > 0 || e.pendingGrading > 0) && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                Average is of students who sat the exam, so absences don't pull it down. {data.exams.filter((e) => e.pendingGrading > 0).map((e) => `${e.title}: ${e.pendingGrading} paper(s) await theory marking.`).join(" ")}
              </p>
            )}
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>How scores are spread</h3>
            <Histogram bins={data.distribution} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Each bar counts students by their average score.</p>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Students</h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([["all", `All (${data.students.length})`], ["attention", `Needs attention (${s.attention})`], ["doing_well", `Doing well (${s.doingWell})`], ["improving", `Improving (${s.improving})`]] as [Filter, string][]).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setFilter(k)} style={{ padding: "3px 10px", fontSize: 12, borderColor: filter === k ? "var(--accent)" : undefined }}>{label}</button>
                ))}
              </div>
            </div>
            {shown.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No students in this group.</p>}
            {shown.map((st) => (
              <div key={st.studentId} style={{ padding: "10px 0", borderTop: "0.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 500 }}>{st.name}</span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {st.flag && <Badge tone={FLAG[st.flag].tone}>{FLAG[st.flag].text}</Badge>}
                    {!st.enoughData && <Badge>not enough exams yet</Badge>}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                  Average {show(st.average)} · took {st.sat} of {st.exams} exams · {trendLabel(st.trend).text}
                </p>
                {st.reasons.map((r) => <p key={r} style={{ fontSize: 13, color: "var(--text-danger)", margin: "2px 0 0" }}>• {r}</p>)}
              </div>
            ))}
          </Card>

          {data.mostMissed.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Questions most students got wrong</h3>
              <HBars items={data.mostMissed.map((m) => ({ label: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text, value: m.percentCorrect, note: m.topic }))} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Percent who got it right. A very low score can mean a topic needs re-teaching, or that the question itself is faulty.</p>
            </Card>
          )}

          {data.topics.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0 }}>Topics, weakest first</h3>
              <HBars items={data.topics.map((t) => ({ label: t.topic, value: t.percentCorrect, note: `${t.questions} questions` }))} />
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
