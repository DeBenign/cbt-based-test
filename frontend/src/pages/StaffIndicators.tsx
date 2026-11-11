import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import InsightsNav from "../components/InsightsNav";
import { trendLabel } from "../components/charts";

interface Signal { level: "attention" | "watch" | "good" | "info"; text: string }
interface Teacher {
  teacherId: string; name: string; subjects: string[]; examsSet: number; participation: number | null; enoughData: boolean;
  grading: { markedCount: number; medianDays: number | null; waiting: number; oldestWaitingDays: number | null };
  classes: { className: string; subjectName: string; exams: number; average: number | null; trend: "up" | "down" | "flat" | null }[];
  signals: Signal[];
}
const DOT: Record<string, { colour: string; label: string }> = {
  attention: { colour: "var(--text-danger)", label: "Needs a look" }, watch: { colour: "var(--text-warning)", label: "Keep an eye on" },
  good: { colour: "var(--text-success)", label: "Going well" }, info: { colour: "var(--text-muted)", label: "Note" }
};

// Admin: indicators for each teacher. Teacher: their own. Deliberately no score and no ranking.
export default function StaffIndicators() {
  const { user } = useAuth();
  const [days, setDays] = useState(90);
  const [data, setData] = useState<{ note: string; teachers: Teacher[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api.get("/analytics/staff", { params: { days } }).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load indicators."));
  }, [days]);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;

  return (
    <PageShell maxWidth={820}>
      <h1>{user?.role === "admin" ? "Staff indicators" : "My indicators"}</h1>
      <InsightsNav />
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Period:</span>
        {[30, 90, 180].map((d) => <button key={d} type="button" onClick={() => setDays(d)} style={{ padding: "3px 10px", fontSize: 12, borderColor: days === d ? "var(--accent)" : undefined }}>Last {d} days</button>)}
      </div>
      {!data && <Spinner />}
      {data && (
        <>
          <p style={{ padding: 10, borderRadius: "var(--radius)", background: "var(--bg-neutral)", fontSize: 13, marginBottom: 12 }}>{data.note}</p>
          {data.teachers.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No teachers to show.</p>}
          {data.teachers.map((t) => (
            <Card key={t.teacherId} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{t.name}</h3>
                {!t.enoughData && <Badge>too few exams for firm conclusions</Badge>}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 8px" }}>{t.subjects.join(", ") || "No subjects assigned"}</p>
              <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--text-secondary)" }}>
                {t.examsSet} exam{t.examsSet === 1 ? "" : "s"} set · {t.participation === null ? "no finished exams yet" : `${t.participation}% of students took them`}
                {t.grading.medianDays !== null && ` · theory papers marked in about ${t.grading.medianDays} day${t.grading.medianDays === 1 ? "" : "s"}`}
                {t.grading.waiting > 0 && ` · ${t.grading.waiting} waiting to be marked`}
              </p>
              {t.signals.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nothing stands out yet.</p>}
              {t.signals.map((s, i) => (
                <p key={i} style={{ fontSize: 13, margin: "4px 0", display: "flex", gap: 8 }}>
                  <span title={DOT[s.level].label} style={{ width: 8, height: 8, borderRadius: 4, background: DOT[s.level].colour, marginTop: 5, flex: "0 0 8px" }} />
                  <span>{s.text}</span>
                </p>
              ))}
              {t.classes.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--border)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px" }}>Class results in their exams (context only)</p>
                  {t.classes.map((c) => (
                    <p key={`${c.className}${c.subjectName}`} style={{ fontSize: 13, margin: "2px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {c.className} · {c.subjectName}: {c.average === null ? "—" : `${c.average}%`} over {c.exams} exam{c.exams === 1 ? "" : "s"}
                      <Badge tone={trendLabel(c.trend).tone}>{trendLabel(c.trend).text}</Badge>
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </>
      )}
    </PageShell>
  );
}
