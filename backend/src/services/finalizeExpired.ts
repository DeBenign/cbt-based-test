import { Types } from "mongoose";
import ExamAttempt from "../models/ExamAttempt";
import Exam from "../models/Exam";
import AuditLog from "../models/AuditLog";
import { gradeAttempt } from "./gradeAttempt";

// An attempt is "abandoned" when it is still in-progress after its own deadline
// (student closed the browser, lost power). The grace period keeps the sweep
// from racing a student's final autosave/submit right at the deadline.
export const SWEEP_GRACE_MS = 2 * 60 * 1000;

// Finalizes ONE attempt if (and only if) it is still in progress and past its
// deadline. The conditional update is atomic, so a sweep and a student's own
// submit can never both finalize the same attempt.
export async function finalizeIfExpired(attemptId: Types.ObjectId | string, graceMs = 0, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - graceMs);
  const current = await ExamAttempt.findOne({ _id: attemptId, status: "in-progress", serverEndTime: { $lt: cutoff } }).select("serverEndTime");
  if (!current) return false;

  const claimed = await ExamAttempt.findOneAndUpdate(
    { _id: attemptId, status: "in-progress", serverEndTime: { $lt: cutoff } },
    { $set: { status: "auto-submitted", submittedAt: current.serverEndTime } },
    { new: true }
  );
  if (!claimed) return false;
  await gradeAttempt(claimed);
  return true;
}

export interface SweepResult {
  finalized: number;
  timedOut: boolean; // true if the time budget ran out before every attempt was handled
}

// Sweeps abandoned attempts, optionally limited to some exams (used lazily
// when results are opened) or across the whole platform (used by the daily cron).
export async function finalizeExpiredAttempts(opts: {
  examIds?: (Types.ObjectId | string)[];
  budgetMs?: number;
  now?: Date;
} = {}): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 40_000;
  const cutoff = new Date(now.getTime() - SWEEP_GRACE_MS);

  const filter: Record<string, unknown> = { status: "in-progress", serverEndTime: { $lt: cutoff } };
  if (opts.examIds) filter.examId = { $in: opts.examIds };

  const perExam = new Map<string, number>();
  let finalized = 0;
  let timedOut = false;

  const cursor = ExamAttempt.find(filter).select("_id examId").sort({ serverEndTime: 1 }).cursor();
  for await (const row of cursor) {
    if (Date.now() - started > budgetMs) { timedOut = true; break; }
    try {
      if (await finalizeIfExpired(row._id, SWEEP_GRACE_MS, now)) {
        finalized++;
        const k = row.examId.toString();
        perExam.set(k, (perExam.get(k) || 0) + 1);
      }
    } catch (err) {
      console.error("sweep: could not finalize attempt", row._id.toString(), err);
    }
  }

  if (finalized > 0) await logSweep(perExam);
  return { finalized, timedOut };
}

// One activity-feed line per school, so admins can see the system did this.
async function logSweep(perExam: Map<string, number>) {
  try {
    const exams = await Exam.find({ _id: { $in: [...perExam.keys()] } }).select("title schoolId");
    const bySchool = new Map<string, { total: number; exams: Record<string, number> }>();
    for (const e of exams) {
      const n = perExam.get(e._id.toString()) || 0;
      const key = e.schoolId.toString();
      const entry = bySchool.get(key) || { total: 0, exams: {} };
      entry.total += n;
      entry.exams[e.title] = (entry.exams[e.title] || 0) + n;
      bySchool.set(key, entry);
    }
    for (const [schoolId, entry] of bySchool) {
      await AuditLog.create({
        schoolId,
        actorRole: "system",
        action: "system.finalize_expired",
        summary: `Automatically finalized ${entry.total} abandoned attempt(s)`,
        entityType: "attempt",
        meta: { exams: entry.exams }
      });
    }
  } catch (err) {
    console.error("sweep: audit log write failed", err);
  }
}
