import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useRolePath } from "../hooks/useRolePath";
import { ClassRoom, Subject, CurriculumItem, Question } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";

function DraftCard({ q, selected, onToggle, onChanged }: { q: Question; selected: boolean; onToggle: () => void; onChanged: () => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.questionText);
  const [options, setOptions] = useState(q.options);
  const [guide, setGuide] = useState(q.correctAnswerText || "");
  const [marks, setMarks] = useState(q.marks);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (q.type === "mcq" && options.filter((o) => o.isCorrect).length !== 1) {
      setError("Mark exactly one option as correct.");
      return;
    }
    try {
      await api.put(`/questions/${q._id}`, {
        questionText: text,
        options: q.type === "mcq" ? options : [],
        correctAnswerText: q.type === "theory" ? guide : undefined,
        marks
      });
      setEditing(false);
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't save changes.");
    }
  }

  async function discard() {
    if (!(await confirm("Discard this draft question?"))) return;
    await api.delete(`/questions/${q._id}`);
    onChanged();
  }

  async function approveOne() {
    await api.post("/questions/drafts/approve", { ids: [q._id] });
    onChanged();
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={selected} onChange={onToggle} style={{ marginTop: 4, width: "auto" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <Badge tone={q.type === "mcq" ? "accent" : "warning"}>{q.type === "mcq" ? "MCQ" : "Theory"}</Badge>
            <Badge>{q.difficulty}</Badge>
            <Badge>{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge>
            <Badge>{q.topic.length > 30 ? `${q.topic.slice(0, 30)}…` : q.topic}</Badge>
          </div>

          {!editing ? (
            <>
              <p style={{ fontWeight: 500 }}>{q.questionText}</p>
              {q.type === "mcq" ? (
                <ol type="A" style={{ margin: "6px 0 0", paddingLeft: 22, fontSize: 14 }}>
                  {q.options.map((o, i) => (
                    <li key={i} style={{ color: o.isCorrect ? "var(--text-success)" : undefined, fontWeight: o.isCorrect ? 600 : 400 }}>
                      {o.text}{o.isCorrect ? "  ✓" : ""}
                    </li>
                  ))}
                </ol>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-neutral)", padding: 10, borderRadius: "var(--radius)" }}>
                  <b>Marking guide:</b> {q.correctAnswerText}
                </p>
              )}
            </>
          ) : (
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: "100%", marginBottom: 8 }} />
              {q.type === "mcq" ? (
                options.map((o, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input type="radio" checked={o.isCorrect} onChange={() => setOptions(options.map((x, j) => ({ ...x, isCorrect: j === i })))} style={{ width: "auto" }} />
                    <input value={o.text} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} style={{ flex: 1 }} />
                  </div>
                ))
              ) : (
                <textarea value={guide} onChange={(e) => setGuide(e.target.value)} rows={3} placeholder="Marking guide" style={{ width: "100%", marginBottom: 8 }} />
              )}
              <label>Marks</label>
              <input type="number" min={1} value={marks} onChange={(e) => setMarks(Number(e.target.value))} style={{ width: 90, marginBottom: 8 }} />
              {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {editing ? (
              <>
                <PrimaryButton type="button" onClick={save} style={{ padding: "4px 14px", fontSize: 12 }}>Save</PrimaryButton>
                <button type="button" onClick={() => setEditing(false)} style={{ padding: "4px 14px", fontSize: 12 }}>Cancel</button>
              </>
            ) : (
              <>
                <PrimaryButton type="button" onClick={approveOne} style={{ padding: "4px 14px", fontSize: 12 }}>Approve</PrimaryButton>
                <button type="button" onClick={() => setEditing(true)} style={{ padding: "4px 14px", fontSize: 12 }}>Edit</button>
                <button type="button" onClick={discard} style={{ padding: "4px 14px", fontSize: 12 }}>Discard</button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AIQuestions() {
  const { user } = useAuth();
  const rolePath = useRolePath();

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [curricula, setCurricula] = useState<CurriculumItem[]>([]);
  const [drafts, setDrafts] = useState<Question[]>([]);
  const [classId, setClassId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [topicIdx, setTopicIdx] = useState<number[]>([]);
  const [mcqCount, setMcqCount] = useState(10);
  const [theoryCount, setTheoryCount] = useState(0);
  const [theoryMarks, setTheoryMarks] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const mine = curricula.filter((c) => c.classId === classId);
  const chosen = curricula.find((c) => c._id === curriculumId);
  const subjectName = (id?: string) => subjects.find((s) => s._id === id)?.name || "";

  async function loadDrafts() {
    const res = await api.get("/questions", { params: { reviewStatus: "draft" } });
    // a teacher only sees drafts for subjects they teach
    setDrafts((res.data as Question[]).filter((q) => user?.subjectIds?.includes(q.subjectId)));
    setSelected(new Set());
  }

  useEffect(() => {
    (async () => {
      const [c, s, cur] = await Promise.all([api.get("/classes"), api.get("/subjects"), api.get("/curriculum")]);
      setClasses(c.data);
      setSubjects(s.data);
      setCurricula(cur.data);
      const first = (cur.data as CurriculumItem[])[0];
      if (first) { setClassId(first.classId); setCurriculumId(first._id); }
      else if (c.data[0]) setClassId(c.data[0]._id);
      await loadDrafts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mine.find((c) => c._id === curriculumId)) setCurriculumId(mine[0]?._id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, curricula]);

  useEffect(() => { setTopicIdx([]); }, [curriculumId]);

  async function generate() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.post("/questions/generate", {
        curriculumId,
        topicIndexes: topicIdx.length > 0 ? topicIdx : undefined,
        mcqCount,
        theoryCount,
        theoryMarks,
        difficulty
      }, { timeout: 70000 });
      const { drafts: made, rejected, requested } = res.data;
      setNotice(
        `${made.length} draft question(s) ready for review below.` +
        (rejected > 0 ? ` ${rejected} of ${requested} didn't pass the quality check and were left out — generate again for more.` : "")
      );
      await loadDrafts();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't generate questions. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSelected(all = false) {
    const ids = all ? drafts.map((d) => d._id) : Array.from(selected);
    if (ids.length === 0) return;
    await api.post("/questions/drafts/approve", { ids });
    setNotice(`${ids.length} question(s) approved and added to your question bank.`);
    await loadDrafts();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <PageShell maxWidth={780}>
      <h1>Generate questions with AI</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Questions are written from the curriculum you choose and saved as <b>drafts</b>. Check each one — the AI can make mistakes —
        then approve it into your question bank. Drafts can't be used in an exam until approved.
      </p>

      {curricula.length === 0 ? (
        <Card>
          <p>No curriculum has been added for your subjects yet.</p>
          <Link to={rolePath("/curriculum")}><PrimaryButton type="button">Add a curriculum</PrimaryButton></Link>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label>Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%" }}>
                {classes.filter((c) => curricula.some((x) => x.classId === c._id)).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label>Curriculum</label>
              <select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)} style={{ width: "100%" }}>
                {mine.map((c) => <option key={c._id} value={c._id}>{subjectName(c.subjectId)} — {c.title}</option>)}
              </select>
            </div>
          </div>

          {chosen && (
            <div style={{ marginBottom: 12 }}>
              <label>Topics (leave all unticked to use the whole curriculum)</label>
              <div style={{ maxHeight: 160, overflow: "auto", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 8 }}>
                {chosen.topics.map((t, i) => (
                  <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={topicIdx.includes(i)}
                      onChange={() => setTopicIdx((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                      style={{ width: "auto" }}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div><label>Multiple-choice</label><input type="number" min={0} max={15} value={mcqCount} onChange={(e) => setMcqCount(Number(e.target.value))} style={{ width: 90 }} /></div>
            <div><label>Theory</label><input type="number" min={0} max={5} value={theoryCount} onChange={(e) => setTheoryCount(Number(e.target.value))} style={{ width: 90 }} /></div>
            <div><label>Marks per theory</label><input type="number" min={1} max={20} value={theoryMarks} onChange={(e) => setTheoryMarks(Number(e.target.value))} style={{ width: 110 }} /></div>
            <div>
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                <option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Up to 15 questions per run. Run it again for more.</p>

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}
          <PrimaryButton type="button" onClick={generate} disabled={busy || !curriculumId || mcqCount + theoryCount === 0}>
            {busy ? <><Spinner size={14} />Writing questions… (up to a minute)</> : "Generate drafts"}
          </PrimaryButton>
        </Card>
      )}

      {notice && <p style={{ color: "var(--text-success)", fontSize: 13 }}>{notice}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h3 style={{ marginBottom: 0 }}>Drafts waiting for review ({drafts.length})</h3>
        {drafts.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={selected.size === 0} onClick={() => approveSelected(false)}>Approve selected ({selected.size})</button>
            <PrimaryButton type="button" onClick={() => approveSelected(true)}>Approve all</PrimaryButton>
          </div>
        )}
      </div>
      {drafts.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No drafts waiting.</p>}
      {drafts.map((q) => (
        <DraftCard key={q._id} q={q} selected={selected.has(q._id)} onToggle={() => toggle(q._id)} onChanged={loadDrafts} />
      ))}
    </PageShell>
  );
}
