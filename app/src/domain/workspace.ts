import { randomUUID } from "node:crypto";
import { getPreviousQuestion, getQuestion, getQuestionById, questionBankSummary, searchTheory, submitAnswer, type AnswerId } from "./quiz.js";
import { reviewStates, studyProgress, type Attempt } from "./study.js";
import { AttemptStore } from "../persistence/attempts.js";

export class LearnerWorkspace {
  constructor(private readonly store: AttemptStore | null, private readonly now: () => Date = () => new Date()) {}

  getQuestion(input: { questionId?: string; afterQuestionId?: string; beforeQuestionId?: string; topic?: string } = {}) {
    if (input.questionId) return getQuestionById(input.questionId);
    if (input.beforeQuestionId) return getPreviousQuestion(input.beforeQuestionId, input.topic);
    return getQuestion(input.afterQuestionId, input.topic);
  }

  submitAnswer(input: { questionId: string; selectedAnswer: AnswerId; attemptId?: string }) {
    const result = submitAnswer(input.questionId, input.selectedAnswer);
    if (!this.store) return { ...result, attemptId: input.attemptId ?? randomUUID(), duplicate: false, nextReviewAt: null };
    const { attempt, duplicate } = this.store.append({
      attemptId: input.attemptId ?? randomUUID(),
      questionId: input.questionId,
      selectedAnswer: input.selectedAnswer,
      correct: result.correct,
      answeredAt: this.now().toISOString()
    });
    const state = reviewStates(this.store.all()).find((item) => item.questionId === attempt.questionId);
    return { ...result, attemptId: attempt.attemptId, duplicate, nextReviewAt: state?.dueAt ?? null };
  }

  getDueReviews(limit = 10) {
    if (!this.store) throw new Error("PROGRESS_UNAVAILABLE");
    return reviewStates(this.store.all())
      .filter((state) => state.dueAt <= this.now().toISOString())
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map((state) => ({ ...state, question: getQuestionById(state.questionId) }));
  }

  getProgress() {
    if (!this.store) throw new Error("PROGRESS_UNAVAILABLE");
    return studyProgress(this.store.all(), this.now().toISOString(), questionBankSummary.total);
  }

  searchTheory(query: string, limit = 5) { return searchTheory(query, limit); }
}

export interface UserAttemptStore {
  append(userId: string, attempt: Attempt): Promise<{ attempt: Attempt; duplicate: boolean }>;
  all(userId: string): Promise<Attempt[]>;
  deleteAll(userId: string): Promise<number>;
}

export class AuthenticatedLearnerWorkspace {
  constructor(
    private readonly userId: string,
    private readonly store: UserAttemptStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async submitAnswer(input: { questionId: string; selectedAnswer: AnswerId; attemptId?: string }) {
    const result = submitAnswer(input.questionId, input.selectedAnswer);
    const { attempt, duplicate } = await this.store.append(this.userId, {
      attemptId: input.attemptId ?? randomUUID(),
      questionId: input.questionId,
      selectedAnswer: input.selectedAnswer,
      correct: result.correct,
      answeredAt: this.now().toISOString()
    });
    const state = reviewStates(await this.store.all(this.userId)).find((item) => item.questionId === attempt.questionId);
    return { ...result, attemptId: attempt.attemptId, duplicate, nextReviewAt: state?.dueAt ?? null };
  }

  async getDueReviews(limit = 10) {
    return reviewStates(await this.store.all(this.userId))
      .filter((state) => state.dueAt <= this.now().toISOString())
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map((state) => ({ ...state, question: getQuestionById(state.questionId) }));
  }

  async getProgress() {
    return studyProgress(await this.store.all(this.userId), this.now().toISOString(), questionBankSummary.total);
  }

  deleteProgress() { return this.store.deleteAll(this.userId); }
}
