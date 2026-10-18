import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Exam, Subject, ClassRoom } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import { useRolePath } from "../hooks/useRolePath";
import { useConfirm } from "../context/ConfirmContext";

function statusInfo(exam: Exam): { label: string; tone: "success" | "warning" | "neutral" } {
  const now = Date.now();
  const start = new Date(exam.startTime).getTime();
  const end = new Date(exam.endTime).getTime();

  if (exam.status === "scheduled" && now >= start && now <= end) return { label: "Live", tone: "success" };
  if (exam.status === "scheduled" && now < start) return { label: "Scheduled", tone: "warning" };
  if (exam.status === "closed") return { label: "Closed", tone: "neutral" };
  if (exam.status === "draft") return { label: "Draft", tone: "neutral" };
  return { label: exam.status, tone: "neutral" };
}

function idSuffix(id?: string) {
  return id ? id.slice(-6) : "—";
}

export default function ExamList() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { user } = useAuth();
  const rolePath = useRolePath();
  const confirm = useConfirm();
  const isStudent = user?.role === "student";
  const canManage = user?.role === "teacher";

  async function loadAll() {
    const examRes = await api.get("/exams");
    setExams(examRes.data);

    if (isStudent) return;

    const [classRes, subRes] = await Promise.all([api.get("/classes"), api.get("/subjects")]);
    setClasses(classRes.data);
    setSubjects(subRes.data);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    const ok = await confirm("Delete this draft? This can't be undone.");
    if (!ok) return;
    await api.delete(`/exams/${id}`);
    await loadAll();
  }

  const classById = Object.fromEntries(classes.map((c) => [c._id, c]));
  const subjectById = Object.fromEntries(subjects.map((s) => [s._id, s]));

  return (
    <PageShell maxWidth={640}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ marginBottom: 0 }}>{isStudent ? "My exams" : "Exams"}</h1>
        {canManage && (
          <Link to={rolePath("/exams/new")}>
            <PrimaryButton type="button">+ New exam</PrimaryButton>
          </Link>
        )}
      </div>

      {exams.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No exams yet.</p>}

      {exams.map((exam) => {
        const { label, tone } = statusInfo(exam);
        const isOpen = label === "Live";
        const isDraft = exam.status === "draft";
        const isClosed = exam.status === "closed";
        const cls = classById[exam.classId];
        const subj = subjectById[exam.subjectId];
        return (
          <Card key={exam._id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>{exam.title}</span>
              <Badge tone={tone}>{label}</Badge>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
              {exam.duration} mins · {new Date(exam.startTime).toLocaleString()} – {new Date(exam.endTime).toLocaleString()}
            </p>
            {!isStudent && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                {subj ? subj.name : "unknown subject"} · {cls ? `${cls.name} (id:${idSuffix(cls._id)})` : "unknown class"}
              </p>
            )}

            {isStudent && isOpen && (
              <Link to={rolePath(`/exams/${exam._id}/take`)}>
                <PrimaryButton type="button">Start exam</PrimaryButton>
              </Link>
            )}

            {isClosed && (
              <Link to={rolePath(`/results?examId=${exam._id}`)}>
                <button type="button">{isStudent ? "View my result" : "View results"}</button>
              </Link>
            )}

            {canManage && isDraft && (
              <div style={{ display: "flex", gap: 8 }}>
                <Link to={rolePath(`/exams/${exam._id}/edit`)}>
                  <button type="button">Continue setup</button>
                </Link>
                <button type="button" onClick={() => handleDelete(exam._id)}>Delete</button>
              </div>
            )}
          </Card>
        );
      })}
    </PageShell>
  );
}