import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Subject, ClassRoom, Question } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import { useRolePath } from "../hooks/useRolePath";
import Spinner from "../components/Spinner";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExamBuilder() {
  const { id: existingExamId } = useParams();
  const rolePath = useRolePath();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [lockdownRequired, setLockdownRequired] = useState(true);
  const [topics, setTopics] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(existingExamId || null);
  const [loading, setLoading] = useState(!!existingExamId);
  const navigate = useNavigate();

  // Same restriction as the Question Bank -- a teacher only ever sees
  // subjects they're actually assigned to.
  const visibleSubjects = subjects.filter(
    (s) => user?.role !== "teacher" || user.subjectIds?.includes(s._id)
  );

  useEffect(() => {
    (async () => {
      const [subRes, classRes] = await Promise.all([api.get("/subjects"), api.get("/classes")]);
      setSubjects(subRes.data);
      setClasses(classRes.data);

      if (existingExamId) {
        const examRes = await api.get(`/exams/${existingExamId}`);
        const exam = examRes.data;
        setSubjectId(exam.subjectId);
        setClassId(exam.classId);
        setTitle(exam.title);
        setDuration(exam.duration);
        setStartTime(toLocalInputValue(exam.startTime));
        setEndTime(toLocalInputValue(exam.endTime));
        setLockdownRequired(!!exam.lockdownRequired);
        setAttachedIds(exam.questionIds || []);
        setLoading(false);
      } else {
        const ownSubjects = user?.role === "teacher"
          ? subRes.data.filter((s: Subject) => user.subjectIds?.includes(s._id))
          : subRes.data;
        if (ownSubjects.length > 0) setSubjectId(ownSubjects[0]._id);
        if (classRes.data.length > 0) setClassId(classRes.data[0]._id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingExamId]);

  useEffect(() => {
    if (!examId || !subjectId || !classId) return;
    api.get("/questions", { params: { subjectId, classId } }).then((res) => setBankQuestions(res.data));
  }, [examId, subjectId, classId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await api.post("/exams", {
        subjectId,
        classId,
        title,
        duration,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        randomizeQuestions: true,
        randomizeOptions: true,
        lockdownRequired
      });
      setExamId(res.data._id);
      setStatus("Draft created. Now add questions below.");
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Couldn't create the exam.");
    }
  }

  async function handleAutoFill() {
    if (!examId) return;
    try {
      const res = await api.post(`/exams/${examId}/auto-fill`, {
        topics: topics ? topics.split(",").map((t) => t.trim()) : undefined,
        difficulty: "mixed",
        count: questionCount
      });
      const { addedCount, requestedCount, exam } = res.data;
      setAttachedIds(exam.questionIds || addedCount);
      if (addedCount < requestedCount) {
        setStatus(`Only found ${addedCount} of ${requestedCount} matching questions in the bank — added those.`);
      } else {
        setStatus(`Added ${addedCount} questions from the bank.`);
      }
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Auto-fill failed.");
    }
  }

  async function handleToggleQuestion(questionId: string) {
    if (!examId) return;
    try {
      if (attachedIds.includes(questionId)) {
        const res = await api.delete(`/exams/${examId}/questions/${questionId}`);
        setAttachedIds(res.data.questionIds || []);
      } else {
        const res = await api.post(`/exams/${examId}/questions`, { questionIds: [questionId] });
        setAttachedIds(res.data.questionIds || []);
      }
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Couldn't update the exam's questions.");
    }
  }

  async function handlePublish() {
    if (!examId) return;
    try {
      await api.post(`/exams/${examId}/publish`);
      setStatus("Exam published and scheduled.");
      navigate(rolePath("/exams"));
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Couldn't publish the exam.");
    }
  }

  if (loading) {
    return (
      <PageShell maxWidth={520}>
        <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}><Spinner />Loading exam…</p>
      </PageShell>
    );
  }

  if (visibleSubjects.length === 0 || classes.length === 0) {
    return (
      <PageShell maxWidth={520}>
        <h1>New exam</h1>
        <Card>
          <p style={{ marginBottom: 12 }}>
            {visibleSubjects.length === 0 && user?.role === "teacher"
              ? "You're not assigned to any subject yet. Ask your school admin to assign one to you."
              : "You need at least one class and one subject before creating an exam. Ask your school admin to add class and subject for you first."}
          </p>
          <Link to={rolePath("/setup")}>
            <PrimaryButton type="button">Go to Setup</PrimaryButton>
          </Link>
        </Card>
      </PageShell>
    );
  }

  const theoryQuestions = bankQuestions.filter((q) => q.type === "theory");
  const mcqQuestions = bankQuestions.filter((q) => q.type === "mcq");

  return (
    <PageShell maxWidth={560}>
      <h1>{existingExamId ? "Continue exam setup" : "New exam"}</h1>

      <Card style={{ marginBottom: 20 }}>
        <form onSubmit={handleCreate}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Subject</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: "100%" }} disabled={!!examId}>
                {visibleSubjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%" }} disabled={!!examId}>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Exam title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={!!examId} style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 120 }}>
              <label>Duration (mins)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={!!examId} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Start</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required disabled={!!examId} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>End</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required disabled={!!examId} style={{ width: "100%" }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={lockdownRequired}
                onChange={(e) => setLockdownRequired(e.target.checked)}
                disabled={!!examId}
              />
              Require lockdown mode (fullscreen enforced; exam ends automatically after repeated tab-switching or exiting fullscreen)
            </label>
          </div>

          {!examId && <PrimaryButton type="submit">Create draft</PrimaryButton>}
        </form>
      </Card>

      {examId && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <h3>Auto-fill (MCQ only)</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {attachedIds.length} question{attachedIds.length === 1 ? "" : "s"} attached so far.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label>Topics (comma separated, optional — leave blank to match any topic)</label>
              <input value={topics} onChange={(e) => setTopics(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ marginBottom: 14, width: 140 }}>
              <label>Number of questions</label>
              <input
                type="number"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <button onClick={handleAutoFill} type="button">Auto-fill from bank</button>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <h3>Add questions manually</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              Auto-fill only picks MCQ questions. Theory questions — or any specific MCQ you want to hand-pick —
              get added here instead.
            </p>

            {theoryQuestions.length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Theory</p>
                {theoryQuestions.map((q) => (
                  <label key={q._id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={attachedIds.includes(q._id)}
                      onChange={() => handleToggleQuestion(q._id)}
                    />
                    <span>
                      {q.questionText} <Badge tone="warning">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                    </span>
                  </label>
                ))}
              </>
            )}

            {mcqQuestions.length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 500, marginTop: 12, marginBottom: 6 }}>MCQ</p>
                {mcqQuestions.map((q) => (
                  <label key={q._id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={attachedIds.includes(q._id)}
                      onChange={() => handleToggleQuestion(q._id)}
                    />
                    <span>
                      {q.questionText} <Badge tone="success">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                    </span>
                  </label>
                ))}
              </>
            )}

            {bankQuestions.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No questions in the bank yet for this subject/class.</p>
            )}
          </Card>

          <PrimaryButton onClick={handlePublish} type="button" disabled={attachedIds.length === 0}>
            Publish exam
          </PrimaryButton>
        </>
      )}

      {status && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 12 }}>{status}</p>}
    </PageShell>
  );
}