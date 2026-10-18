import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";

export default function PersonActivity() {
  const { userId } = useParams<{ userId: string }>();
  const rolePath = useRolePath();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/activity/users/${userId}`).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "Couldn't load this person."));
  }, [userId]);

  if (error) return <PageShell><p style={{ color: "var(--text-danger)" }}>{error}</p></PageShell>;
  if (!data) return <PageShell><p>Loading…</p></PageShell>;
  const { user } = data;

  return (
    <PageShell maxWidth={820}>
      <Link to={rolePath("/activity")} style={{ fontSize: 13 }}>← Back to activity</Link>
      <h1 style={{ marginTop: 8 }}>{user.name} <Badge tone={user.role === "teacher" ? "warning" : "success"}>{user.role}</Badge></h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        {user.username && <>Username: {user.username} · </>}
        {!user.email.endsWith("@users.benchmark.local") && <>{user.email} · </>}
        Joined {new Date(user.createdAt).toLocaleDateString()}
        {user.mustChangePassword && " · hasn't set their own password yet"}
      </p>

      {user.role === "teacher" && (
        <Card style={{ marginBottom: 16 }}>
          <p><b>Subjects:</b> {data.subjects?.join(", ") || "none assigned"}</p>
          <p style={{ marginBottom: 0 }}>
            <b>Questions:</b> {data.questionStats.manual} written by hand · {data.questionStats.aiApproved} AI (approved) · {data.questionStats.aiDraftsPending} AI drafts not yet reviewed
          </p>
          {data.exams?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>Exams</p>
              {data.exams.map((e: any) => (
                <p key={e._id} style={{ fontSize: 13, marginBottom: 2 }}>{e.title} <Badge>{e.status}</Badge></p>
              ))}
            </div>
          )}
        </Card>
      )}

      {user.role === "student" && (
        <>
          <h3>Exam attempts</h3>
          {data.attempts.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No attempts yet.</p>}
          {data.attempts.map((a: any) => (
            <Link key={a._id} to={rolePath(`/activity/attempts/${a._id}`)} style={{ color: "inherit" }}>
              <Card style={{ marginBottom: 6, padding: "10px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ marginBottom: 0, fontWeight: 500 }}>{a.examTitle}</p>
                    <p style={{ marginBottom: 0, fontSize: 12, color: "var(--text-secondary)" }}>{new Date(a.startedAt).toLocaleString()} · {a.answered} answered</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {a.flagCount > 0 && <Badge tone="danger">{a.flagCount} flags</Badge>}
                    <Badge tone={a.status === "flagged" ? "danger" : a.status === "in-progress" ? "accent" : "success"}>{a.status}</Badge>
                    {a.score !== null && <Badge>score {a.score}</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </>
      )}

      <h3 style={{ marginTop: 20 }}>Timeline</h3>
      {data.timeline.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nothing recorded yet.</p>}
      {data.timeline.map((l: any) => (
        <Card key={l._id} style={{ marginBottom: 6, padding: "8px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>
              {l.actor._id === user._id ? "" : <b>{l.actor.name}: </b>}{l.summary}
              {l.meta?.reason && <span style={{ color: "var(--text-secondary)" }}> — {l.meta.reason}</span>}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(l.createdAt).toLocaleString()}</span>
          </div>
        </Card>
      ))}
    </PageShell>
  );
}
