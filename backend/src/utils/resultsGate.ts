const RESULTS_DELAY_MS = 60 * 60 * 1000; // 1 hour, applies to student, teacher, and admin alike

export function resultsUnlockAt(exam: { endTime: Date }): Date {
  return new Date(new Date(exam.endTime).getTime() + RESULTS_DELAY_MS);
}

export function isUnlocked(exam: { endTime: Date }): boolean {
  return Date.now() >= resultsUnlockAt(exam).getTime();
}
