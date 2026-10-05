import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LearnerWorkspace } from "../src/domain/workspace.js";
import { reviewStates } from "../src/domain/study.js";
import { AttemptStore } from "../src/persistence/attempts.js";

test("review intervals advance after correct answers and reset after a wrong answer", () => {
  const attempts = [1, 2, 3, 4, 5].map((day, index) => ({
    attemptId: String(index), questionId: "q001", selectedAnswer: "B" as const,
    correct: true, answeredAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`
  }));
  assert.equal(reviewStates(attempts.slice(0, 1))[0]?.dueAt, "2026-10-02T00:00:00.000Z");
  assert.equal(reviewStates(attempts.slice(0, 2))[0]?.dueAt, "2026-10-05T00:00:00.000Z");
  assert.equal(reviewStates(attempts.slice(0, 3))[0]?.dueAt, "2026-10-10T00:00:00.000Z");
  assert.equal(reviewStates(attempts.slice(0, 4))[0]?.dueAt, "2026-10-18T00:00:00.000Z");
  assert.equal(reviewStates(attempts)[0]?.dueAt, "2026-11-04T00:00:00.000Z");
  assert.equal(reviewStates([...attempts, { ...attempts[0]!, attemptId: "wrong", selectedAnswer: "A", correct: false, answeredAt: "2026-10-06T00:00:00.000Z" }])[0]?.dueAt, "2026-10-06T00:00:00.000Z");
});

test("attempts persist across restart and a repeated ID does not change progress", () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-study-"));
  const path = join(dir, "attempts.sqlite");
  try {
    let now = new Date("2026-10-01T00:00:00.000Z");
    const store = new AttemptStore(path);
    const workspace = new LearnerWorkspace(store, () => now);
    const id = "e4249e85-fca8-491c-803c-82fa82d7a6c1";
    const first = workspace.submitAnswer({ questionId: "q001", selectedAnswer: "A", attemptId: id });
    assert.equal(first.correct, false);
    assert.equal(first.nextReviewAt, "2026-10-01T00:00:00.000Z");
    assert.equal(workspace.getDueReviews()[0]?.questionId, "q001");
    assert.equal(workspace.submitAnswer({ questionId: "q001", selectedAnswer: "A", attemptId: id }).duplicate, true);
    assert.equal(workspace.getProgress().totalAttempts, 1);
    assert.throws(() => workspace.submitAnswer({ questionId: "q001", selectedAnswer: "B", attemptId: id }), /ATTEMPT_ID_CONFLICT/);
    store.close();

    now = new Date("2026-10-02T00:00:00.000Z");
    const reopened = new AttemptStore(path);
    const resumed = new LearnerWorkspace(reopened, () => now);
    assert.deepEqual(resumed.getProgress(), { totalQuestions: 600, practicedQuestions: 1, unseenQuestions: 599, totalAttempts: 1, correctAttempts: 0, accuracyPercent: 0, dueReviews: 1 });
    const second = resumed.submitAnswer({ questionId: "q001", selectedAnswer: "B", attemptId: "6b2497f9-f6bb-48db-9d3a-a99dc9442a41" });
    assert.equal(second.nextReviewAt, "2026-10-03T00:00:00.000Z");
    assert.equal(resumed.getProgress().dueReviews, 0);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("search results are sourced from the bank and support accent-free queries", () => {
  const workspace = new LearnerWorkspace(null);
  const hits = workspace.searchTheory("phan duong xe chay", 5);
  assert.ok(hits.some((hit) => hit.questionId === "q001"));
  assert.ok(hits.some((hit) => hit.source === "question-bank.json#q001"));
  assert.ok(hits.every((hit) => hit.source.startsWith("question-bank.json#q")));
  assert.deepEqual(workspace.searchTheory("zzzxxyyqqq"), []);
});
