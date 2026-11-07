import { useEffect, useState, Fragment } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import { useRolePath } from "../hooks/useRolePath";
import Spinner from "../components/Spinner";

interface FlaggedEvent {
  type: string;
  timestamp: number;
}

interface StudentRow {
  studentId: string;
  studentName: string;
  score: number;
  totalMarks: number;
  status: string;
  submittedAt: string | null;
  needsGrading: boolean;
  flagCount: number;
  flaggedEvents: FlaggedEvent[];
}

interface ExamResults {
  examTitle: string;
  totalMarks: number;
  classAverage: number;
  attemptedAverage: number;
  classSize: number;
  submittedCount: number;
  absentCount: number;
  results: StudentRow[];
}

interface MyResult {
  status: string;
  score: number;
  needsGrading: boolean;
  submittedAt: string | null;
}

export default function Results() {
  const { user } = useAuth();
  const rolePath = useRolePath();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId");

  const [classResults, setClassResults] = useState<ExamResults | null>(null);
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlockAt, setUnlockAt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    setError(null);
    setUnlockAt(null);

    if (user?.role === "student") {
      api
        .get(`/results/mine/${examId}`)
        .then((res) => setMyResult(res.data))
        .catch((err) => {
          setError(err.response?.data?.error || "No result yet.");
          if (err.response?.data?.unlockAt) setUnlockAt(err.response.data.unlockAt);
        });
    } else {
      api
        .get(`/results/exam/${examId}`)
        .then((res) => setClassResults(res.data))
        .catch((err) => {
          setError(err.response?.data?.error || "Couldn't load results.");
          if (err.response?.data?.unlockAt) setUnlockAt(err.response.data.unlockAt);
        });
    }
  }, [examId, user?.role]);

  async function handleDownload() {
    if (!examId) return;
    setDownloading(true);
    try {
      const res = await api.get(`/results/exam/${examId}/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(classResults?.examTitle || "exam").replace(/[^a-z0-9]/gi, "_")}_results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (!examId) {
    return (
      <PageShell>
        <h1>Results</h1>
        <p style={{ color: "var(--text-secondary)" }}>Open results from an exam's link (e.g. /results?examId=…).</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <h1>Results</h1>
        <p style={{ color: unlockAt ? "var(--text-secondary)" : "var(--text-danger)" }}>{error}</p>
        {unlockAt && (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Available from: <strong>{new Date(unlockAt).toLocaleString()}</strong>
          </p>
        )}
      </PageShell>
    );
  }

  if (user?.role === "student") {
    return (
      <PageShell maxWidth={420}>
        <h1>Your result</h1>
        {myResult ? (
          <Card>
            {myResult.needsGrading && (
              <p style={{ color: "var(--text-warning)", fontSize: 13, marginBottom: 10 }}>
                Part of this exam is still being graded by your teacher — this score isn't final yet.
              </p>
            )}
            <p><strong>Score:</strong> {myResult.score}{myResult.needsGrading ? " (provisional)" : ""}</p>
            <p><strong>Status:</strong> {myResult.status === "absent" ? "Did not attempt" : myResult.status}</p>
            {myResult.status === "absent"
              ? <p style={{ marginBottom: 0, color: "var(--text-secondary)" }}>You didn't take this exam, so your score is 0.</p>
              : <p style={{ marginBottom: 0 }}><strong>Submitted:</strong> {myResult.submittedAt ? new Date(myResult.submittedAt).toLocaleString() : "—"}</p>}
          </Card>
        ) : (
          <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}><Spinner />Loading exam…</p>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={720}>
      {classResults ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <h1 style={{ marginBottom: 0 }}>{classResults.examTitle} — results</h1>
            <div style={{ display: "flex", gap: 8 }}>
              {user?.role === "teacher" && (
                <Link to={rolePath(`/grading/${examId}`)}>
                  <button type="button">Grade theory answers</button>
                </Link>
              )}
              <button type="button" onClick={handleDownload} disabled={downloading}>
                {downloading ? "Preparing…" : "Download CSV"}
              </button>
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            Class average: <strong style={{ color: "var(--text-primary)" }}>{classResults.classAverage} / {classResults.totalMarks}</strong>
            {" "}(all {classResults.classSize} students; those who didn't attempt count as 0)
            {" · "}{classResults.submittedCount} submitted
            {classResults.absentCount > 0 && <> · <strong style={{ color: "var(--text-primary)" }}>{classResults.absentCount} did not attempt</strong></>}
            {classResults.absentCount > 0 && classResults.submittedCount > 0 && <> · average of those who sat it: {classResults.attemptedAverage} / {classResults.totalMarks}</>}
          </p>
          <Card>
            <table style={{ width: "100%" }}>
              <thead>
                <tr >
                  <th>Student</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Flags</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {classResults.results.map((r) => {
                  const isExpanded = expandedId === r.studentId;
                  return (
                    <Fragment key={r.studentId}>
                      <tr
                        data-clickable={r.flagCount > 0}
                        style={{ cursor: r.flagCount > 0 ? "pointer" : "default" }}
                        onClick={() => r.flagCount > 0 && setExpandedId(isExpanded ? null : r.studentId)}
                      >
                        <td>{r.studentName}</td>
                        <td>
                          {r.score} / {r.totalMarks}
                          {r.needsGrading && <Badge tone="warning">pending grading</Badge>}
                        </td>
                        <td>
                          {r.status === "flagged" ? <Badge tone="danger">flagged</Badge> : r.status === "absent" ? <Badge tone="warning">did not attempt</Badge> : r.status}
                        </td>
                        <td>
                          {r.flagCount > 0 ? <Badge tone="warning">{r.flagCount}</Badge> : "—"}
                        </td>
                        <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ fontSize: 12, color: "var(--text-secondary)", paddingTop: 0 }}>
                            {r.flaggedEvents.map((e, i) => (
                              <div key={i}>
                                {e.type} — {new Date(e.timestamp).toLocaleTimeString()}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}><Spinner />Loading exam…</p>
      )}
    </PageShell>
  );
}