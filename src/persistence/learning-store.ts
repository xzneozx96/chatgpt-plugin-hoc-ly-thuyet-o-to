import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { LearnerStateSchema, type LearnerState } from "../domain/learning.js";

export interface LearningRecord {
  revision: number;
  state: LearnerState;
}

export interface LearningStore {
  load(userId: string): Promise<LearningRecord | null>;
  compareAndSwap(userId: string, revision: number | null, state: LearnerState): Promise<boolean>;
  delete(userId: string): Promise<boolean>;
}

const rowSchema = z.object({ revision: z.coerce.number().int().nonnegative(), state: z.unknown() });

function record(value: unknown): LearningRecord {
  const row = rowSchema.parse(value);
  return { revision: row.revision, state: LearnerStateSchema.parse(typeof row.state === "string" ? JSON.parse(row.state) : row.state) };
}

export class SqliteLearningStore implements LearningStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS learner_workspaces (
      user_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      state TEXT NOT NULL
    )`);
  }

  async load(userId: string) {
    const row = this.db.prepare("SELECT revision, state FROM learner_workspaces WHERE user_id = ?").get(userId);
    return row ? record(row) : null;
  }

  async compareAndSwap(userId: string, revision: number | null, state: LearnerState) {
    const encoded = JSON.stringify(state);
    const result = revision === null
      ? this.db.prepare("INSERT INTO learner_workspaces (user_id, revision, state) VALUES (?, 0, ?) ON CONFLICT DO NOTHING").run(userId, encoded)
      : this.db.prepare("UPDATE learner_workspaces SET revision = revision + 1, state = ? WHERE user_id = ? AND revision = ?").run(encoded, userId, revision);
    return result.changes === 1;
  }

  async delete(userId: string) {
    return this.db.prepare("DELETE FROM learner_workspaces WHERE user_id = ?").run(userId).changes === 1;
  }

  close() { this.db.close(); }
}

export function createRemoteLearningStore(databaseUrl: string): LearningStore {
  const sql = neon(databaseUrl);
  return {
    async load(userId) {
      const rows = await sql.query("SELECT revision, state FROM learner_workspaces WHERE user_id = $1", [userId]);
      return rows[0] ? record(rows[0]) : null;
    },
    async compareAndSwap(userId, revision, state) {
      const rows = revision === null
        ? await sql.query("INSERT INTO learner_workspaces (user_id, revision, state) VALUES ($1, 0, $2::jsonb) ON CONFLICT DO NOTHING RETURNING revision", [userId, JSON.stringify(state)])
        : await sql.query("UPDATE learner_workspaces SET revision = revision + 1, state = $1::jsonb WHERE user_id = $2 AND revision = $3 RETURNING revision", [JSON.stringify(state), userId, revision]);
      return rows.length === 1;
    },
    async delete(userId) {
      return (await sql.query("DELETE FROM learner_workspaces WHERE user_id = $1 RETURNING user_id", [userId])).length === 1;
    }
  };
}
