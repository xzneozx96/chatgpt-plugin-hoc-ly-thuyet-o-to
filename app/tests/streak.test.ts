import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { dailyStreak } from "../src/domain/streak.js";
import { courseView, createLearner, executeLearning } from "../src/domain/learning.js";

const at = (date: string) => Date.parse(date);

test("daily streak counts study days once, keeps yesterday's streak available today, and resets after a missed day", () => {
  const answers = [at("2026-10-05T04:00Z"), at("2026-10-05T05:00Z"), at("2026-10-06T04:00Z")];
  assert.equal(dailyStreak(answers, "Asia/Ho_Chi_Minh", at("2026-10-06T12:00Z")).days, 2);
  const pending = dailyStreak(answers, "Asia/Ho_Chi_Minh", at("2026-10-07T12:00Z"));
  assert.equal(pending.days, 2);
  assert.equal(pending.activeToday, false);
  assert.equal(pending.week.filter(day => day.active).length, 2);
  assert.equal(dailyStreak(answers, "Asia/Ho_Chi_Minh", at("2026-10-08T12:00Z")).days, 0);
  assert.equal(dailyStreak([], "Asia/Ho_Chi_Minh", at("2026-10-08T12:00Z")).days, 0);
});

test("daily streak uses learner-local calendar days across midnight, DST and year boundaries, ignoring future answers", () => {
  const now = at("2026-01-01T00:30Z");
  const answers = [at("2025-12-30T18:00Z"), at("2025-12-31T18:00Z"), at("2026-01-02T18:00Z")];
  const result = dailyStreak(answers, "Asia/Ho_Chi_Minh", now);
  assert.equal(result.days, 2);
  assert.equal(result.activeToday, true);
  assert.equal(result.week.at(-1)?.date, "2026-01-01");
  const dst = dailyStreak([at("2026-03-08T06:30Z"), at("2026-03-09T04:30Z")], "America/New_York", at("2026-03-09T12:00Z"));
  assert.equal(dst.days, 2, "23 hours between local study days still makes a two-day streak");
});

test("course streak derives from saved answers, including mistakes, while help and merely opening the card do not count", () => {
  const morning = at("2026-10-08T03:00Z");
  let state = createLearner(morning);
  assert.equal(courseView(state, morning).streak.days, 0);
  state = executeLearning(state, { kind: "answer_question", requestId: randomUUID(), questionId: "q001", answer: "A" }, morning).state;
  assert.equal(courseView(state, morning).streak.days, 1);
  state.evidence.push({ kind: "help", id: randomUUID(), questionId: "q002", at: morning + 86400000, localDay: "2026-10-09", sequence: state.nextOrder++, feedback: false });
  const next = courseView(state, morning + 86400000).streak;
  assert.equal(next.days, 1);
  assert.equal(next.activeToday, false);
});
