import { randomUUID } from "node:crypto";
import { createLearner, courseView, executeLearning, listUnits, runningMockQuestions, studyView, type LearnerState, type LearningCommand } from "./learning.js";
import type { LearningStore } from "../persistence/learning-store.js";

export class LearningRuntime {
  constructor(
    private readonly store: LearningStore,
    private readonly userId: string,
    private readonly now: () => number = Date.now
  ) {}

  async command(command: LearningCommand) {
    const at = this.now();
    for (let retry = 0; retry < 8; retry++) {
      const stored = await this.store.load(this.userId);
      const result = executeLearning(stored?.state ?? createLearner(at), command, at);
      if (stored && JSON.stringify(result.state) === JSON.stringify(stored.state)) return { ...result.view, revision: stored.revision };
      if (await this.store.compareAndSwap(this.userId, stored?.revision ?? null, result.state)) return { ...result.view, revision: stored ? stored.revision + 1 : 0 };
    }
    throw new Error("LEARNING_SAVE_CONFLICT");
  }

  private async current(): Promise<{ state: LearnerState; revision: number }> {
    const at = this.now();
    for (let retry = 0; retry < 8; retry++) {
      const stored = await this.store.load(this.userId);
      let state = stored?.state ?? createLearner(at);
      const expired = state.mocks.filter(mock => mock.status === "active" && mock.deadline <= at);
      if (!expired.length) return { state, revision: stored?.revision ?? -1 };
      for (const mock of expired) state = executeLearning(state, { kind: "view_mock", attemptId: mock.id, requestId: randomUUID() }, at).state;
      if (await this.store.compareAndSwap(this.userId, stored?.revision ?? null, state)) return { state, revision: stored ? stored.revision + 1 : 0 };
    }
    throw new Error("LEARNING_SAVE_CONFLICT");
  }

  delete() { return this.store.delete(this.userId); }
  async runningMockQuestions() { return runningMockQuestions((await this.current()).state); }
  async course() { const saved = await this.current(); return { ...courseView(saved.state, this.now()), revision: saved.revision }; }
  async units(query?: string) { const saved = await this.current(); return { ...listUnits(saved.state, query, this.now()), revision: saved.revision }; }
  async session(sessionId: string) { const saved = await this.current(); return { ...studyView(saved.state, sessionId, this.now()), revision: saved.revision }; }
}
