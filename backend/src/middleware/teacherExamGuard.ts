import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import Exam from "../models/Exam";
import { loadTeacherScope, denyReason } from "../utils/teacherScope";

// For routes that carry an exam id: a teacher can only open exams for a subject AND class assigned to them.
// Other roles pass straight through, and an unknown id falls through so the controller can answer 404.
export function teacherExamGuard(req: AuthedRequest, res: Response, next: NextFunction, examId: string) {
  if (req.user?.role !== "teacher") return next();
  (async () => {
    const exam = await Exam.findOne({ _id: examId, schoolId: req.user!.schoolId }).select("subjectId classId").lean();
    if (!exam) return next();
    const denied = denyReason(await loadTeacherScope(req.user!.userId), exam.subjectId, exam.classId);
    if (denied) return res.status(403).json({ error: denied });
    next();
  })().catch(next);
}
