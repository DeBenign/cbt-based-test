import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useRolePath } from "../hooks/useRolePath";
import { useConfirm } from "../context/ConfirmContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";

type Tab = "feed" | "people" | "attempts";
const roleTone: Record<string, "accent" | "warning" | "success"> = { admin: "accent", teacher: "warning", student: "success" };

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

function Feed() {
  const rolePath = useRolePath();
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");

  useEffect(() => {
    api.get("/activity", { params: { page, role: role || undefined, q: q || undefined } }).then((res) => {
      setItems(res.data.items);
      setPages(res.data.pages);
    });
  }, [page, role, q]);

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(qDraft.trim()); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search activity (e.g. published, graded, reset)" style={{ flex: 1, minWidth: 180 }} />
        <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          <option value="">Everyone</option><option value="teacher">Teachers</option><option value="student">Students</option><option value="admin">Admins</option>
        </select>
        <button type="submit">Search</button>
      </form>
      {items.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No activity yet.</p>}
      {items.map((l) => (
        <Card key={l._id} style={{ marginBottom: 6, padding: "10px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <p style={{ marginBottom: 2, fontSize: 14 }}>
                {l.actor._id ? <Link to={rolePath(`/activity/people/${l.actor._id}`)}><b>{l.actor.name}</b></Link> : <b>{l.actor.name}</b>} {" "}
                <Badge tone={roleTone[l.actor.role] || "neutral"}>{l.actor.role}</Badge>
              </p>
              <p style={{ marginBottom: 0, fontSize: 13 }}>
                {l.summary}
                {l.target && <> — for <Link to={rolePath(`/activity/people/${l.target._id}`)}>{l.target.name}</Link></>}
                {l.entityType === "attempt" && l.entityId && <> · <Link to={rolePath(`/activity/attempts/${l.entityId}`)}>open attempt</Link></>}
              </p>
              {l.meta?.reason && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 0 }}>Reason: {l.meta.reason}</p>}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleString()}</span>
          </div>
        </Card>
      ))}
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

function People() {
  const rolePath = useRolePath();
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");

  useEffect(() => {
    api.get("/activity/people", { params: { page, role: role || undefined, q: q || undefined } }).then((res) => {
      setItems(res.data.items);
      setPages(res.data.pages);
    });
  }, [page, role, q]);

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(qDraft.trim()); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Find a student or teacher" style={{ flex: 1, minWidth: 180 }} />
        <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          <option value="">Teachers & students</option><option value="teacher">Teachers</option><option value="student">Students</option>
        </select>
        <button type="submit">Search</button>
      </form>
      {items.map((u) => (
        <Link key={u._id} to={rolePath(`/activity/people/${u._id}`)} style={{ color: "inherit" }}>
          <Card style={{ marginBottom: 6, padding: "10px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <p style={{ marginBottom: 0, fontWeight: 500 }}>{u.name} <Badge tone={roleTone[u.role]}>{u.role}</Badge></p>
                <p style={{ marginBottom: 0, fontSize: 12, color: "var(--text-secondary)" }}>{u.className || u.username || u.email}</p>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {u.lastActiveAt ? `Last active ${new Date(u.lastActiveAt).toLocaleString()}` : "No activity yet"}
              </span>
            </div>
          </Card>
        </Link>
      ))}
      {items.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No one matches.</p>}
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

function Attempts() {
  const rolePath = useRolePath();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [examId, setExamId] = useState("");
  const [status, setStatus] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { api.get("/exams").then((res) => setExams(res.data)); }, []);

  async function load() {
    const res = await api.get("/review/attempts", { params: { page, examId: examId || undefined, status: status || undefined, flagged: flagged || undefined } });
    setItems(res.data.items);
    setPages(res.data.pages);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, examId, status, flagged]);

  async function examAction(kind: "regrade" | "finalize-expired") {
    setMsg(null);
    if (reason.trim().length < 5) { setMsg("Type a reason first (it's recorded in the activity log)."); return; }
    const text = kind === "regrade"
      ? "Recompute every finished attempt for this exam against the current answer key?"
      : "Close out every attempt that ran past its deadline without being submitted?";
    if (!(await confirm(text))) return;
    try {
      const res = await api.post(`/review/exams/${examId}/${kind}`, { reason });
      setMsg(kind === "regrade" ? `Regraded ${res.data.regraded} attempt(s); ${res.data.changed} score(s) changed.` : `Finalized ${res.data.finalized} abandoned attempt(s).`);
      setReason("");
      await load();
    } catch (err: any) {
      setMsg(err.response?.data?.error || "That didn't work.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select value={examId} onChange={(e) => { setPage(1); setExamId(e.target.value); }} style={{ flex: 1, minWidth: 180 }}>
          <option value="">All exams</option>
          {exams.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
        </select>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option><option value="in-progress">In progress</option><option value="submitted">Submitted</option>
          <option value="auto-submitted">Auto-submitted</option><option value="flagged">Flagged</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 0 }}>
          <input type="checkbox" checked={flagged} onChange={(e) => { setPage(1); setFlagged(e.target.checked); }} style={{ width: "auto" }} /> Has integrity events
        </label>
      </div>

      {examId && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 500, fontSize: 13 }}>Whole-exam fixes</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required) — e.g. Q4 answer key was wrong, teacher corrected it" style={{ width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => examAction("regrade")}>Regrade all (after a key fix)</button>
            <button type="button" onClick={() => examAction("finalize-expired")}>Finalize abandoned attempts</button>
          </div>
          {msg && <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>{msg}</p>}
        </Card>
      )}

      {items.map((a) => (
        <Link key={a._id} to={rolePath(`/activity/attempts/${a._id}`)} style={{ color: "inherit" }}>
          <Card style={{ marginBottom: 6, padding: "10px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <p style={{ marginBottom: 0, fontWeight: 500 }}>{a.student.name}</p>
                <p style={{ marginBottom: 0, fontSize: 12, color: "var(--text-secondary)" }}>{a.examTitle} · {new Date(a.startedAt).toLocaleString()}</p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {a.flagCount > 0 && <Badge tone="danger">{a.flagCount} flag{a.flagCount === 1 ? "" : "s"}</Badge>}
                {a.needsGrading && <Badge tone="warning">needs grading</Badge>}
                <Badge tone={a.status === "in-progress" ? "accent" : a.status === "flagged" ? "danger" : "success"}>{a.status}</Badge>
                {a.score !== null && <Badge>score {a.score}</Badge>}
              </div>
            </div>
          </Card>
        </Link>
      ))}
      {items.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No attempts match.</p>}
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

export default function Activity() {
  const [tab, setTab] = useState<Tab>("feed");
  const tabBtn = (t: Tab, label: string) => (
    <button type="button" onClick={() => setTab(t)} style={tab === t ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>{label}</button>
  );
  return (
    <PageShell maxWidth={820}>
      <h1>Activity & corrections</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
        See what teachers and students have done, and fix problems — reopen a crashed attempt, correct marks, regrade after an answer-key fix.
        Every correction needs a reason and is recorded here.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabBtn("feed", "Activity feed")}{tabBtn("people", "People")}{tabBtn("attempts", "Exam attempts")}
      </div>
      {tab === "feed" && <Feed />}
      {tab === "people" && <People />}
      {tab === "attempts" && <Attempts />}
    </PageShell>
  );
}
