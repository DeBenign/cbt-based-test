// Turns "who attempted" into "who was supposed to sit this exam".
// Students in the exam's class who never started it appear as ABSENT with a score of 0.

export interface AttemptLite {
  studentId: string;
  studentName: string;
  email?: string;
  score?: number | null;
  status: "submitted" | "auto-submitted" | "flagged";
  submittedAt?: Date | null;
  needsGrading?: boolean;
  flaggedEvents?: { type: string; timestamp: number }[];
}
export interface StudentLite { id: string; name: string; email?: string }

export interface RosterRow {
  studentId: string;
  studentName: string;
  email: string;
  score: number;
  totalMarks: number;
  status: AttemptLite["status"] | "absent";
  submittedAt: Date | null;
  needsGrading: boolean;
  flagCount: number;
  flaggedEvents: { type: string; timestamp: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildRoster(attempts: AttemptLite[], classStudents: StudentLite[], totalMarks: number) {
  const seen = new Set(attempts.map((a) => a.studentId));

  const attempted: RosterRow[] = attempts.map((a) => ({
    studentId: a.studentId,
    studentName: a.studentName,
    email: a.email || "",
    score: a.score ?? 0,
    totalMarks,
    status: a.status,
    submittedAt: a.submittedAt ?? null,
    needsGrading: !!a.needsGrading,
    flagCount: a.flaggedEvents?.length ?? 0,
    flaggedEvents: a.flaggedEvents ?? []
  }));

  const absent: RosterRow[] = classStudents
    .filter((s) => !seen.has(s.id))
    .map((s) => ({
      studentId: s.id, studentName: s.name, email: s.email || "", score: 0, totalMarks,
      status: "absent" as const, submittedAt: null, needsGrading: false, flagCount: 0, flaggedEvents: []
    }));

  // Highest score first; ties by name; students who sat the exam always above those who didn't.
  attempted.sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName));
  absent.sort((a, b) => a.studentName.localeCompare(b.studentName));
  const rows = [...attempted, ...absent];

  const sum = (r: RosterRow[]) => r.reduce((t, x) => t + x.score, 0);
  return {
    rows,
    classSize: rows.length,
    submittedCount: attempted.length,
    absentCount: absent.length,
    // Everyone in the class counts, absentees as 0 ...
    classAverage: rows.length ? round2(sum(rows) / rows.length) : 0,
    // ... and this one is only those who sat it, so a teacher can see both.
    attemptedAverage: attempted.length ? round2(sum(attempted) / attempted.length) : 0
  };
}
