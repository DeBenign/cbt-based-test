// Performance maths for charts and "needs attention / doing well" lists.
// Pure functions only (no database), so every rule here is covered by tests.
//
// Fairness rules built in:
//  * "average" is the mean of exams a student actually SAT. Missing an exam is shown separately as
//    participation, so absences never masquerade as low ability (or as a bad teacher).
//  * Nothing is judged on thin data: trend and pass-mark flags need MIN_EXAMS results.
//  * Class numbers are hidden from students unless enough classmates sat the exam (MIN_CLASS_SAMPLE).

export const PASS_MARK = 50;
export const GOOD_MARK = 75;
export const MIN_EXAMS = 3;
export const MIN_CLASS_SAMPLE = 3;     // fewest attempts before a class average is shown to a student
export const MIN_QUESTION_ANSWERS = 5; // fewest answers before a question is called "most missed"
export const MIN_TOPIC_QUESTIONS = 3;  // fewest questions before a topic is called strong or weak
const DROP_POINTS = 15;
const IMPROVE_POINTS = 10;
const MISSED_SHARE = 0.4;

const round1 = (n: number) => Math.round(n * 10) / 10;
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const pct = (score: number, total: number) => (total > 0 ? round1((score / total) * 100) : 0);

// One exam for one student, oldest first. pct is null when they did not sit it
// (or the paper is still waiting for theory marking, so the number would be incomplete).
export interface ExamPoint { pct: number | null; sat: boolean }

export type Flag = "attention" | "doing_well" | "improving" | null;
export type Trend = "up" | "down" | "flat" | null;

export interface StudentSummary {
  exams: number;            // exams held for the class
  sat: number;              // exams the student sat
  participation: number;    // 0-100
  average: number | null;   // mean % of exams sat and fully marked
  averageWithAbsent: number | null; // absences counted as 0
  last: number | null;
  trend: Trend;
  flag: Flag;
  reasons: string[];
  enoughData: boolean;
}

// First half versus second half of the scored exams.
export function trendOf(values: number[]): Trend {
  if (values.length < MIN_EXAMS) return null;
  const half = Math.floor(values.length / 2);
  const diff = mean(values.slice(values.length - half)) - mean(values.slice(0, half));
  return diff >= IMPROVE_POINTS ? "up" : diff <= -IMPROVE_POINTS ? "down" : "flat";
}

export function summariseStudent(points: ExamPoint[]): StudentSummary {
  const exams = points.length;
  const sat = points.filter((p) => p.sat).length;
  const scored = points.filter((p) => p.pct !== null).map((p) => p.pct as number);
  const participation = exams ? Math.round((sat / exams) * 100) : 0;
  const average = scored.length ? round1(mean(scored)) : null;
  const averageWithAbsent = exams ? round1(mean(points.map((p) => (p.sat && p.pct !== null ? p.pct : 0)))) : null;
  const trend = trendOf(scored);
  const last = scored.length ? scored[scored.length - 1] : null;

  const reasons: string[] = [];
  if (exams >= MIN_EXAMS && (exams - sat) / exams >= MISSED_SHARE) {
    reasons.push(`Missed ${exams - sat} of ${exams} exams`);
  }
  if (scored.length >= MIN_EXAMS && average !== null && average < PASS_MARK) {
    reasons.push(`Average of ${average}% is below the ${PASS_MARK}% pass mark`);
  }
  if (scored.length >= MIN_EXAMS && last !== null) {
    const earlier = mean(scored.slice(0, -1));
    if (last <= earlier - DROP_POINTS) reasons.push(`Latest score (${last}%) is ${Math.round(earlier - last)} points below their earlier average`);
  }

  let flag: Flag = null;
  if (reasons.length) flag = "attention";
  else if (scored.length >= MIN_EXAMS && average !== null && average >= GOOD_MARK && participation >= 80) flag = "doing_well";
  else if (trend === "up") flag = "improving";

  return { exams, sat, participation, average, averageWithAbsent, last, trend, flag, reasons, enoughData: scored.length >= MIN_EXAMS };
}

// 10 bins of width 10: 0-9, 10-19 ... 90-100.
export function histogram(values: number[]): { label: string; count: number }[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({ label: i === 9 ? "90-100" : `${i * 10}-${i * 10 + 9}`, count: 0 }));
  for (const v of values) bins[Math.min(9, Math.max(0, Math.floor(v / 10)))].count++;
  return bins;
}

// ---- questions and topics --------------------------------------------------------------

export interface QuestionTally { questionId: string; text: string; topic: string; answers: number; earned: number; possible: number }

export function mostMissed(tallies: QuestionTally[], limit = 5) {
  return tallies
    .filter((t) => t.answers >= MIN_QUESTION_ANSWERS && t.possible > 0)
    .map((t) => ({ questionId: t.questionId, text: t.text, topic: t.topic, answers: t.answers, percentCorrect: Math.round((t.earned / t.possible) * 100) }))
    .sort((a, b) => a.percentCorrect - b.percentCorrect)
    .slice(0, limit);
}

export interface TopicTally { topic: string; earned: number; possible: number; questions: number }

export function topicAccuracy(tallies: TopicTally[]) {
  const by = new Map<string, TopicTally>();
  for (const t of tallies) {
    const cur = by.get(t.topic) ?? { topic: t.topic, earned: 0, possible: 0, questions: 0 };
    cur.earned += t.earned; cur.possible += t.possible; cur.questions += t.questions;
    by.set(t.topic, cur);
  }
  return [...by.values()]
    .filter((t) => t.questions >= MIN_TOPIC_QUESTIONS && t.possible > 0)
    .map((t) => ({ topic: t.topic, questions: t.questions, percentCorrect: Math.round((t.earned / t.possible) * 100) }))
    .sort((a, b) => a.percentCorrect - b.percentCorrect);
}

// Class-level direction, from the per-exam averages (oldest first).
export const classTrend = (examAverages: number[]): Trend => trendOf(examAverages);
