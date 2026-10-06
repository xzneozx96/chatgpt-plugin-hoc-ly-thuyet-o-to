import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, courseView, executeLearning, LearnerStateSchema, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { answerAwards, leagueWeek, sessionCombo, xpSummary } from "../src/domain/game.js";
import { safeQuestion, bankQuestions } from "../src/domain/course.js";
import { submitAnswer, type AnswerId } from "../src/domain/quiz.js";

const clock = Date.parse("2026-10-05T16:55:00Z");
// Tuesday 10:00 in Vietnam, far from any local midnight.
const morning = Date.parse("2026-10-06T03:00:00Z");
const MINUTE = 60000;
const requestId = () => randomUUID();
const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const wrong = (q: string) => safeQuestion(q).options.find(o => o.id !== right(q))?.id ?? "A";
const run = (state: LearnerState, c: LearningCommand, now: number) => executeLearning(state, c, now).state;
const next = (state: LearnerState, sessionId: string, now: number) => run(state, { kind: "next_study", requestId: requestId(), sessionId }, now);
function lesson(state: LearnerState, questionIds: string[], now: number) {
    state = run(state, { kind: "start_study", requestId: requestId(), questionIds }, now);
    const session = state.sessions.at(-1);
    assert.ok(session);
    return { state, sessionId: session.id };
}
function answerIn(state: LearnerState, sessionId: string, q: string, now: number, selected: AnswerId = right(q)) {
    return run(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: q, answer: selected }, now);
}
/** Answers q once in its own one-question lesson, after asking for help when helped, and returns the state and that answer's award. */
function answer(state: LearnerState, q: string, now: number, selected: AnswerId = right(q), helped = false) {
    const started = lesson(state, [q], now);
    state = helped ? run(started.state, { kind: "record_help", requestId: requestId(), sessionId: started.sessionId, questionId: q }, now) : started.state;
    state = answerIn(state, started.sessionId, q, now, selected);
    const fact = state.evidence.filter(e => e.kind === "answer").at(-1);
    assert.ok(fact);
    return { state, award: answerAwards(state).get(fact.id) };
}

// A learner saved before the game layer existed: no league, session mode, repair, group or answer links.
const storedBeforeGame = {
    version: 1,
    policyVersion: "recall-1",
    createdAt: clock,
    nextOrder: 2,
    profile: { timezone: "Asia/Ho_Chi_Minh", dailyGoal: 12, targetDate: clock + 60 * 86400000, studyWeekdays: [0, 1, 2, 3, 4, 5, 6] },
    evidence: [
        { id: "11111111-1111-4111-8111-111111111111", questionId: "q001", at: clock, localDay: "2026-10-05", sequence: 0, kind: "answer", answer: "A", correct: false, assisted: false, confidence: "unknown", origin: "study", activityId: "22222222-2222-4222-8222-222222222222" },
        { id: "33333333-3333-4333-8333-333333333333", questionId: "q001", at: clock, localDay: "2026-10-05", sequence: 1, kind: "help", feedback: true }
    ],
    sessions: [{
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: clock,
        status: "active",
        override: true,
        reviewOnly: false,
        unitId: null,
        items: [{ questionId: "q001", kind: "new", status: "answered", bindingAt: clock }, { questionId: "q002", kind: "new", status: "pending", bindingAt: clock }],
        activeQuestionId: "q001"
    }],
    mocks: [],
    receipts: {}
};

test("a learner stored before the game layer still parses and keeps studying", () => {
    const state = LearnerStateSchema.parse(structuredClone(storedBeforeGame));
    assert.equal(state.league, null);
    assert.equal(state.sessions[0]?.mode, "lesson");
    assert.equal(state.sessions[0]?.activeRepair, false);
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const { view } = executeLearning(state, { kind: "resume_study", requestId: requestId(), sessionId }, clock + 1000);
    assert.ok(view.kind === "study");
    assert.equal(view.currentFeedback?.questionId, "q001", "an old answered item still shows its feedback");
    const next = executeLearning(state, { kind: "next_study", requestId: requestId(), sessionId }, clock + 2000);
    assert.equal(next.state.sessions[0]?.activeQuestionId, "q002");
    assert.equal(xpSummary(next.state, clock + 3000).total, 3, "its earlier wrong first answer earns 3");
});

test("first answers and due reviews earn 10 when right and 3 when wrong, and mastering adds 15", () => {
    let r = answer(createLearner(morning), "q001", morning);
    assert.deepEqual(r.award, { xp: 10, reason: "first_correct", masteredNow: false });
    r = answer(r.state, "q002", morning, wrong("q002"));
    assert.deepEqual(r.award, { xp: 3, reason: "first_wrong", masteredNow: false });
    r = answer(r.state, "q001", morning + DAY);
    assert.deepEqual(r.award, { xp: 25, reason: "review_correct", masteredNow: true }, "a second qualifying recall masters q001");
    r = answer(r.state, "q002", morning + DAY, wrong("q002"));
    assert.deepEqual(r.award, { xp: 3, reason: "review_wrong", masteredNow: false });
    assert.equal(xpSummary(r.state, morning + DAY).total, 10 + 3 + 25 + 3);
});

test("an answer after help earns 3 whether right or wrong", () => {
    let r = answer(createLearner(morning), "q001", morning, right("q001"), true);
    assert.deepEqual(r.award, { xp: 3, reason: "assisted", masteredNow: false });
    r = answer(r.state, "q002", morning + MINUTE, wrong("q002"), true);
    assert.deepEqual(r.award, { xp: 3, reason: "assisted", masteredNow: false });
    r = answer(r.state, "q001", morning + DAY, right("q001"), true);
    assert.deepEqual(r.award, { xp: 3, reason: "assisted", masteredNow: false }, "help before a due review earns 3, not 10");
});

test("practice on questions that are not due earns 2, capped at 50 XP per learner-local day", () => {
    let r = answer(createLearner(morning), "q001", morning);
    const practice: number[] = [];
    for (let i = 1; i <= 27; i++) {
        r = answer(r.state, "q001", morning + i * MINUTE);
        assert.equal(r.award?.reason, "practice");
        practice.push(r.award?.xp ?? -1);
    }
    assert.deepEqual(practice, [...Array<number>(25).fill(2), 0, 0]);
    r = answer(r.state, "q001", morning + 31 * MINUTE, right("q001"), true);
    assert.deepEqual(r.award, { xp: 0, reason: "assisted", masteredNow: false }, "assisted practice shares the daily cap");
    r = answer(r.state, "q001", morning + 14 * 3600000);
    assert.deepEqual(r.award, { xp: 2, reason: "practice", masteredNow: false }, "the next local day has a fresh cap");
});

test("mock answers earn nothing each; a finalised mock earns 20, a pass 30 more, and an abandoned one nothing", () => {
    let s = run(createLearner(morning), { kind: "start_mock", requestId: requestId(), mode: "random" }, morning);
    const mock = s.mocks.at(-1);
    assert.ok(mock);
    for (const q of mock.questionIds)
        s = run(s, { kind: "save_mock_choice", requestId: requestId(), attemptId: mock.id, questionId: q, answer: right(q) }, morning + MINUTE);
    s = run(s, { kind: "finalise_mock", requestId: requestId(), attemptId: mock.id }, morning + 2 * MINUTE);
    assert.equal(answerAwards(s).size, 0);
    assert.equal(xpSummary(s, morning + 3 * MINUTE).total, 50);
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, morning + 4 * MINUTE);
    const failed = s.mocks.at(-1);
    assert.ok(failed);
    s = run(s, { kind: "finalise_mock", requestId: requestId(), attemptId: failed.id, confirmUnanswered: true }, morning + 5 * MINUTE);
    assert.equal(xpSummary(s, morning + 6 * MINUTE).total, 70, "a failed finalised mock earns 20");
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, morning + 7 * MINUTE);
    const left = s.mocks.at(-1);
    assert.ok(left);
    s = run(s, { kind: "abandon_mock", requestId: requestId(), attemptId: left.id }, morning + 8 * MINUTE);
    assert.equal(xpSummary(s, morning + 9 * MINUTE).total, 70);
});

test("replaying the same answer request adds no XP", () => {
    const started = lesson(createLearner(morning), ["q001", "q002"], morning);
    const command: LearningCommand = { kind: "answer_study", requestId: requestId(), sessionId: started.sessionId, questionId: "q001", answer: right("q001") };
    const once = run(started.state, command, morning + MINUTE);
    const twice = run(once, command, morning + 2 * MINUTE);
    assert.equal(xpSummary(twice, morning + 3 * MINUTE).total, 10);
    assert.deepEqual(xpSummary(twice, morning + 3 * MINUTE), xpSummary(once, morning + 3 * MINUTE));
});

test("the combo counts consecutive correct answers and resets after a wrong one", () => {
    const qs = ["q001", "q002", "q003", "q004"];
    const started = lesson(createLearner(morning), qs, morning);
    const sessionId = started.sessionId;
    let s = started.state;
    const combos: number[] = [];
    for (const [i, q] of qs.entries()) {
        s = answerIn(s, sessionId, q, morning + i * MINUTE, i === 2 ? wrong(q) : right(q));
        const view = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning + i * MINUTE).view;
        assert.ok(view.kind === "study");
        combos.push(view.combo);
        assert.equal(view.combo, sessionCombo(s, sessionId));
        s = run(s, { kind: "next_study", requestId: requestId(), sessionId }, morning + i * MINUTE);
    }
    assert.deepEqual(combos, [1, 2, 0, 1]);
});

test("the study view reports session XP, the latest award, the step kind and the lesson plan", () => {
    const started = lesson(createLearner(morning), ["q001", "q002"], morning);
    const sessionId = started.sessionId;
    let s = started.state;
    const start = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning).view;
    assert.ok(start.kind === "study");
    assert.deepEqual([start.xp, start.lastAward, start.itemKind, start.repairOf, start.mode], [0, null, "new", null, "lesson"]);
    assert.deepEqual(start.steps, { review: 0, new: 2, practice: 0, pairGroups: 0 });
    s = answerIn(s, sessionId, "q001", morning + MINUTE);
    s = run(s, { kind: "next_study", requestId: requestId(), sessionId }, morning + MINUTE);
    const done = executeLearning(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q002", answer: right("q002") }, morning + 2 * MINUTE);
    assert.ok(done.view.kind === "study");
    assert.deepEqual(done.view.lastAward, { xp: 10, reason: "first_correct", masteredNow: false, baseXp: 10, bonusXp: 0 });
    assert.equal(done.view.xp, 20);
    const finished = executeLearning(done.state, { kind: "next_study", requestId: requestId(), sessionId }, morning + 3 * MINUTE).view;
    assert.ok(finished.kind === "study" && finished.status === "complete");
    assert.equal(finished.xp, 20, "a lesson under 5 answers earns no finish bonus");
});

test("finishing a lesson of at least 5 answers adds 10", () => {
    const ids = ["q001", "q002", "q003", "q004", "q005"];
    const started = lesson(createLearner(morning), ids, morning);
    const sessionId = started.sessionId;
    let s = started.state;
    ids.forEach((id, i) => {
        s = answerIn(s, sessionId, id, morning + (2 * i + 1) * MINUTE);
        s = run(s, { kind: "next_study", requestId: requestId(), sessionId }, morning + (2 * i + 2) * MINUTE);
    });
    const finished = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, morning + 20 * MINUTE).view;
    assert.ok(finished.kind === "study" && finished.status === "complete");
    assert.equal(finished.xp, 5 * 10 + 10);
});

test("a finished daily lesson keeps its bonus when it reopens for newly due reviews", () => {
    let s = answer(createLearner(morning), "q001", morning, wrong("q001")).state;
    s = answer(s, "q002", morning + 2 * 3600000, wrong("q002")).state;
    const reviewAt = morning + DAY + 3600000;
    s = run(s, { kind: "start_study", requestId: requestId(), reviewOnly: true }, reviewAt);
    const review = s.sessions.at(-1);
    assert.ok(review);
    assert.deepEqual(review.items.map(i => i.questionId), ["q001"], "q002 is not due yet");
    s = next(answerIn(s, review.id, "q001", reviewAt), review.id, reviewAt);
    assert.equal(s.sessions.at(-1)?.status, "complete");
    const finished = xpSummary(s, reviewAt);
    assert.equal(finished.total, 3 + 3 + 10 + 10);
    s = run(s, { kind: "resume_study", requestId: requestId(), sessionId: review.id }, morning + DAY + 3 * 3600000);
    assert.equal(s.sessions.at(-1)?.status, "active", "q002 is now due and joins the reopened lesson");
    assert.deepEqual(xpSummary(s, morning + DAY + 3 * 3600000), finished, "XP never decreases");
});

test("today follows the learner's timezone, the week runs Monday to Sunday in Vietnam time, and over 500 XP in a day is flagged", () => {
    assert.deepEqual(leagueWeek(Date.parse("2026-10-11T16:59:59Z")), { weekStartsAt: Date.parse("2026-10-04T17:00:00Z"), weekEndsAt: Date.parse("2026-10-11T17:00:00Z") - 1 });
    assert.equal(leagueWeek(Date.parse("2026-10-11T17:00:00Z")).weekStartsAt, Date.parse("2026-10-11T17:00:00Z"));
    // Sunday 23:30 in Vietnam is Sunday 18:30 in Paris.
    const sundayNight = Date.parse("2026-10-11T16:30:00Z");
    let s = run(createLearner(sundayNight), { kind: "update_profile", requestId: requestId(), timezone: "Europe/Paris" }, sundayNight);
    s = run(s, { kind: "answer_question", requestId: requestId(), questionId: "q001", answer: right("q001") }, sundayNight);
    const mondayInVietnam = Date.parse("2026-10-11T17:30:00Z");
    assert.deepEqual([xpSummary(s, mondayInVietnam).today, xpSummary(s, mondayInVietnam).week], [10, 0], "still Sunday in Paris, but a new league week");
    let busy = createLearner(morning);
    for (const q of bankQuestions.slice(0, 50).map(q => q.questionId))
        busy = run(busy, { kind: "answer_question", requestId: requestId(), questionId: q, answer: right(q) }, morning);
    assert.equal(xpSummary(busy, morning).suspicious, false, "500 XP in a day is allowed");
    const q51 = bankQuestions[50]?.questionId ?? "";
    busy = run(busy, { kind: "answer_question", requestId: requestId(), questionId: q51, answer: right(q51) }, morning);
    assert.equal(xpSummary(busy, morning).suspicious, true);
    assert.equal(xpSummary(busy, morning + 8 * DAY).suspicious, false, "a heavy day only flags its own league week");
});

test("the course view carries the XP summary and what comes back tomorrow", () => {
    const evening = Date.parse("2026-10-06T13:00:00Z"); // 20:00 in Vietnam
    let s = answer(createLearner(evening), "q001", evening, wrong("q001")).state;
    s = answer(s, "q002", evening).state;
    const course = courseView(s, evening + MINUTE);
    assert.equal(course.xp.total, 3 + 10);
    assert.equal(course.tomorrowDue, 2, "both answers come back tomorrow evening");
    assert.equal(courseView(s, evening + DAY).tomorrowDue, 0, "once due they count as due now, not tomorrow");
    assert.equal(courseView(s, evening + DAY).dueCount, 2);
    assert.equal(courseView(s, evening - 2 * DAY).tomorrowDue, 0, "due two days later is not tomorrow");
});

test("the study view splits a mastery award and counts mastered, guessed, assisted and skipped answers for the finish screen", () => {
    const at = morning + DAY;
    let s = answer(createLearner(morning), "q001", morning).state;
    const started = lesson(s, ["q001", "q002", "q003", "q004"], at);
    const sessionId = started.sessionId;
    const mastered = executeLearning(started.state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: right("q001") }, at);
    assert.ok(mastered.view.kind === "study");
    assert.deepEqual(mastered.view.lastAward, { xp: 25, reason: "review_correct", masteredNow: true, baseXp: 10, bonusXp: 15 });
    s = next(mastered.state, sessionId, at);
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q002", answer: right("q002"), confidence: "guess" }, at);
    s = next(s, sessionId, at);
    s = run(s, { kind: "skip_study", requestId: requestId(), sessionId }, at);
    const skippedView = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, at).view;
    assert.ok(skippedView.kind === "study");
    assert.deepEqual([skippedView.question?.id, skippedView.skippedCount, skippedView.skippedPending], ["q004", 1, 1]);
    s = run(s, { kind: "record_help", requestId: requestId(), sessionId, questionId: "q004" }, at);
    s = next(answerIn(s, sessionId, "q004", at), sessionId, at);
    s = next(answerIn(s, sessionId, "q003", at, wrong("q003")), sessionId, at);
    const finished = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, at + MINUTE).view;
    assert.ok(finished.kind === "study" && finished.status === "complete");
    assert.deepEqual([finished.masteredCount, finished.guessedCount, finished.assistedCount, finished.skippedCount, finished.skippedPending], [1, 1, 1, 1, 0]);
    const course = courseView(s, at + MINUTE);
    assert.deepEqual(finished.goal, { newToday: course.newToday, dailyGoal: course.dailyGoal, dueCount: course.dueCount, tomorrowDue: course.tomorrowDue, onTheWay: course.onTheWay, nextLearnAt: course.nextLearnAt });
    assert.deepEqual([finished.goal.newToday, finished.goal.tomorrowDue], [3, 3], "q002 to q004 are new today and come back tomorrow; mastered q001 waits three days");
});

test("the study view counts this lesson's first-time correct answers that count toward Đã thuộc", () => {
    // q005 was answered before this lesson, and help on q004 was recorded before it.
    let s = answer(createLearner(morning), "q005", morning).state;
    s = run(s, { kind: "record_help", requestId: requestId(), questionId: "q004" }, morning);
    const at = morning + MINUTE;
    const started = lesson(s, ["q001", "q002", "q003", "q004", "q005"], at);
    const sessionId = started.sessionId;
    s = next(answerIn(started.state, sessionId, "q001", at), sessionId, at);
    s = next(run(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q002", answer: right("q002"), confidence: "guess" }, at), sessionId, at);
    s = next(answerIn(s, sessionId, "q003", at, wrong("q003")), sessionId, at);
    s = next(answerIn(s, sessionId, "q004", at), sessionId, at);
    s = next(answerIn(s, sessionId, "q005", at), sessionId, at);
    // The repair step for q003 comes last, and its correct answer is assisted practice.
    s = next(answerIn(s, sessionId, "q003", at), sessionId, at);
    const finished = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId }, at + MINUTE).view;
    assert.ok(finished.kind === "study" && finished.status === "complete");
    assert.deepEqual([finished.firstCorrectCount, finished.masteredCount], [1, 0], "only q001 counts: not the guess, the miss, the question helped before, the one answered earlier or the repair");
    assert.deepEqual([finished.goal.onTheWay, finished.goal.nextLearnAt], [2, morning + DAY], "q001 and the earlier q005 are on the way, q005 back first");
});
