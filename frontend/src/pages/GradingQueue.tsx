import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PageShell from "../components/PageShell";

interface AnswerToGrade {
  questionId: string;
  questionText: string;
  modelAnswer: string | null;
  maxMarks: number;
  answerText: string | null;
  marksAwarded: number | null;
}

interface StudentGrading {
  attemptId: string;
  studentId: string;
  studentName: string;
  needsGrading: boolean;
  answers: AnswerToGrade[];
}

export default function GradingQueue() {
  const { examId } = useParams();
  const [examTitle, setExamTitle] = useState("");
  const [hasTheoryQuestions, setHasTheoryQuestions] = useState(true);
  const [students, setStudents] = useState<StudentGrading[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get(`/grading/exams/${examId}`);
    setExamTitle(res.data.examTitle);
    setHasTheoryQuestions(res.data.hasTheoryQuestions);
    setStudents(res.data.students);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  function draftKey(attemptId: string, questionId: string) {
    return `${attemptId}:${questionId}`;
  }

  async function handleSave(attemptId: string, questionId: string, maxMarks: number) {
    const key = draftKey(attemptId, questionId);
    const raw = drafts[key];
    const marksAwarded = Number(raw);
    if (raw === undefined || Number.isNaN(marksAwarded) || marksAwarded < 0 || marksAwarded > maxMarks) {
      setError(`Marks must be a number between 0 and ${maxMarks}.`);
      return;
    }
    setError(null);
    setSavingKey(key);
    try {
      await api.post(`/grading/attempts/${attemptId}/questions/${questionId}`, { marksAwarded });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't save the grade.");
    } finally {
      setSavingKey(null);
    }
  }

  if (!hasTheoryQuestions) {
    return (
      <PageShell maxWidth={560}>
        <h1>{examTitle || "Grading"}</h1>
        <p style={{ color: "var(--text-secondary)" }}>This exam has no theory questions — nothing to grade here.</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={720}>
      <h1>{examTitle} — grading</h1>
      {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {students.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No submissions yet.</p>}

      {students.map((s) => (
        <Card key={s.attemptId} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontWeight: 500, marginBottom: 0 }}>{s.studentName}</p>
            {s.needsGrading ? <Badge tone="warning">needs grading</Badge> : <Badge tone="success">graded</Badge>}
          </div>

          {s.answers.map((a) => {
            const key = draftKey(s.attemptId, a.questionId);
            const alreadyGraded = typeof a.marksAwarded === "number";
            return (
              <div key={a.questionId} style={{ paddingTop: 10, borderTop: "0.5px solid var(--border)", marginTop: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{a.questionText}</p>
                {a.modelAnswer && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                    Model answer: {a.modelAnswer}
                  </p>
                )}
                <p style={{ fontSize: 13, background: "var(--surface-2)", padding: 8, borderRadius: "var(--radius)", marginBottom: 8 }}>
                  {a.answerText || <em style={{ color: "var(--text-muted)" }}>No answer submitted</em>}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min={0}
                    max={a.maxMarks}
                    placeholder={alreadyGraded ? String(a.marksAwarded) : "0"}
                    value={drafts[key] ?? (alreadyGraded ? String(a.marksAwarded) : "")}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: 70 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>/ {a.maxMarks}</span>
                  <button
                    type="button"
                    onClick={() => handleSave(s.attemptId, a.questionId, a.maxMarks)}
                    disabled={savingKey === key}
                  >
                    {savingKey === key ? "Saving…" : alreadyGraded ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </PageShell>
  );
}