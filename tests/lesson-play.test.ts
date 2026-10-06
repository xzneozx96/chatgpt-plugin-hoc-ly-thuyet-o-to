import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning, questionProgress, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { answerAwards } from "../src/domain/game.js";
import { safeQuestion } from "../src/domain/course.js";
import { submitAnswer, type AnswerId } from "../src/domain/quiz.js";

// Tuesday 10:00 in Vietnam.
const morning = Date.parse("2026-10-06T03:00:00Z");
const MINUTE = 60000;
const requestId = () => randomUUID();
const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const wrong = (q: string) => safeQuestion(q).options.find(o => o.id !== right(q))?.id ?? "A";
const run = (state: LearnerState, c: LearningCommand, now: number) => executeLearning(state, c, now).state;
const study = (state: LearnerState, c: LearningCommand, now: number) => {
    const view = executeLearning(state, c, now).view;
    assert.ok(view.kind === "study");
    return view;
};
function lesson(questionIds: string[], state = createLearner(morning)) {
    state = run(state, { kind: "start_study", requestId: requestId(), questionIds }, morning);
    const session = state.sessions.at(-1);
    assert.ok(session);
    return { state, sessionId: session.id };
}
const answerIn = (state: LearnerState, sessionId: string, q: string, now: number, selected: AnswerId = right(q)) =>
    run(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: q, answer: selected }, now);
const next = (state: LearnerState, sessionId: string, now: number) => run(state, { kind: "next_study", requestId: requestId(), sessionId }, now);
const queue = (state: LearnerState, sessionId: string) => state.sessions.find(s => s.id === sessionId)?.items.map(i => i.repairOf ? `repair:${i.repairOf}` : i.questionId);

test("a wrong lesson answer schedules one repair step after the next two steps, or last when fewer remain", () => {
    const five = lesson(["q001", "q002", "q003", "q004", "q005"]);
    const s = answerIn(five.state, five.sessionId, "q001", morning, wrong("q001"));
    assert.deepEqual(queue(s, five.sessionId), ["q001", "q002", "q003", "repair:q001", "q004", "q005"]);
    let three = lesson(["q001", "q002", "q003"]);
    let t = answerIn(three.state, three.sessionId, "q001", morning);
    t = next(t, three.sessionId, morning);
    t = answerIn(t, three.sessionId, "q002", morning + MINUTE, wrong("q002"));
    assert.deepEqual(queue(t, three.sessionId), ["q001", "q002", "q003", "repair:q002"]);
    three = lesson(["q001"]);
    t = answerIn(three.state, three.sessionId, "q001", morning, wrong("q001"));
    assert.deepEqual(queue(t, three.sessionId), ["q001"], "with no other step left there is nothing to separate a repair from the feedback");
});

test("the repair step plays as its own step, earns 2 XP, and is never repaired again", () => {
    const { state, sessionId } = lesson(["q001", "q002", "q003"]);
    let s = answerIn(state, sessionId, "q001", morning, wrong("q001"));
    assert.throws(() => answerIn(s, sessionId, "q001", morning), /QUESTION_NOT_PENDING/, "the repair cannot be answered while the first answer's feedback shows");
    s = next(s, sessionId, morning + MINUTE);
    s = answerIn(s, sessionId, "q002", morning + MINUTE);
    s = next(s, sessionId, morning + MINUTE);
    s = answerIn(s, sessionId, "q003", morning + MINUTE);
    s = next(s, sessionId, morning + 2 * MINUTE);
    const repair = study(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning + 2 * MINUTE);
    assert.deepEqual([repair.question?.id, repair.itemKind, repair.repairOf, repair.questionStatus, repair.status], ["q001", "practice", "q001", "pending", "active"]);
    assert.equal(repair.currentFeedback, null, "the earlier verdict is not shown on the repair step");
    assert.equal(repair.help, null, "the answer key is not shown on the repair step");
    assert.equal(repair.lastAward, null);
    const answered = executeLearning(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: wrong("q001") }, morning + 3 * MINUTE);
    assert.ok(answered.view.kind === "study");
    assert.deepEqual(answered.view.lastAward, { xp: 2, reason: "repair", masteredNow: false });
    assert.equal(answered.view.currentFeedback?.correct, false);
    assert.deepEqual(queue(answered.state, sessionId), ["q001", "q002", "q003", "repair:q001"], "a wrong repair adds no second repair");
    const done = next(answered.state, sessionId, morning + 3 * MINUTE);
    assert.equal(done.sessions.find(x => x.id === sessionId)?.status, "complete");
});

test("help asked on a waiting repair step is shown, and a skipped repair step moves without its answered original", () => {
    const { state, sessionId } = lesson(["q001", "q002"]);
    let s = answerIn(state, sessionId, "q001", morning, wrong("q001"));
    s = next(s, sessionId, morning);
    s = answerIn(s, sessionId, "q002", morning);
    s = next(s, sessionId, morning);
    s = run(s, { kind: "skip_study", requestId: requestId(), sessionId }, morning + MINUTE);
    assert.deepEqual(queue(s, sessionId), ["q001", "q002", "repair:q001"]);
    assert.equal(s.sessions.find(x => x.id === sessionId)?.status, "paused", "a skipped last step leaves the lesson paused, not complete");
    s = run(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning + 2 * MINUTE);
    const helped = study(s, { kind: "record_help", requestId: requestId(), sessionId, questionId: "q001" }, morning + 3 * MINUTE);
    assert.equal(helped.help?.question.id, "q001");
});

test("a correct repair answer is assisted practice and never counts as delayed recall", () => {
    const { state, sessionId } = lesson(["q001", "q002"]);
    let s = answerIn(state, sessionId, "q001", morning, wrong("q001"));
    const dueAfterWrong = questionProgress(s).get("q001")?.dueAt;
    s = next(s, sessionId, morning);
    s = answerIn(s, sessionId, "q002", morning);
    s = next(s, sessionId, morning);
    // Even a day later, so the 24-hour wait has passed, the repair is not delayed recall.
    s = answerIn(s, sessionId, "q001", morning + DAY + MINUTE);
    const repairAnswer = s.evidence.filter(e => e.kind === "answer" && e.questionId === "q001").at(-1);
    assert.ok(repairAnswer?.kind === "answer");
    assert.equal(repairAnswer.assisted, true);
    assert.equal(questionProgress(s).get("q001")?.successes, 0);
    assert.equal(answerAwards(s).get(repairAnswer.id)?.reason, "repair");
    assert.equal(dueAfterWrong, morning + DAY);
});
