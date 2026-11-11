import { Flag, Trend, PASS_MARK, GOOD_MARK } from "./analytics";

// The numbers a remark is written from. Kept with the remark so anyone can see what it was based on.
export interface RemarkFacts {
  average: number | null;
  classAverage: number | null;
  participation: number;
  exams: number;
  sat: number;
  trend: Trend;
  flag: Flag;
  enoughData: boolean;
  weakTopics: string[];
  strongTopics: string[];
  strongestSubject?: string | null;
  weakestSubject?: string | null;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function shared(f: RemarkFacts, first: string): string[] {
  const out: string[] = [];
  if (f.classAverage !== null && f.average !== null) {
    const d = f.average - f.classAverage;
    out.push(d >= 5 ? `This is above the class average of ${f.classAverage}%.` : d <= -5 ? `This is below the class average of ${f.classAverage}%.` : `This is in line with the class average of ${f.classAverage}%.`);
  }
  if (f.trend === "up") out.push("Recent scores have been rising.");
  if (f.trend === "down") out.push("Recent scores have been falling.");
  if (f.exams > 0 && f.participation < 80) out.push(`${first} missed ${f.exams - f.sat} of ${f.exams} exams, and taking every exam matters.`);
  return out;
}

// Honest, specific and kind: every sentence comes from a number, nothing is invented.
export function buildSubjectRemark(f: RemarkFacts, subject: string, first: string): string {
  if (f.sat === 0) return `${first} has not taken any ${subject} exam yet, so there is nothing to review.`;
  if (!f.enoughData || f.average === null) {
    return `${first} has taken ${plural(f.sat, "exam")} of ${f.exams} so far in ${subject}, which is too few for a fair review. ${f.sat < f.exams ? "Taking every exam will give a clearer picture." : "A clearer picture will come with more exams."}`;
  }
  const band = f.average >= GOOD_MARK ? `${first} is doing well in ${subject}, averaging ${f.average}%.`
    : f.average >= PASS_MARK ? `${first} is passing ${subject}, averaging ${f.average}%.`
    : `${first} is currently below the pass mark in ${subject}, averaging ${f.average}%.`;
  const parts = [band, ...shared(f, first)];
  if (f.weakTopics.length) parts.push(`Needs more practice in ${list(f.weakTopics)}.`);
  if (f.strongTopics.length) parts.push(`Strong in ${list(f.strongTopics)}.`);
  if (f.flag === "attention") parts.push("Extra support is recommended. Please speak with the subject teacher.");
  else if (f.flag === "doing_well") parts.push("Keep up the good work.");
  else if (f.flag === "improving") parts.push("Good improvement. Keep going.");
  return parts.join(" ");
}

export function buildOverallRemark(f: RemarkFacts, first: string): string {
  if (f.sat === 0) return `${first} has not taken any exam yet, so there is nothing to review.`;
  if (!f.enoughData || f.average === null) {
    return `${first} has taken ${plural(f.sat, "exam")} of ${f.exams} so far, which is too few for a fair overall review. A clearer picture will come with more exams.`;
  }
  const band = f.average >= GOOD_MARK ? `${first} is doing well overall, averaging ${f.average}% across subjects.`
    : f.average >= PASS_MARK ? `${first} is passing overall, averaging ${f.average}% across subjects.`
    : `${first} is currently below the pass mark overall, averaging ${f.average}% across subjects.`;
  const parts = [band, ...shared(f, first)];
  if (f.strongestSubject && f.weakestSubject && f.strongestSubject !== f.weakestSubject) parts.push(`Strongest in ${f.strongestSubject}; needs the most work in ${f.weakestSubject}.`);
  if (f.flag === "attention") parts.push("We would like to work with the family to support improvement.");
  else if (f.flag === "doing_well") parts.push("A pleasing result. Well done.");
  else if (f.flag === "improving") parts.push("A good upward trend. Well done.");
  return parts.join(" ");
}
