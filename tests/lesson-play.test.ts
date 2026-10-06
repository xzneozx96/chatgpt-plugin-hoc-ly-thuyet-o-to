import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, courseView, executeLearning, questionProgress, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { answerAwards } from "../src/domain/game.js";
import { bankQuestions, families, safeQuestion } from "../src/domain/course.js";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { SqliteLearningStore } from "../src/persistence/learning-store.js";
import { learningText } from "../src/learning-tools.js";
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
    assert.deepEqual(answered.view.lastAward, { xp: 2, reason: "repair", masteredNow: false, baseXp: 2, bonusXp: 0 });
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

function dailyLesson() {
    const state = run(createLearner(morning), { kind: "start_study", requestId: requestId() }, morning);
    const session = state.sessions.at(-1);
    assert.ok(session);
    return { state, sessionId: session.id, items: session.items };
}
/** Answers every step correctly until the active step belongs to a pair. */
function playToPair(state: LearnerState, sessionId: string) {
    for (let i = 0; i < 50; i++) {
        const view = study(state, { kind: "resume_study", requestId: requestId(), sessionId }, morning);
        if (view.pair)
            return { state, view };
        const q = view.question?.id;
        assert.ok(q);
        state = next(answerIn(state, sessionId, q, morning), sessionId, morning);
    }
    throw new Error("no pair reached");
}

test("a daily lesson ends with one new question and a not-yet-learned sibling from its family", () => {
    const { items } = dailyLesson();
    assert.equal(items.length, 13, "12 new questions and one sibling");
    assert.equal(new Set(items.map(i => i.questionId)).size, 13, "no question appears twice");
    assert.equal(items[0]?.questionId, "q001", "the lesson still starts where it would have");
    const [first, second] = items.slice(-2);
    assert.ok(first && second);
    assert.equal(first.group, second.group);
    const family = families.find(f => f.id === first.group);
    assert.ok(family);
    assert.ok(family.questionIds.includes(first.questionId) && family.questionIds.includes(second.questionId));
    assert.deepEqual([first.kind, second.kind], ["new", "new"]);
    assert.equal(items.filter(i => i.group !== undefined).length, 2);
    for (const c of [{ count: 5 }, { questionIds: ["q001", "q002"] }]) {
        const s = run(createLearner(morning), { kind: "start_study", requestId: requestId(), ...c }, morning);
        assert.equal(s.sessions.at(-1)?.items.some(i => i.group !== undefined), false, "an exact count or question list gets no pair");
    }
});

test("both pair questions are shown and answered before either verdict, and each is covered once", () => {
    const daily = dailyLesson();
    const reached = playToPair(daily.state, daily.sessionId);
    const pair = reached.view.pair;
    assert.ok(pair);
    const family = families.find(f => f.id === pair.familyId);
    assert.ok(family);
    assert.deepEqual([pair.group, pair.title, pair.axes, pair.status], [family.id, family.title, family.comparisonAxes, "draft"]);
    const [a, b] = pair.questions.map(q => q.id);
    assert.ok(a && b);
    assert.deepEqual(pair.feedback, [null, null]);
    assert.equal(reached.view.steps.pairGroups, 1);
    // The second question is accepted first; the first stays active until answered.
    const half = executeLearning(reached.state, { kind: "answer_study", requestId: requestId(), sessionId: daily.sessionId, questionId: b, answer: wrong(b) }, morning + MINUTE);
    assert.ok(half.view.kind === "study");
    assert.equal(half.view.question?.id, a);
    assert.deepEqual(half.view.pair?.feedback, [null, null], "no verdict until both are answered");
    assert.equal(half.view.currentFeedback, null);
    assert.equal(half.view.lastAward, null);
    assert.equal(half.view.sessionResults.items.some(e => e.questionId === b), false);
    assert.equal(half.view.combo, 11, "the hidden wrong answer does not reset the shown combo yet");
    assert.throws(() => next(half.state, daily.sessionId, morning + MINUTE), /ANSWER_OR_SKIP_FIRST/);
    const both = executeLearning(half.state, { kind: "answer_study", requestId: requestId(), sessionId: daily.sessionId, questionId: a, answer: right(a) }, morning + 2 * MINUTE);
    assert.ok(both.view.kind === "study");
    assert.deepEqual(both.view.pair?.feedback.map(f => f?.correct), [true, false]);
    assert.equal(both.view.sessionResults.answered, 13);
    assert.equal(both.view.combo, 1);
    assert.deepEqual(both.state.sessions.at(-1)?.items.slice(-1).map(i => i.repairOf), [b], "the wrong pair answer gets its repair after the pair");
    let s = next(both.state, daily.sessionId, morning + 3 * MINUTE);
    s = next(answerIn(s, daily.sessionId, b, morning + 4 * MINUTE), daily.sessionId, morning + 4 * MINUTE);
    assert.equal(s.sessions.at(-1)?.status, "complete");
    assert.equal(courseView(s, morning + 5 * MINUTE).covered, 13);
    assert.equal(s.evidence.filter(e => e.kind === "answer" && e.questionId === a).length, 1, "the moved question is answered once");
});

test("the text ChatGPT receives for a pair holds both verdicts until both answers are in", () => {
    const daily = dailyLesson();
    const reached = playToPair(daily.state, daily.sessionId);
    const [a, b] = reached.view.pair?.questions.map(q => q.id) ?? [];
    assert.ok(a && b);
    const opening = learningText(reached.view, "https://example.test");
    assert.ok(opening.includes(`${a}: `) && opening.includes(`${b}: `), "both questions are shown");
    assert.match(opening, /do not judge an answer or call next_study_question until both are submitted/);
    const half = executeLearning(reached.state, { kind: "answer_study", requestId: requestId(), sessionId: daily.sessionId, questionId: a, answer: wrong(a) }, morning + MINUTE);
    const halfText = learningText(half.view, "https://example.test");
    assert.ok(halfText.includes(`${a}: đã trả lời`));
    assert.equal(/Kết quả q\d{3}:/.test(halfText), false, "no verdict yet");
    assert.equal(halfText.includes(`sai: ${a}`), false, "the session summary does not reveal it either");
    const both = executeLearning(half.state, { kind: "answer_study", requestId: requestId(), sessionId: daily.sessionId, questionId: b, answer: right(b) }, morning + 2 * MINUTE);
    const bothText = learningText(both.view, "https://example.test");
    assert.ok(bothText.includes(`Kết quả ${a}: Sai`) && bothText.includes(`Kết quả ${b}: Đúng`));
    assert.match(bothText, /Call next_study_question/);
});

test("skipping a pair requeues both questions together", () => {
    const daily = dailyLesson();
    const reached = playToPair(daily.state, daily.sessionId);
    const ids = reached.view.pair?.questions.map(q => q.id);
    const skipped = run(reached.state, { kind: "skip_study", requestId: requestId(), sessionId: daily.sessionId }, morning + MINUTE);
    assert.deepEqual(skipped.sessions.at(-1)?.items.slice(-2).map(i => i.questionId), ids);
    assert.equal(skipped.sessions.at(-1)?.status, "paused");
});

/** A learner who answered the first n bank questions correctly at `at`. */
function answered(n: number, at = morning) {
    let s = createLearner(at);
    for (const q of bankQuestions.slice(0, n).map(q => q.questionId))
        s = run(s, { kind: "answer_question", requestId: requestId(), questionId: q, answer: right(q) }, at);
    return s;
}
function lightning(state: LearnerState, now: number, id = requestId()) {
    const result = executeLearning(state, { kind: "start_lightning", requestId: id }, now);
    assert.ok(result.view.kind === "study");
    return { state: result.state, view: result.view, sessionId: result.view.sessionId };
}

test("a lightning round takes up to 30 distinct seen questions in an order seeded by the request", () => {
    assert.throws(() => executeLearning(createLearner(morning), { kind: "start_lightning", requestId: requestId() }, morning), /LIGHTNING_NEEDS_HISTORY/);
    const seen = answered(40);
    const seenIds = new Set(bankQuestions.slice(0, 40).map(q => q.questionId));
    const id = requestId();
    const round = lightning(seen, morning + MINUTE, id);
    const items = round.state.sessions.at(-1)?.items ?? [];
    assert.equal(items.length, 30);
    assert.equal(new Set(items.map(i => i.questionId)).size, 30);
    assert.ok(items.every(i => seenIds.has(i.questionId) && i.kind === "practice"));
    assert.deepEqual([round.view.mode, round.view.deadline, round.view.remainingMs, round.view.serverNow], ["lightning", morning + 2 * MINUTE, MINUTE, morning + MINUTE]);
    const again = lightning(seen, morning + MINUTE, id);
    assert.deepEqual(again.state.sessions.at(-1)?.items.map(i => i.questionId), items.map(i => i.questionId), "the same request gives the same order");
    const other = lightning(seen, morning + MINUTE);
    assert.notDeepEqual(other.state.sessions.at(-1)?.items.map(i => i.questionId), items.map(i => i.questionId));
    const daily = executeLearning(round.state, { kind: "start_study", requestId: requestId() }, morning + MINUTE).view;
    assert.ok(daily.kind === "course" && daily.nothingToStudy, "the daily lesson never reopens a lightning round");
});

test("lightning answers are scored attempts worth 1 XP each up to 15 a round, with mastery bonuses on top and no repairs", () => {
    const seen = answered(20);
    const round = lightning(seen, morning + DAY);
    const sessionId = round.sessionId;
    let s = round.state;
    const order = s.sessions.at(-1)?.items.map(i => i.questionId) ?? [];
    for (const [i, q] of order.entries()) {
        s = answerIn(s, sessionId, q, morning + DAY + i * 1000, i === 0 ? wrong(q) : right(q));
        if (i < order.length - 1)
            s = next(s, sessionId, morning + DAY + i * 1000);
    }
    assert.equal(s.sessions.at(-1)?.items.length, 20, "a wrong lightning answer adds no repair step");
    const facts = s.evidence.filter(e => e.kind === "answer" && e.activityId === sessionId);
    assert.ok(facts.every(e => e.kind === "answer" && e.origin === "study"));
    const awards = facts.map(e => answerAwards(s).get(e.id));
    assert.deepEqual(awards[0], { xp: 0, reason: "lightning", masteredNow: false });
    assert.equal(questionProgress(s).get(order[0] ?? "")?.successes, 0, "the wrong answer lapses the question as usual");
    assert.ok(awards.slice(1).every(a => a?.reason === "lightning" && a.masteredNow), "due recalls master the other 19");
    assert.equal(awards.reduce((sum, a) => sum + (a?.xp ?? 0) - (a?.masteredNow ? 15 : 0), 0), 15, "1 XP per correct answer, at most 15 a round");
    const view = study(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning + DAY + 30000);
    assert.deepEqual([view.correctCount, view.wrongItems], [19, [order[0]]]);
});

test("an answer after the 60 seconds is rejected and records nothing, and the round closes", async () => {
    const store = new SqliteLearningStore(":memory:");
    let now = morning;
    const runtime = new LearningRuntime(store, "learner-a", () => now);
    for (const q of ["q001", "q002"])
        await runtime.command({ kind: "answer_question", requestId: requestId(), questionId: q, answer: right(q) });
    const round = await runtime.command({ kind: "start_lightning", requestId: requestId() });
    assert.ok(round.kind === "study" && round.question);
    const before = await store.load("learner-a");
    now = morning + MINUTE;
    await assert.rejects(runtime.command({ kind: "answer_study", requestId: requestId(), sessionId: round.sessionId, questionId: round.question.id, answer: right(round.question.id) }), /LIGHTNING_EXPIRED/);
    assert.deepEqual(await store.load("learner-a"), before, "nothing was saved");
    const closed = await runtime.session(round.sessionId);
    assert.deepEqual([closed.status, closed.remainingMs, closed.question, closed.correctCount], ["complete", 0, null, 0]);
    assert.equal((await store.load("learner-a"))?.state.sessions.at(-1)?.status, "complete", "reading after the deadline saves the closed round");
    const resumed = await runtime.command({ kind: "resume_study", requestId: requestId(), sessionId: round.sessionId });
    assert.ok(resumed.kind === "study");
    assert.equal(resumed.status, "complete", "an ended round cannot be resumed");
    store.close();
});

test("a lightning round reveals the right answers to its mistakes only once it is over", () => {
    const seen = answered(3);
    const round = lightning(seen, morning + DAY);
    const sessionId = round.sessionId;
    const order = round.state.sessions.at(-1)?.items.map(i => i.questionId) ?? [];
    const [first] = order;
    assert.ok(first);
    const missed = executeLearning(round.state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: first, answer: wrong(first) }, morning + DAY + 1000);
    assert.ok(missed.view.kind === "study");
    assert.equal(missed.view.review, null, "no answer key while the round runs");
    const running = next(missed.state, sessionId, morning + DAY + 2000);
    assert.equal(study(running, { kind: "resume_study", requestId: requestId(), sessionId }, morning + DAY + 3000).review, null);
    const over = study(running, { kind: "resume_study", requestId: requestId(), sessionId }, morning + DAY + MINUTE);
    assert.equal(over.status, "complete");
    assert.deepEqual(over.review?.map(r => [r.question.id, r.chosen, r.correctAnswer]), [[first, wrong(first), right(first)]]);
    assert.equal("correctAnswer" in (over.review?.[0]?.question ?? {}), false, "the question itself carries no key");
    let early = running;
    for (const q of order.slice(1)) early = next(answerIn(early, sessionId, q, morning + DAY + 5000), sessionId, morning + DAY + 5000);
    const done = study(early, { kind: "resume_study", requestId: requestId(), sessionId }, morning + DAY + 6000);
    assert.deepEqual([done.status, done.review?.length], ["complete", 1], "answering every question early also ends the round");
});
