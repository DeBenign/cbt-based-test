// Rules for importing questions from a spreadsheet (CSV/XLSX).
// Pure functions: no database, easy to test. The controller feeds them the
// school's subjects/classes and the teacher's allowed subjects.

import { DedupeIndex } from "./questionDedupe";

// Saving is done in small groups so one request stays quick on a serverless function.
export const MAX_IMPORT_BATCH = 50;
// Checking (nothing is saved) can take a whole sheet at once, so repeats inside the file are caught.
export const MAX_CHECK_BATCH = 500;
export const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

export interface ImportRow {
  rowNumber?: number;
  subject?: string;
  class?: string;
  topic?: string;
  type?: string;
  difficulty?: string;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  correct?: string;
  answer?: string;
  marks?: string | number;
}

export interface ImportContext {
  subjects: Map<string, { id: string; name: string; classIds: string[] }>; // key: lower-case name
  classes: Map<string, { id: string; name: string }>; // key: lower-case name
  allowedSubjectIds: Set<string> | null; // null = no restriction
  allowedClassIds: Set<string> | null; // null = no restriction (teachers only teach the classes assigned to them)
  // What the teacher chose on the import screen. Blank subject/class cells inherit it,
  // and a row that names a different one is flagged instead of landing in the wrong place.
  target?: { subjectId?: string; subjectName?: string; classId?: string; className?: string };
}

export interface ImportQuestion {
  subjectId: string;
  classId: string;
  topic: string;
  type: "mcq" | "theory";
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  correctAnswerText?: string;
  marks: number;
}

export type RowCheck = { ok: true; question: ImportQuestion; subjectName: string; className: string } | { ok: false; reason: string };

const clean = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const key = (v: unknown) => clean(v).toLowerCase();

export function parseType(raw: string, hasOptions: boolean): "mcq" | "theory" | null {
  const t = raw.toLowerCase();
  if (!t) return hasOptions ? "mcq" : "theory";
  if (["mcq", "objective", "multiple choice", "multiple-choice", "obj"].includes(t)) return "mcq";
  if (["theory", "essay", "subjective", "written"].includes(t)) return "theory";
  return null;
}

export function parseDifficulty(raw: string): "easy" | "medium" | "hard" | null {
  const d = raw.toLowerCase();
  if (!d) return "medium";
  if (d === "easy" || d === "medium" || d === "hard") return d;
  return null;
}

export function parseMarks(raw: string, fallback: number): number | null {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

// Resolves the "correct" cell to an option index: a letter (A-E) or the option's own text.
export function resolveCorrect(raw: string, options: { letter: string; text: string }[]): number | { error: string } {
  if (!raw) return { error: "Correct answer is missing (use A, B, C, D or the answer text)." };
  const letter = raw.trim().toUpperCase().replace(/[.)]$/, "");
  if (/^[A-E]$/.test(letter)) {
    const idx = options.findIndex((o) => o.letter === letter);
    return idx >= 0 ? idx : { error: `Correct answer is ${letter} but option ${letter} is empty.` };
  }
  const idx = options.findIndex((o) => key(o.text) === key(raw));
  return idx >= 0 ? idx : { error: `Correct answer "${raw}" doesn't match any option. Use A, B, C, D or the exact option text.` };
}

export function checkRow(row: ImportRow, ctx: ImportContext): RowCheck {
  const questionText = clean(row.question);
  if (!questionText) return { ok: false, reason: "Question text is missing." };

  const subjectName = clean(row.subject) || ctx.target?.subjectName || "";
  if (!subjectName) return { ok: false, reason: "Subject is missing." };
  const subject = ctx.subjects.get(key(subjectName));
  if (!subject) return { ok: false, reason: `Subject "${subjectName}" doesn't exist. Ask the admin to create it in Setup.` };
  if (ctx.allowedSubjectIds && !ctx.allowedSubjectIds.has(subject.id)) {
    return { ok: false, reason: `You're not assigned to ${subject.name}.` };
  }
  if (ctx.target?.subjectId && subject.id !== ctx.target.subjectId) {
    return { ok: false, reason: `This row is for ${subject.name}, but you're importing into ${ctx.target.subjectName}.` };
  }

  const className = clean(row.class) || ctx.target?.className || "";
  if (!className) return { ok: false, reason: "Class is missing." };
  const cls = ctx.classes.get(key(className));
  if (!cls) return { ok: false, reason: `Class "${className}" doesn't exist. It must match a class in Setup exactly.` };
  if (ctx.allowedClassIds && !ctx.allowedClassIds.has(cls.id)) {
    return { ok: false, reason: `You're not assigned to ${cls.name}. Ask your school admin to add it to your classes.` };
  }
  if (ctx.target?.classId && cls.id !== ctx.target.classId) {
    return { ok: false, reason: `This row is for ${cls.name}, but you're importing into ${ctx.target.className}. Fix the class in the file, or pick ${cls.name} above.` };
  }
  if (!subject.classIds.includes(cls.id)) {
    return { ok: false, reason: `${subject.name} isn't linked to ${cls.name} in Setup.` };
  }

  const optionCells = [row.optionA, row.optionB, row.optionC, row.optionD, row.optionE].map(clean);
  const options = OPTION_LETTERS.map((letter, i) => ({ letter: letter as string, text: optionCells[i] })).filter((o) => o.text);

  const type = parseType(clean(row.type), options.length > 0);
  if (!type) return { ok: false, reason: `Type must be "mcq" or "theory" (got "${clean(row.type)}").` };

  const difficulty = parseDifficulty(clean(row.difficulty));
  if (!difficulty) return { ok: false, reason: `Difficulty must be easy, medium or hard (got "${clean(row.difficulty)}").` };

  const marks = parseMarks(clean(row.marks), type === "theory" ? 5 : 1);
  if (marks === null) return { ok: false, reason: `Marks must be a number between 1 and 100 (got "${clean(row.marks)}").` };

  const topic = clean(row.topic) || "General";
  const base = { subjectId: subject.id, classId: cls.id, topic, difficulty, questionText, marks };

  if (type === "theory") {
    const answer = clean(row.answer);
    return {
      ok: true,
      subjectName: subject.name,
      className: cls.name,
      question: { ...base, type, options: [], correctAnswerText: answer || undefined }
    };
  }

  if (options.length < 2) return { ok: false, reason: "An MCQ needs at least two options (Option A to Option E)." };
  const texts = options.map((o) => key(o.text));
  if (new Set(texts).size !== texts.length) return { ok: false, reason: "Two options have the same text." };

  const correctIdx = resolveCorrect(clean(row.correct), options);
  if (typeof correctIdx !== "number") return { ok: false, reason: correctIdx.error };

  return {
    ok: true,
    subjectName: subject.name,
    className: cls.name,
    question: {
      ...base,
      type,
      options: options.map((o, i) => ({ text: o.text, isCorrect: i === correctIdx }))
    }
  };
}

export type DuplicateFlag = null | { kind: "bank" | "file"; match: string };

// Flags rows that repeat the bank or an earlier row in the same file.
// `existing` maps "subjectId:classId" to the question texts already in the bank.
export function findDuplicates(
  items: { subjectId: string; classId: string; questionText: string }[],
  existing: Map<string, string[]>
): DuplicateFlag[] {
  const bank = new Map<string, DedupeIndex>();
  const file = new Map<string, DedupeIndex>();
  return items.map((item) => {
    const k = `${item.subjectId}:${item.classId}`;
    if (!bank.has(k)) bank.set(k, new DedupeIndex(existing.get(k) || []));
    if (!file.has(k)) file.set(k, new DedupeIndex());
    const inBank = bank.get(k)!.find(item.questionText);
    if (inBank) return { kind: "bank", match: inBank };
    const inFile = file.get(k)!.find(item.questionText);
    if (inFile) return { kind: "file", match: inFile };
    file.get(k)!.add(item.questionText);
    return null;
  });
}
