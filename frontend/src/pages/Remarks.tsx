import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";
import InsightsNav from "../components/InsightsNav";

interface Option { classId: string; subjectId: string; className: string; subjectName: string }
interface Row { studentId: string; name: string; review: null | { id: string; status: "draft" | "released"; text: string; edited: boolean; flag: string | null; enoughData: boolean } }

const FLAG: Record<string, { text: string; tone: "danger" | "success" | "accent" }> = {
  attention: { text: "Needs attention", tone: "danger" }, doing_well: { text: "Doing well", tone: "success" }, improving: { text: "Improving", tone: "accent" }
};

// Teachers write a remark per student for their subject; the school admin writes the overall remark.
// Drafts are written from the exam numbers, then a person reads, edits and releases them.
export default function Remarks() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === "admin";
  const [options, setOptions] = useState<Option[] | null>(null);
  const [pick, setPick] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Admin picks a class only; a teacher picks class and subject.
  const choices = options ? (isAdmin ? [...new Map(options.map((o) => [o.classId, o])).values()] : options) : [];
  const [classId, subjectId] = pick.split("|");
  const query = { classId, ...(isAdmin ? {} : { subjectId }) };

  useEffect(() => {
    api.get("/analytics/options").then((r) => {
      setOptions(r.data);
      if (r.data[0]) setPick(isAdmin ? `${r.data[0].classId}|` : `${r.data[0].classId}|${r.data[0].subjectId}`);
    });
  }, [isAdmin]);

  async function load() {
    if (!classId) return;
    const res = await api.get("/remarks/class", { params: query });
    setRows(res.data.students);
    setEdits({});
  }
  useEffect(() => { setRows(null); setMsg(null); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pick]);

  async function act(fn: () => Promise<void>) {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e: any) { setMsg({ ok: false, text: e.response?.data?.error || "Something went wrong." }); } finally { setBusy(false); }
  }

  const generate = () => act(async () => {
    const r = (await api.post("/remarks/generate", query)).data;
    setMsg({ ok: true, text: `${r.created} new draft(s) written, ${r.refreshed} refreshed${r.keptYourEdits ? ` (your own wording kept on ${r.keptYourEdits})` : ""}. Read them, edit if needed, then release.` });
    await load();
  });
  const save = (id: string) => act(async () => { await api.put(`/remarks/${id}`, { text: edits[id] }); setMsg({ ok: true, text: "Saved." }); await load(); });
  const release = (ids: string[], on: boolean) => act(async () => { await api.post("/remarks/release", { ids, release: on }); setMsg({ ok: true, text: on ? "Released. Students can now see it." : "Withdrawn. Students can no longer see it." }); await load(); });

  const drafts = (rows ?? []).filter((r) => r.review?.status === "draft");
  const releaseAll = async () => {
    if (drafts.length === 0) return;
    if (await confirm(`Release ${drafts.length} draft remark${drafts.length === 1 ? "" : "s"} to students? Have you read them?`)) await release(drafts.map((r) => r.review!.id), true);
  };

  if (!options) return <PageShell><Spinner /></PageShell>;

  return (
    <PageShell maxWidth={820}>
      <h1>{isAdmin ? "Overall remarks" : "Remarks"}</h1>
      <InsightsNav />
      <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
        Drafts are written from each student's exam numbers (average, class comparison, trend, missed exams, topics). Read and edit them, then release. Students see a remark only after you release it.
      </p>
      {choices.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>Remarks appear here once a class has finished exams.</p> : (
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
          {choices.map((o) => <option key={`${o.classId}|${isAdmin ? "" : o.subjectId}`} value={`${o.classId}|${isAdmin ? "" : o.subjectId}`}>{isAdmin ? o.className : `${o.className} · ${o.subjectName}`}</option>)}
        </select>
      )}
      {pick && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" onClick={generate} disabled={busy}>Write drafts for this class</button>
          <button type="button" onClick={releaseAll} disabled={busy || drafts.length === 0}>Release all drafts ({drafts.length})</button>
        </div>
      )}
      {msg && <p style={{ padding: 10, borderRadius: "var(--radius)", fontSize: 13, color: msg.ok ? "var(--text-success)" : "var(--text-danger)", background: msg.ok ? "var(--bg-success)" : "var(--bg-danger)" }}>{msg.text}</p>}
      {pick && !rows && <Spinner />}
      {rows?.map((r) => {
        const rv = r.review;
        const text = rv ? (edits[rv.id] ?? rv.text) : "";
        const changed = rv ? text !== rv.text : false;
        return (
          <Card key={r.studentId} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontWeight: 500 }}>{r.name}</span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {rv?.flag && FLAG[rv.flag] && <Badge tone={FLAG[rv.flag].tone}>{FLAG[rv.flag].text}</Badge>}
                {rv && !rv.enoughData && <Badge>not enough exams yet</Badge>}
                {rv?.edited && <Badge>edited</Badge>}
                {rv ? <Badge tone={rv.status === "released" ? "success" : "warning"}>{rv.status === "released" ? "Released" : "Draft"}</Badge> : <Badge>No remark yet</Badge>}
              </span>
            </div>
            {rv ? (
              <>
                <textarea value={text} disabled={rv.status === "released"} rows={3} maxLength={1500}
                  onChange={(e) => setEdits({ ...edits, [rv.id]: e.target.value })} style={{ width: "100%", marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {rv.status === "draft" && <button type="button" disabled={busy || !changed} onClick={() => save(rv.id)} style={{ padding: "3px 12px", fontSize: 12 }}>Save changes</button>}
                  {rv.status === "draft" && <button type="button" disabled={busy || changed} onClick={() => release([rv.id], true)} style={{ padding: "3px 12px", fontSize: 12 }}>Release</button>}
                  {rv.status === "released" && <button type="button" disabled={busy} onClick={() => release([rv.id], false)} style={{ padding: "3px 12px", fontSize: 12 }}>Withdraw to edit</button>}
                  {changed && <span style={{ fontSize: 12, color: "var(--text-secondary)", alignSelf: "center" }}>Save before releasing</span>}
                </div>
              </>
            ) : <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Press "Write drafts for this class" to create one.</p>}
          </Card>
        );
      })}
    </PageShell>
  );
}
