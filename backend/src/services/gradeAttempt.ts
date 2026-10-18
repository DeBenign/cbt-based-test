import Question from "../models/Question";

// Recomputes an attempt's score and needsGrading flag from its saved answers.
// MCQs are scored against the question's CURRENT answer key (which is what
// makes admin "regrade" useful after a teacher fixes a wrong key); theory
// answers count only once a teacher or admin has awarded marks.
export async function gradeAttempt(attempt: any) {
  const questions = await Question.find({ _id: { $in: attempt.questionOrder } });
  const byId = new Map(questions.map((q) => [q._id.toString(), q]));

  let score = 0;
  let needsGrading = false;

  for (const answer of attempt.answers) {
    const question = byId.get(answer.questionId.toString());
    if (!question) continue;

    if (question.type === "mcq") {
      const correct = question.options.find((o) => o.isCorrect);
      if (correct && answer.selectedOption === correct.text) {
        score += question.marks;
      }
    } else if (question.type === "theory") {
      if (answer.answerText && answer.answerText.trim().length > 0) {
        if (typeof answer.marksAwarded === "number") {
          score += answer.marksAwarded;
        } else {
          needsGrading = true;
        }
      }
      // an unanswered theory question needs no grading action -- it's just 0
    }
  }

  attempt.score = score;
  attempt.needsGrading = needsGrading;
  await attempt.save();
}
