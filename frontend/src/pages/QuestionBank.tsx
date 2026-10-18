import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Question, Subject, ClassRoom } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import { useRolePath } from "../hooks/useRolePath";

const emptyOptions = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false }
];

const difficultyTone: Record<string, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger"
};

export default function QuestionBank() {
  const { user } = useAuth();
  const canManage = user?.role === "teacher"; // admin gets read-only oversight here
  const rolePath = useRolePath();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"mcq" | "theory">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(emptyOptions);
  const [correctAnswerText, setCorrectAnswerText] = useState("");
  const [marks, setMarks] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // A teacher only ever sees/picks subjects they're actually assigned to.
  // Admin keeps full visibility, matching the existing oversight model.
  const visibleSubjects = user?.role === "teacher"
    ? subjects.filter((s) => user.subjectIds?.includes(s._id))
    : subjects;

  async function loadClasses() {
    const res = await api.get("/classes");
    setClasses(res.data);
  }

  async function loadSubjects() {
    const res = await api.get("/subjects");
    setSubjects(res.data);
  }

  async function loadQuestions() {
    const res = await api.get("/questions", { params: { subjectId: subjectId || undefined, classId: classId || undefined } });
    setQuestions(res.data);
  }

  useEffect(() => {
    loadSubjects();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the subject selection once visibleSubjects is actually known --
  // can't do this in loadSubjects() anymore since it needs user.subjectIds,
  // which isn't involved in that fetch.
  useEffect(() => {
    if (visibleSubjects.length > 0 && !subjectId) setSubjectId(visibleSubjects[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, user?.role]);

  const subject = visibleSubjects.find((s) => s._id === subjectId);
  const classOptions = classes.filter((c) => subject?.classIds.includes(c._id));

  useEffect(() => {
    setClassId(classOptions[0]?._id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, classes]);

  useEffect(() => {
    if (subjectId && classId) loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, classId]);

  function updateOptionText(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  }

  function setCorrectOption(index: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (type === "mcq" && options.some((o) => !o.text.trim())) {
      setError("Fill in all four options.");
      return;
    }
    if (type === "theory" && !questionText.trim()) {
      setError("Enter the question text.");
      return;
    }
    try {
      await api.post("/questions", {
        subjectId,
        classId,
        topic,
        type,
        difficulty,
        questionText,
        options: type === "mcq" ? options : undefined,
        correctAnswerText: type === "theory" ? correctAnswerText : undefined,
        marks
      });
      setQuestionText("");
      setOptions(emptyOptions);
      setCorrectAnswerText("");
      await loadQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't save the question.");
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/questions/${id}`);
    await loadQuestions();
  }

  if (visibleSubjects.length === 0) {
    return (
      <PageShell maxWidth={520}>
        <h1>Question bank</h1>
        <Card>
          <p style={{ marginBottom: 12 }}>
            {user?.role === "teacher"
              ? "You're not assigned to any subject yet. Ask your school admin to assign one to you."
              : "You need at least one subject before you can add questions. Ask your school admin to add subject for you first."}
          </p>
          <Link to={rolePath("/setup")}>
            <PrimaryButton type="button">Go to Setup</PrimaryButton>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={760}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Question bank</h1>
        {canManage && (
          <Link to={rolePath("/ai-questions")}>
            <PrimaryButton type="button">Generate with AI</PrimaryButton>
          </Link>
        )}
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h3>Filter</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label>Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: "100%" }}>
              {visibleSubjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%" }}>
              {classOptions.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {canManage && (
        <Card style={{ marginBottom: 24 }}>
          <h3>Add a question</h3>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 120 }}>
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as "mcq" | "theory")} style={{ width: "100%" }}>
                <option value="mcq">MCQ</option>
                <option value="theory">Theory</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} required style={{ width: "100%" }} />
            </div>
            <div style={{ width: 110 }}>
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} style={{ width: "100%" }}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div style={{ width: 70 }}>
              <label>Marks</label>
              <input type="number" min={1} value={marks} onChange={(e) => setMarks(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Question</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
              style={{ width: "100%", minHeight: 64 }}
            />
          </div>

          {type === "mcq" ? (
            <>
              <label style={{ marginBottom: 6 }}>Options — select the correct one</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => setCorrectOption(i)} />
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={opt.text}
                    onChange={(e) => updateOptionText(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
            </>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label>Model answer (optional — for your own reference while grading; students never see this)</label>
              <textarea
                value={correctAnswerText}
                onChange={(e) => setCorrectAnswerText(e.target.value)}
                style={{ width: "100%", minHeight: 48 }}
              />
            </div>
          )}

          {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginTop: 4 }}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <PrimaryButton type="submit" style={{ marginTop: 8 }}>Save question</PrimaryButton>
          </form>
        </Card>
      )}

      <h3>Bank ({questions.length})</h3>
      {questions.length === 0 && (
        <p style={{ color: "var(--text-secondary)" }}>
          {canManage
            ? "No questions yet for this subject. Add your first one above."
            : "No questions yet for this subject."}
        </p>
      )}
      {questions.map((q) => (
        <Card key={q._id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p style={{ fontWeight: 500, marginBottom: 6 }}>{q.questionText}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={q.type === "theory" ? "warning" : "success"}>{q.type}</Badge>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{q.topic}</span>
                <Badge tone={difficultyTone[q.difficulty]}>{q.difficulty}</Badge>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
              </div>
            </div>
            {canManage && <button onClick={() => handleDelete(q._id)}>Delete</button>}
          </div>
        </Card>
      ))}
    </PageShell>
  );
}