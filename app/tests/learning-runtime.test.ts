import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { createLearningTools } from "../src/learning-tools.js";
import { SqliteLearningStore } from "../src/persistence/learning-store.js";

test("an identical replay returns the saved result without rewriting the learner", async () => {
  const store = new SqliteLearningStore(":memory:");
  const runtime = new LearningRuntime(store, "learner-a", () => Date.parse("2026-10-06T03:00:00Z"));
  const requestId = randomUUID();
  const first = await runtime.command({ kind: "update_profile", requestId, dailyGoal: 15 });
  const replay = await runtime.command({ kind: "update_profile", requestId, dailyGoal: 15 });
  assert.equal((await store.load("learner-a"))?.revision, first.revision);
  assert.equal(replay.revision, first.revision);
  await assert.rejects(runtime.command({ kind: "update_profile", requestId, dailyGoal: 10 }), /REQUEST_CONFLICT/);
  store.close();
});

test("mutating learning tools require a stable request ID", async () => {
  const store = new SqliteLearningStore(":memory:");
  const tools = createLearningTools(new LearningRuntime(store, "learner-a"), "local");
  const startMock = tools.find(tool => tool.name === "start_mock_test");
  assert.ok(startMock);
  await assert.rejects(startMock.run({ mode: "random" }));
  const requestId = randomUUID();
  const first = await startMock.run({ mode: "random", requestId }) as { attemptId: string };
  const retried = await startMock.run({ mode: "random", requestId }) as { attemptId: string };
  assert.equal(retried.attemptId, first.attemptId);
  store.close();
});

test("inspecting a mock needs no request ID and finalises it after the deadline", async () => {
  const store = new SqliteLearningStore(":memory:");
  let now = Date.parse("2026-10-06T03:00:00Z");
  const tools = createLearningTools(new LearningRuntime(store, "learner-a", () => now), "local");
  const started = await tools.find(tool => tool.name === "start_mock_test")?.run({ mode: "random", requestId: randomUUID() }) as { attemptId: string };
  now += 20 * 60000;
  const viewed = await tools.find(tool => tool.name === "get_mock_test")?.run({ attemptId: started.attemptId }) as { status: string };
  assert.equal(viewed.status, "finalised");
  store.close();
});
