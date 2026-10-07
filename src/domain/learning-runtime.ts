import { randomUUID } from "node:crypto";
import { closeExpiredLightning, createLearner, courseView, todayMistakes, executeLearning, listUnits, runningMockQuestions, studyView, type LearnerState, type LearningCommand } from "./learning.js";
import { leagueSummary, leagueView } from "./league.js";
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
      let state = structuredClone(stored?.state ?? createLearner(at));
      const expired = state.mocks.filter(mock => mock.status === "active" && mock.deadline <= at);
      const lightningClosed = closeExpiredLightning(state, at);
      if (!expired.length && !lightningClosed) return { state, revision: stored?.revision ?? -1 };
      for (const mock of expired) state = executeLearning(state, { kind: "view_mock", attemptId: mock.id, requestId: randomUUID() }, at).state;
      if (await this.store.compareAndSwap(this.userId, stored?.revision ?? null, state)) return { state, revision: stored ? stored.revision + 1 : 0 };
    }
    throw new Error("LEARNING_SAVE_CONFLICT");
  }

  // Other learners' states are read only to build the board; only display names and weekly XP leave this call.
  private async board(state: LearnerState) {
    return leagueView(this.userId, state, state.league ? await this.store.leagueMembers() : [], this.now());
  }

  delete() { return this.store.delete(this.userId); }
  async runningMockQuestions() { return runningMockQuestions((await this.current()).state); }
  async course() { const saved = await this.current(); return { ...courseView(saved.state, this.now()), leagueSummary: leagueSummary(await this.board(saved.state)), revision: saved.revision }; }
  async league() { const saved = await this.current(); return { ...await this.board(saved.state), revision: saved.revision }; }
  async mistakes() { const saved = await this.current(); return { kind: "mistakes" as const, items: todayMistakes(saved.state, this.now()), revision: saved.revision }; }
  async units(query?: string) { const saved = await this.current(); return { ...listUnits(saved.state, query, this.now()), revision: saved.revision }; }
  async session(sessionId: string) { const saved = await this.current(); return { ...studyView(saved.state, sessionId, this.now()), revision: saved.revision }; }
}
