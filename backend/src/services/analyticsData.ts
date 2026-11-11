import Question from "../models/Question";
import ExamAttempt from "../models/ExamAttempt";
import { finalizeExpiredAttempts } from "./finalizeExpired";
import { pct, QuestionTally, TopicTally } from "./analytics";

// Loads attempts and questions for a set of exams once, and answers the questions every view asks.
export async function loadExamData(exams: any[], onlyStudentId?: string) {
  const examIds = exams.map((e) => e._id);
  await finalizeExpiredAttempts({ examIds });

  const qIds = [...new Set(exams.flatMap((e) => e.questionIds.map(String)))];
  const questions = await Question.find({ _id: { $in: qIds } }).select("topic type marks options questionText");
  const qMap = new Map(questions.map((q) => [String(q._id), q]));

  const attempts = await ExamAttempt.find({
    examId: { $in: examIds },
    status: { $in: ["submitted", "auto-submitted", "flagged"] }
  }).select("examId studentId score needsGrading answers");

  const totalMarks = new Map(exams.map((e) => [String(e._id), e.questionIds.reduce((t: number, id: any) => t + (qMap.get(String(id))?.marks ?? 0), 0)]));
  const byExam = new Map<string, any[]>();
  for (const a of attempts) byExam.set(String(a.examId), [...(byExam.get(String(a.examId)) ?? []), a]);

  // % for one attempt; null while theory marking is still pending (the number would be incomplete).
  const attemptPct = (a: any, examId: string) => (a.needsGrading ? null : pct(a.score ?? 0, totalMarks.get(examId) ?? 0));

  // Per-question tally for a set of attempts: what was earned out of what was possible.
  function tally(examList: any[], filter?: (a: any) => boolean) {
    const perQuestion = new Map<string, QuestionTally>();
    for (const e of examList) {
      for (const a of byExam.get(String(e._id)) ?? []) {
        if (filter && !filter(a)) continue;
        for (const qid of e.questionIds) {
          const q = qMap.get(String(qid));
          if (!q) continue;
          const ans = a.answers.find((x: any) => String(x.questionId) === String(qid));
          let earned = 0;
          if (q.type === "mcq") {
            const correct = q.options.find((o: any) => o.isCorrect);
            earned = correct && ans?.selectedOption === correct.text ? q.marks : 0;
          } else if (ans?.marksAwarded !== undefined) earned = ans.marksAwarded;
          else if (a.needsGrading) continue; // not marked yet, so it can't count either way
          const cur = perQuestion.get(String(qid)) ?? { questionId: String(qid), text: q.questionText, topic: q.topic || "General", answers: 0, earned: 0, possible: 0 };
          cur.answers++; cur.earned += earned; cur.possible += q.marks;
          perQuestion.set(String(qid), cur);
        }
      }
    }
    return [...perQuestion.values()];
  }

  return { byExam, attemptPct, tally };
}

export const topicTallies = (qt: QuestionTally[]): TopicTally[] => qt.map((t) => ({ topic: t.topic, earned: t.earned, possible: t.possible, questions: 1 }));

