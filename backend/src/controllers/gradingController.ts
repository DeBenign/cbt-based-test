import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import Exam from "../models/Exam";
import ExamAttempt from "../models/ExamAttempt";
import Question from "../models/Question";

// Teacher: every ungraded (and already-graded, for review) theory answer
// across every student's attempt at one exam.
export async function getGradingQueue(req: AuthedRequest, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.examId, schoolId: req.user!.schoolId });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const theoryQuestions = await Question.find({ _id: { $in: exam.questionIds }, type: "theory" });
  if (theoryQuestions.length === 0) {
    return res.json({ examTitle: exam.title, hasTheoryQuestions: false, students: [] });
  }
  const theoryById = new Map(theoryQuestions.map((q) => [q._id.toString(), q]));

  const attempts = await ExamAttempt.find({
    examId: exam._id,
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).populate("studentId", "name email");

  const students = attempts.map((a) => ({
    attemptId: a._id,
    studentId: (a.studentId as any)._id,
    studentName: (a.studentId as any).name,
    needsGrading: a.needsGrading,
    answers: a.answers
      .filter((ans) => theoryById.has(ans.questionId.toString()))
      .map((ans) => {
        const q = theoryById.get(ans.questionId.toString())!;
        return {
          questionId: q._id,
          questionText: q.questionText,
          modelAnswer: q.correctAnswerText || null,
          maxMarks: q.marks,
          answerText: ans.answerText || null,
          marksAwarded: ans.marksAwarded ?? null
        };
      })
  }));

  res.json({ examTitle: exam.title, hasTheoryQuestions: true, students });
}

// Teacher: assign marks to one theory answer within one attempt, then
// recompute that attempt's overall score and grading status.
export async function gradeAnswer(req: AuthedRequest, res: Response) {
  const { marksAwarded } = req.body as { marksAwarded: number };
  const attempt = await ExamAttempt.findById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });

  const question = await Question.findOne({ _id: req.params.questionId, schoolId: req.user!.schoolId });
  if (!question || question.type !== "theory") {
    return res.status(400).json({ error: "Not a theory question" });
  }
  if (marksAwarded < 0 || marksAwarded > question.marks) {
    return res.status(400).json({ error: `Marks must be between 0 and ${question.marks}` });
  }

  const answer = attempt.answers.find((a) => a.questionId.toString() === req.params.questionId);
  if (!answer) return res.status(404).json({ error: "This student has no answer for that question" });

  answer.marksAwarded = marksAwarded;
  answer.gradedAt = new Date();

  // Recompute the full score and grading status the same way gradeAttempt does.
  const allQuestions = await Question.find({ _id: { $in: attempt.questionOrder } });
  const byId = new Map(allQuestions.map((q) => [q._id.toString(), q]));
  let score = 0;
  let needsGrading = false;
  for (const a of attempt.answers) {
    const q = byId.get(a.questionId.toString());
    if (!q) continue;
    if (q.type === "mcq") {
      const correct = q.options.find((o) => o.isCorrect);
      if (correct && a.selectedOption === correct.text) score += q.marks;
    } else if (q.type === "theory") {
      if (a.answerText && a.answerText.trim().length > 0) {
        if (typeof a.marksAwarded === "number") score += a.marksAwarded;
        else needsGrading = true;
      }
    }
  }
  attempt.score = score;
  attempt.needsGrading = needsGrading;
  attempt.gradedBy = req.user!.userId as any;

  await attempt.save();
  res.json({ score: attempt.score, needsGrading: attempt.needsGrading });
}