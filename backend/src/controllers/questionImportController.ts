import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Question from "../models/Question";
import Subject from "../models/Subject";
import Class from "../models/Class";
import User from "../models/User";
import { logActivity } from "../utils/activity";
import { MAX_IMPORT_BATCH, ImportRow, ImportContext, ImportQuestion, checkRow, findDuplicates } from "../services/questionImport";

interface RowResult {
  rowNumber: number;
  question: string;
  subject?: string;
  className?: string;
  status: "created" | "skipped" | "error";
  reason?: string;
}

// POST /teacher/questions/import  { rows: ImportRow[], allowDuplicates?: boolean }
// Valid rows are saved; bad rows are reported and never block the good ones.
// Re-uploading the same file is safe: rows already saved come back as duplicates.
export async function importQuestions(req: AuthedRequest, res: Response) {
  const { rows, allowDuplicates } = req.body as { rows: ImportRow[]; allowDuplicates?: boolean };

  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No rows to import." });
  if (rows.length > MAX_IMPORT_BATCH) return res.status(400).json({ error: `Send at most ${MAX_IMPORT_BATCH} rows per request.` });

  const schoolId = req.user!.schoolId;
  const [subjects, classes, teacher] = await Promise.all([
    Subject.find({ schoolId }),
    Class.find({ schoolId }),
    User.findById(req.user!.userId).select("subjectIds")
  ]);

  const ctx: ImportContext = {
    subjects: new Map(subjects.map((s) => [s.name.trim().toLowerCase(), { id: s._id.toString(), name: s.name, classIds: s.classIds.map(String) }])),
    classes: new Map(classes.map((c) => [c.name.trim().toLowerCase(), { id: c._id.toString(), name: c.name }])),
    allowedSubjectIds: new Set((teacher?.subjectIds || []).map(String))
  };

  const results: RowResult[] = [];
  const valid: { result: RowResult; question: ImportQuestion }[] = [];

  rows.forEach((raw, i) => {
    const row = raw || {};
    const rowNumber = row.rowNumber ?? i + 1;
    const result: RowResult = { rowNumber, question: String(row.question ?? "").trim().slice(0, 120), status: "error" };
    results.push(result);
    const check = checkRow(row, ctx);
    if (!check.ok) { result.reason = check.reason; return; }
    result.subject = check.subjectName;
    result.className = check.className;
    valid.push({ result, question: check.question });
  });

  let toSave = valid;
  if (!allowDuplicates && valid.length > 0) {
    const existingDocs = await Question.find({
      schoolId,
      subjectId: { $in: [...new Set(valid.map((v) => v.question.subjectId))] },
      classId: { $in: [...new Set(valid.map((v) => v.question.classId))] }
    }).select("subjectId classId questionText").lean();

    const existing = new Map<string, string[]>();
    for (const d of existingDocs) {
      const k = `${d.subjectId}:${d.classId}`;
      existing.set(k, [...(existing.get(k) || []), d.questionText]);
    }

    const flags = findDuplicates(valid.map((v) => v.question), existing);
    toSave = [];
    valid.forEach((v, i) => {
      if (flags[i]) {
        v.result.status = "skipped";
        v.result.reason = flags[i] === "bank" ? "Already in the question bank." : "Repeats an earlier row in this file.";
      } else {
        toSave.push(v);
      }
    });
  }

  if (toSave.length > 0) {
    await Question.insertMany(
      toSave.map((v) => ({ ...v.question, schoolId, createdBy: req.user!.userId, source: "manual", reviewStatus: "approved" }))
    );
    toSave.forEach((v) => { v.result.status = "created"; });
    await logActivity(req, {
      action: "questions.import",
      summary: `Imported ${toSave.length} question(s) from a spreadsheet`,
      entityType: "question",
      meta: { created: toSave.length, rows: rows.length }
    });
  }

  res.json({
    results,
    summary: {
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length
    }
  });
}