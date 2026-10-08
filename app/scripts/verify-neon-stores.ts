import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { createLearner } from "../src/domain/learning.js";
import { createRemoteLearningStore } from "../src/persistence/learning-store.js";
import { createRemoteAttemptStore } from "../src/persistence/remote-attempts.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const userId = `verify-${randomUUID()}`;
const learning = createRemoteLearningStore(databaseUrl);
const attempts = createRemoteAttemptStore(databaseUrl);

try {
  const runtime = new LearningRuntime(learning, userId);
  const requestId = randomUUID();
  const first = await runtime.command({ kind: "update_profile", requestId, dailyGoal: 15 });
  assert.equal(first.revision, 0, "first save inserts revision 0");
  const replay = await runtime.command({ kind: "update_profile", requestId, dailyGoal: 15 });
  assert.equal(replay.revision, 0, "identical replay does not write");
  await assert.rejects(runtime.command({ kind: "update_profile", requestId, dailyGoal: 10 }), /REQUEST_CONFLICT/);
  const loaded = await learning.load(userId);
  assert.equal(loaded?.revision, 0);
  assert.equal(loaded?.state.profile.dailyGoal, 15, "JSONB state round-trips");
  assert.equal(await learning.compareAndSwap(userId, 7, createLearner(Date.now())), false, "stale revision is rejected");
  assert.equal(await learning.compareAndSwap(userId, null, createLearner(Date.now())), false, "second insert is rejected");
  const [a, b] = await Promise.all([
    runtime.command({ kind: "set_confusion", requestId: randomUUID(), questionId: "q001", enabled: true }),
    runtime.command({ kind: "set_confusion", requestId: randomUUID(), questionId: "q002", enabled: true })
  ]);
  assert.deepEqual([a.revision, b.revision].sort(), [1, 2], "concurrent commands both commit through CAS retry");
  assert.equal((await learning.load(userId))?.state.evidence.length, 2, "both concurrent facts survive");

  const attempt = { attemptId: randomUUID(), questionId: "q001", selectedAnswer: "B" as const, correct: true, answeredAt: new Date().toISOString() };
  assert.equal((await attempts.append(userId, attempt)).duplicate, false);
  assert.equal((await attempts.append(userId, attempt)).duplicate, true, "attempt replay is detected");
  assert.equal((await attempts.all(userId)).length, 1);

  assert.equal(await learning.delete(userId), true);
  assert.equal(await learning.load(userId), null, "learner row deleted");
  assert.equal(await attempts.deleteAll(userId), 1);
  console.log("Neon stores verified: CAS insert/update, replay, conflict, concurrency, JSONB round-trip, attempts, delete");
} finally {
  await learning.delete(userId);
  await attempts.deleteAll(userId);
}
