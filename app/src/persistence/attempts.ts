import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Attempt } from "../domain/study.js";

export class AttemptStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attempts (
        attempt_id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        selected_answer TEXT NOT NULL,
        correct INTEGER NOT NULL,
        answered_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attempts_by_question ON attempts(question_id, answered_at);
    `);
  }

  append(attempt: Attempt): { attempt: Attempt; duplicate: boolean } {
    const existing = this.db.prepare("SELECT attempt_id, question_id, selected_answer, correct, answered_at FROM attempts WHERE attempt_id = ?").get(attempt.attemptId);
    if (existing) {
      const stored = toAttempt(existing);
      if (stored.questionId !== attempt.questionId || stored.selectedAnswer !== attempt.selectedAnswer) throw new Error("ATTEMPT_ID_CONFLICT");
      return { attempt: stored, duplicate: true };
    }
    this.db.prepare("INSERT INTO attempts (attempt_id, question_id, selected_answer, correct, answered_at) VALUES (?, ?, ?, ?, ?)")
      .run(attempt.attemptId, attempt.questionId, attempt.selectedAnswer, Number(attempt.correct), attempt.answeredAt);
    return { attempt, duplicate: false };
  }

  all(): Attempt[] {
    return this.db.prepare("SELECT attempt_id, question_id, selected_answer, correct, answered_at FROM attempts ORDER BY answered_at, attempt_id")
      .all().map(toAttempt);
  }

  close(): void { this.db.close(); }
}

function toAttempt(row: Record<string, unknown>): Attempt {
  return {
    attemptId: String(row.attempt_id),
    questionId: String(row.question_id),
    selectedAnswer: String(row.selected_answer) as Attempt["selectedAnswer"],
    correct: Boolean(row.correct),
    answeredAt: String(row.answered_at)
  };
}
