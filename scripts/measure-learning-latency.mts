import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning } from "../src/domain/learning.js";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { SqliteLearningStore } from "../src/persistence/learning-store.js";

for (const attempts of [0, 100, 500]) {
  const now = Date.now();
  let state = createLearner(now);
  for (let i = 0; i < attempts; i++) state = executeLearning(state, { kind: "answer_question", requestId: randomUUID(), questionId: "q600", answer: "A" }, now).state;
  const store = new SqliteLearningStore(":memory:");
  await store.compareAndSwap("benchmark", null, state);
  const runtime = new LearningRuntime(store, "benchmark", () => now);
  const start = await runtime.command({ kind: "start_study", requestId: randomUUID(), questionIds: ["q001", "q002"] });
  if (start.kind !== "study" || !start.question) throw new Error("No study question");
  const answerAt = performance.now();
  await runtime.command({ kind: "answer_study", requestId: randomUUID(), sessionId: start.sessionId, questionId: start.question.id, answer: start.question.options[0]!.id });
  const answerMs = performance.now() - answerAt;
  const nextAt = performance.now();
  await runtime.command({ kind: "next_study", requestId: randomUUID(), sessionId: start.sessionId });
  console.log(JSON.stringify({ attempts, answerMs: +answerMs.toFixed(2), nextMs: +(performance.now() - nextAt).toFixed(2), storage: "in-memory SQLite", includesHostTransport: false }));
  store.close();
}
