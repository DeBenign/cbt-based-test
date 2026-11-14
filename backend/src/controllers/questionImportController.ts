import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Question from "../models/Question";
import Subject from "../models/Subject";
import Class from "../models/Class";
import { logActivity } from "../utils/activity";
import { loadTeacherScope } from "../utils/teacherScope";
import {
  MAX_IMPORT_BATCH, MAX_CHECK_BATCH, ImportRow, ImportContext, ImportQuestion, checkRow, findDuplicates
} from "../services/questionImport";

interface RowResult {
  rowNumber: number;
  question: string;
  subject?: string;
  className?: string;
  subjectId?: string;
  classId?: string;
  // ready = passed every check (check mode); created = saved (import mode)
  status: "ready" | "created" | "skipped" | "error";
  reason?: string;
}

// POST /teacher/questions/import
//   { rows, dryRun?, targetSubjectId?, targetClassId?, allowDuplicates? }
// dryRun:true  -> vets every row (rules, permissions, duplicates against the bank and the file) and saves NOTHING.
// dryRun:false -> saves the rows that pass. Duplicates of anything already in the bank are skipped.
// Bad rows are reported and never block the good ones; re-sending a file is safe.
export async function importQuestions(req: AuthedRequest, res: Response) {
  const { rows, dryRun, allowDuplicates, targetSubjectId, targetClassId } = req.body as {
    rows: ImportRow[]; dryRun?: boolean; allowDuplicates?: boolean; targetSubjectId?: string; targetClassId?: string;
  };

  const limit = dryRun ? MAX_CHECK_BATCH : MAX_IMPORT_BATCH;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No rows to import." });
  if (rows.length > limit) return res.status(400).json({ error: `Send at most ${limit} rows per request.` });

  const schoolId = req.user!.schoolId;
  const [subjects, classes, scope] = await Promise.all([
    Subject.find({ schoolId }).lean(),
    Class.find({ schoolId }).lean(),
    loadTeacherScope(req.user!.userId)
  ]);

  const subjectList = subjects.map((s) => ({ id: String(s._id), name: s.name, classIds: (s.classIds || []).map(String) }));
  const classList = classes.map((c) => ({ id: String(c._id), name: c.name }));

  const ctx: ImportContext = {
    subjects: new Map(subjectList.map((s) => [s.name.trim().toLowerCase(), s])),
    classes: new Map(classList.map((c) => [c.name.trim().toLowerCase(), c])),
    allowedSubjectIds: new Set(scope.subjectIds),
    allowedClassIds: new Set(scope.classIds)
  };

  if (targetSubjectId || targetClassId) {
    const s = subjectList.find((x) => x.id === targetSubjectId);
    const c = classList.find((x) => x.id === targetClassId);
    if ((targetSubjectId && !s) || (targetClassId && !c)) return res.status(400).json({ error: "The subject or class you chose doesn't exist." });
    ctx.target = { subjectId: s?.id, subjectName: s?.name, classId: c?.id, className: c?.name };
  }

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
    result.subjectId = check.question.subjectId;
    result.classId = check.question.classId;
    valid.push({ result, question: check.question });
  });

  // Duplicates: anything already in the bank for the same subject + class (drafts included),
  // and any row that repeats an earlier row in this file.
  let passing = valid;
  if (!allowDuplicates && valid.length > 0) {
    const existingDocs = await Question.find({
      schoolId,
      subjectId: { $in: [...new Set(valid.map((v) => v.question.subjectId))] },
      classId: { $in: [...new Set(valid.map((v) => v.question.classId))] }
    }).select("subjectId classId questionText").lean();

    const existing = new Map<string, string[]>();
    for (const d of existingDocs) {
      const k = `${d.subjectId}:${d.classId}`;
      const list = existing.get(k);
      if (list) list.push(d.questionText); else existing.set(k, [d.questionText]);
    }

    const flags = findDuplicates(valid.map((v) => v.question), existing);
    passing = [];
    valid.forEach((v, i) => {
      const f = flags[i];
      if (f) {
        const preview = f.match.length > 70 ? f.match.slice(0, 70) + "…" : f.match;
        v.result.status = "skipped";
        v.result.reason = f.kind === "bank"
          ? `Already in the question bank: "${preview}"`
          : `Repeats an earlier row in this file: "${preview}"`;
      } else {
        passing.push(v);
      }
    });
  }

  if (dryRun) {
    passing.forEach((v) => { v.result.status = "ready"; });
  } else if (passing.length > 0) {
    await Question.insertMany(
      passing.map((v) => ({ ...v.question, schoolId, createdBy: req.user!.userId, source: "manual", reviewStatus: "approved" }))
    );
    passing.forEach((v) => { v.result.status = "created"; });
    await logActivity(req, {
      action: "questions.import",
      summary: `Imported ${passing.length} question(s) from a spreadsheet`,
      entityType: "question",
      meta: { created: passing.length, rows: rows.length }
    });
  }

  res.json({
    dryRun: !!dryRun,
    results,
    summary: {
      ready: results.filter((r) => r.status === "ready").length,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length
    }
  });
}
