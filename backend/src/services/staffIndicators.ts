import { Trend, MIN_EXAMS, mean } from "./analytics";

// Teacher INDICATORS, not a score and not a ranking. They use only things a teacher controls
// (setting exams, marking promptly, running their classes' exams) and show class results as
// context with a warning, because results depend on the class and the paper as much as the teacher.

const DAY = 24 * 60 * 60 * 1000;
export const SLOW_MARKING_DAYS = 7;
export const FAST_MARKING_DAYS = 2;
export const MIN_GRADED_PAPERS = 5;
export const LOW_PARTICIPATION = 60;
export const HIGH_PARTICIPATION = 90;

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

// One paper that needed theory marking: waiting (gradedAt null) or marked.
export interface PaperSample { submittedAt: Date; gradedAt: Date | null }

export function gradingStats(papers: PaperSample[], now = Date.now()) {
  const done = papers.filter((p) => p.gradedAt).map((p) => Math.max(0, (+p.gradedAt! - +p.submittedAt) / DAY));
  const waiting = papers.filter((p) => !p.gradedAt).map((p) => Math.max(0, (now - +p.submittedAt) / DAY));
  return {
    markedCount: done.length,
    medianDays: median(done) === null ? null : round1(median(done) as number),
    waiting: waiting.length,
    oldestWaitingDays: waiting.length ? Math.floor(Math.max(...waiting)) : null
  };
}

export interface ClassTrend { className: string; subjectName: string; exams: number; trend: Trend }
export type Level = "attention" | "watch" | "good" | "info";
export interface Signal { level: Level; text: string }

export function buildSignals(i: {
  hasSubjects: boolean;
  periodDays: number;
  examsSet: number;
  participation: number | null;   // average % of the class who sat this teacher's exams
  participationExams: number;
  grading: ReturnType<typeof gradingStats>;
  classes: ClassTrend[];
  remarks: { released: number; students: number };
}): Signal[] {
  const out: Signal[] = [];

  if (i.hasSubjects && i.examsSet === 0) out.push({ level: "attention", text: `No exams set in the last ${i.periodDays} days.` });

  const g = i.grading;
  if (g.waiting > 0 && g.oldestWaitingDays !== null && g.oldestWaitingDays >= SLOW_MARKING_DAYS) {
    out.push({ level: "attention", text: `${g.waiting} paper${g.waiting === 1 ? " is" : "s are"} waiting for theory marking; the oldest has waited ${g.oldestWaitingDays} days.` });
  }
  if (g.medianDays !== null && g.markedCount >= MIN_GRADED_PAPERS) {
    if (g.medianDays >= SLOW_MARKING_DAYS) out.push({ level: "attention", text: `Theory papers take about ${g.medianDays} days to mark.` });
    else if (g.medianDays <= FAST_MARKING_DAYS) out.push({ level: "good", text: `Theory papers are marked quickly, about ${g.medianDays} day${g.medianDays === 1 ? "" : "s"}.` });
  }

  if (i.participation !== null && i.participationExams >= MIN_EXAMS) {
    if (i.participation < LOW_PARTICIPATION) out.push({ level: "watch", text: `Only ${i.participation}% of students took this teacher's exams. Worth checking scheduling and notices before drawing conclusions.` });
    else if (i.participation >= HIGH_PARTICIPATION) out.push({ level: "good", text: `${i.participation}% of students took this teacher's exams.` });
  }

  for (const c of i.classes) {
    if (c.exams < MIN_EXAMS) continue;
    if (c.trend === "down") out.push({ level: "watch", text: `${c.className} ${c.subjectName}: results have fallen across ${c.exams} exams. Check the paper's difficulty and the class before drawing conclusions.` });
    if (c.trend === "up") out.push({ level: "good", text: `${c.className} ${c.subjectName}: results have risen across ${c.exams} exams.` });
  }

  if (i.remarks.students > 0) out.push({ level: "info", text: `Remarks released for ${i.remarks.released} of ${i.remarks.students} students.` });
  return out;
}

export { mean };
