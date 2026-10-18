import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useRolePath } from "../hooks/useRolePath";
import { ClassRoom, Subject, CurriculumItem } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import Spinner from "../components/Spinner";

// The one place a curriculum is added: pick the class and subject it belongs
// to, upload the scheme of work, and teachers can then generate questions
// from it (Questions → Generate with AI).
export default function Curriculum() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const rolePath = useRolePath();
  const isTeacher = user?.role === "teacher";

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mySubjects = isTeacher ? subjects.filter((s) => user?.subjectIds?.includes(s._id)) : subjects;
  const subjectsForClass = mySubjects.filter((s) => s.classIds.length === 0 || s.classIds.includes(classId));

  async function loadItems() {
    const res = await api.get("/curriculum");
    setItems(res.data);
  }

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([api.get("/classes"), api.get("/subjects")]);
      setClasses(c.data);
      setSubjects(s.data);
      if (c.data[0]) setClassId(c.data[0]._id);
      await loadItems();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!subjectsForClass.find((s) => s._id === subjectId)) setSubjectId(subjectsForClass[0]?._id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjects]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!classId || !subjectId) { setError("Choose a class and a subject."); return; }

    const form = new FormData();
    form.append("classId", classId);
    form.append("subjectId", subjectId);
    form.append("title", title);
    if (mode === "file") {
      if (!file) { setError("Choose a file to upload."); return; }
      form.append("file", file);
    } else {
      form.append("text", text);
    }

    setBusy(true);
    try {
      const res = await api.post("/curriculum", form);
      setSuccess(`Saved "${res.data.title}" — ${res.data.topicCount} topic section(s) found.`);
      setTitle(""); setText(""); setFile(null);
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't upload the curriculum.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this curriculum? Questions already generated from it are kept."))) return;
    await api.delete(`/curriculum/${id}`);
    await loadItems();
  }

  const className = (id: string) => classes.find((c) => c._id === id)?.name || "—";
  const subjectName = (id: string) => subjects.find((s) => s._id === id)?.name || "—";

  return (
    <PageShell maxWidth={780}>
      <h1>Curriculum</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Add the scheme of work or syllabus for each class and subject. Teachers then generate exam questions from it
        {isTeacher ? " — you can add curriculum for the subjects you teach." : "."}
      </p>

      <Card style={{ marginBottom: 24 }}>
        <h3>Add a curriculum</h3>
        <form onSubmit={handleUpload}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label>Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%" }}>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label>Subject</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: "100%" }}>
                {subjectsForClass.length === 0 && <option value="">No subject available</option>}
                {subjectsForClass.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JSS2 Basic Science — Term 1 scheme of work" required style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => setMode("file")} style={mode === "file" ? { borderColor: "var(--accent)" } : undefined}>Upload a file</button>
            <button type="button" onClick={() => setMode("text")} style={mode === "text" ? { borderColor: "var(--accent)" } : undefined}>Paste text</button>
          </div>

          {mode === "file" ? (
            <div style={{ marginBottom: 12 }}>
              <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ width: "100%" }} />
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                PDF, Word (.docx) or text, up to 4 MB. Scanned PDFs (photos of pages) can't be read — paste the text instead.
              </p>
            </div>
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Paste the curriculum text here. Lines like “Week 1: Cells” start a new topic." style={{ width: "100%", marginBottom: 12 }} />
          )}

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}
          {success && <p style={{ color: "var(--text-success)", fontSize: 13 }}>{success}</p>}
          <PrimaryButton type="submit" disabled={busy || !subjectId}>
            {busy ? <><Spinner size={14} />Reading file…</> : "Save curriculum"}
          </PrimaryButton>
        </form>
      </Card>

      <h3>Saved curricula ({items.length})</h3>
      {items.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nothing uploaded yet.</p>}
      {items.map((c) => (
        <Card key={c._id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontWeight: 500, marginBottom: 2 }}>{c.title}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                {className(c.classId)} · {subjectName(c.subjectId)} · {c.topics.length} topic section(s) · {c.fileName || "pasted text"}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.topics.slice(0, 6).map((t, i) => <Badge key={i}>{t.length > 28 ? `${t.slice(0, 28)}…` : t}</Badge>)}
                {c.topics.length > 6 && <Badge tone="neutral">+{c.topics.length - 6} more</Badge>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              {isTeacher && <Link to={rolePath("/ai-questions")}><button type="button" style={{ padding: "4px 12px", fontSize: 12 }}>Generate questions</button></Link>}
              <button type="button" onClick={() => handleDelete(c._id)} style={{ padding: "4px 12px", fontSize: 12 }}>Delete</button>
            </div>
          </div>
        </Card>
      ))}
    </PageShell>
  );
}
