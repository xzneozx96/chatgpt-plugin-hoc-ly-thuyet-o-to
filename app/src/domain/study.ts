export interface Attempt {
  attemptId: string;
  questionId: string;
  selectedAnswer: "A" | "B" | "C" | "D";
  correct: boolean;
  answeredAt: string;
}

export interface ReviewState {
  questionId: string;
  attempts: number;
  correctStreak: number;
  mistakeCount: number;
  dueAt: string;
  lastAnsweredAt: string;
}

const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
const DAY_MS = 86_400_000;

export function reviewStates(attempts: readonly Attempt[]): ReviewState[] {
  const byQuestion = new Map<string, ReviewState>();
  for (const attempt of [...attempts].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt) || a.attemptId.localeCompare(b.attemptId))) {
    const previous = byQuestion.get(attempt.questionId);
    const correctStreak = attempt.correct ? (previous?.correctStreak ?? 0) + 1 : 0;
    const intervalDays = attempt.correct ? INTERVAL_DAYS[Math.min(correctStreak - 1, INTERVAL_DAYS.length - 1)]! : 0;
    byQuestion.set(attempt.questionId, {
      questionId: attempt.questionId,
      attempts: (previous?.attempts ?? 0) + 1,
      correctStreak,
      mistakeCount: (previous?.mistakeCount ?? 0) + Number(!attempt.correct),
      dueAt: new Date(Date.parse(attempt.answeredAt) + intervalDays * DAY_MS).toISOString(),
      lastAnsweredAt: attempt.answeredAt
    });
  }
  return [...byQuestion.values()].sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.questionId.localeCompare(b.questionId));
}

export function studyProgress(attempts: readonly Attempt[], now: string, totalQuestions = 600) {
  const states = reviewStates(attempts);
  const correct = attempts.filter((attempt) => attempt.correct).length;
  return {
    totalQuestions,
    practicedQuestions: states.length,
    unseenQuestions: totalQuestions - states.length,
    totalAttempts: attempts.length,
    correctAttempts: correct,
    accuracyPercent: attempts.length ? Math.round(100 * correct / attempts.length) : 0,
    dueReviews: states.filter((state) => state.dueAt <= now).length
  };
}
