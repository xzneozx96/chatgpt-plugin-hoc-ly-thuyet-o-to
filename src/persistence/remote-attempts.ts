import { neon } from "@neondatabase/serverless";
import type { Attempt } from "../domain/study.js";
import type { UserAttemptStore } from "../domain/workspace.js";

interface AttemptRow {
  attempt_id: string;
  question_id: string;
  selected_answer: Attempt["selectedAnswer"];
  correct: boolean;
  answered_at: Date | string;
}

interface QueryClient {
  query<Row>(text: string, params: unknown[]): Promise<{ rows: Row[]; rowCount: number }>;
}

export class RemoteAttemptStore implements UserAttemptStore {
  constructor(private readonly pool: QueryClient) {}

  async append(userId: string, attempt: Attempt) {
    const inserted = await this.pool.query<AttemptRow>(
      `INSERT INTO attempts (user_id, attempt_id, question_id, selected_answer, correct, answered_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, attempt_id) DO NOTHING
       RETURNING attempt_id, question_id, selected_answer, correct, answered_at`,
      [userId, attempt.attemptId, attempt.questionId, attempt.selectedAnswer, attempt.correct, attempt.answeredAt]
    );
    if (inserted.rows[0]) return { attempt: toAttempt(inserted.rows[0]), duplicate: false };
    const existing = await this.pool.query<AttemptRow>(
      `SELECT attempt_id, question_id, selected_answer, correct, answered_at
       FROM attempts WHERE user_id = $1 AND attempt_id = $2`,
      [userId, attempt.attemptId]
    );
    const row = existing.rows[0];
    if (!row) throw new Error("ATTEMPT_INSERT_NOT_VISIBLE");
    const stored = toAttempt(row);
    if (stored.questionId !== attempt.questionId || stored.selectedAnswer !== attempt.selectedAnswer) throw new Error("ATTEMPT_ID_CONFLICT");
    return { attempt: stored, duplicate: true };
  }

  async all(userId: string) {
    const result = await this.pool.query<AttemptRow>(
      `SELECT attempt_id, question_id, selected_answer, correct, answered_at
       FROM attempts WHERE user_id = $1 ORDER BY answered_at, attempt_id`,
      [userId]
    );
    return result.rows.map(toAttempt);
  }

  async deleteAll(userId: string) {
    const result = await this.pool.query(
      "DELETE FROM attempts WHERE user_id = $1",
      [userId]
    );
    return result.rowCount ?? 0;
  }
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    attemptId: row.attempt_id,
    questionId: row.question_id,
    selectedAnswer: row.selected_answer,
    correct: row.correct,
    answeredAt: row.answered_at instanceof Date ? row.answered_at.toISOString() : new Date(row.answered_at).toISOString()
  };
}

export function createRemoteAttemptStore(databaseUrl: string) {
  const sql = neon<false, true>(databaseUrl, { fullResults: true });
  return new RemoteAttemptStore({
    async query<Row>(text: string, params: unknown[]) {
      const result = await sql.query(text, params);
      return { rows: result.rows as Row[], rowCount: result.rowCount };
    }
  });
}
