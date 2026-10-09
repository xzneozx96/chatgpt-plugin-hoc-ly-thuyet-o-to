import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning, importLegacyAttempts, lessonMeta, questionProgress, courseView, listUnits, todayMistakes, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { safeQuestion, bankQuestions, families } from "../src/domain/course.js";
import { submitAnswer, type AnswerId } from "../src/domain/quiz.js";
const clock = Date.parse("2026-10-05T16:55:00Z");
const requestId = () => randomUUID();
const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const wrong = (q: string) => safeQuestion(q).options.find(o => o.id !== right(q))?.id ?? "A";
function run(state: LearnerState, c: LearningCommand, now: number) {
    return executeLearning(state, c, now).state;
}
function answer(state: LearnerState, q: string, now: number, selected: AnswerId = right(q), confidence: "guess" | "confident" | "unknown" = "unknown") {
    state = run(state, {
        kind: "start_study",
        requestId: requestId(),
        questionIds: [q]
    }, now);
    const s = state.sessions.at(-1);
    assert.ok(s);
    return run(state, {
        kind: "answer_study",
        requestId: requestId(),
        sessionId: s.id,
        questionId: q,
        answer: selected,
        confidence
    }, now);
}
function helpedAnswer(state: LearnerState, q: string, now: number, selected: AnswerId = right(q)) {
    state = run(state, { kind: "start_study", requestId: requestId(), questionIds: [q] }, now);
    const s = state.sessions.at(-1);
    assert.ok(s);
    state = run(state, { kind: "record_help", requestId: requestId(), sessionId: s.id, questionId: q }, now);
    return run(state, { kind: "answer_study", requestId: requestId(), sessionId: s.id, questionId: q, answer: selected }, now);
}
const p = (s: LearnerState, q = "q001") => questionProgress(s).get(q);
test("a wrong lesson answer adds no repair item and queues the question for the next day", () => {
    for (const ids of [["q001", "q002", "q003"], ["q001"]]) {
        let state = run(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ids }, clock);
        const sessionId = state.sessions.at(-1)!.id;
        const missed = executeLearning(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: wrong("q001") }, clock + 1000);
        if (missed.view.kind !== "study") assert.fail("expected study view");
        assert.deepEqual(missed.view.queue.map(i => i.questionId), ids, "no repair step joins the queue");
        assert.deepEqual(missed.state.sessions.at(-1)!.items.map(i => i.questionId), ids);
        assert.deepEqual(p(missed.state), { learned: false, stage: 0, dueAt: clock + 1000 + DAY, coveredAt: clock + 1000, coveredDay: p(missed.state)?.coveredDay ?? null, confused: false, lastWrong: true });
        state = run(missed.state, { kind: "next_study", requestId: requestId(), sessionId }, clock + 2000);
        assert.equal(state.sessions.at(-1)!.activeQuestionId, ids.length > 1 ? "q002" : null);
    }
});
test("first-try clean correct is learned at once and never queued", () => {
    const s = answer(createLearner(clock), "q001", clock);
    assert.equal(p(s)?.learned, true);
    assert.equal(p(s)?.dueAt, null);
    assert.equal(p(s)?.stage, 0);
    assert.equal(courseView(s, clock).covered, 1);
    assert.equal(courseView(s, clock + 400 * DAY).dueCount, 0);
});
test("a first answer that is wrong, guessed or helped is queued for tomorrow", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    s = answer(s, "q002", clock + 1, right("q002"), "guess");
    s = helpedAnswer(s, "q003", clock + 3);
    for (const [q, at] of [["q001", 0], ["q002", 1], ["q003", 3]] as const) {
        assert.equal(p(s, q)?.learned, false, q);
        assert.equal(p(s, q)?.stage, 0, q);
        assert.equal(p(s, q)?.dueAt, clock + at + DAY, q);
    }
    assert.equal(courseView(s, clock + 3).covered, 3);
});
test("a wrong answer re-queues a learned question and one that is queued but not yet due", () => {
    let s = answer(createLearner(clock), "q001", clock);
    s = answer(s, "q001", clock + 2 * DAY, wrong("q001"));
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 0, clock + 3 * DAY]);
    s = answer(s, "q001", clock + 2 * DAY + 3600000, wrong("q001"));
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 0, clock + 3 * DAY + 3600000], "the schedule restarts from the latest wrong answer");
});
test("a queued question is reviewed after 1, 3, 7 and 14 days and graduates on the fourth success", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    let at = clock;
    const steps: [number, number][] = [[1, 3], [3, 7], [7, 14]];
    let stage = 0;
    for (const [wait, next] of steps) {
        at += wait * DAY;
        s = answer(s, "q001", at);
        stage++;
        assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, stage, at + next * DAY]);
    }
    at += 14 * DAY;
    s = answer(s, "q001", at);
    assert.deepEqual([p(s)?.learned, p(s)?.dueAt], [true, null]);
    assert.equal(courseView(s, at + 100 * DAY).dueCount, 0, "learned questions get no recall reviews");
});
test("a wrong, guessed or helped answer during a review resets the schedule to step 0", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    s = answer(s, "q001", clock + DAY);
    s = answer(s, "q001", clock + 4 * DAY);
    assert.deepEqual([p(s)?.stage, p(s)?.dueAt], [2, clock + 11 * DAY]);
    const wrongAt = answer(s, "q001", clock + 11 * DAY, wrong("q001"));
    assert.deepEqual([p(wrongAt)?.learned, p(wrongAt)?.stage, p(wrongAt)?.dueAt], [false, 0, clock + 12 * DAY]);
    const guessed = answer(s, "q001", clock + 11 * DAY, right("q001"), "guess");
    assert.deepEqual([p(guessed)?.learned, p(guessed)?.stage, p(guessed)?.dueAt], [false, 0, clock + 12 * DAY]);
    const helped = helpedAnswer(s, "q001", clock + 11 * DAY + 1);
    assert.deepEqual([p(helped)?.learned, p(helped)?.stage, p(helped)?.dueAt], [false, 0, clock + 12 * DAY + 1]);
});
test("a clean answer before the review is due changes nothing", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    const before = p(s);
    s = answer(s, "q001", clock + 10 * 60000);
    assert.equal(p(s)?.stage, before?.stage);
    assert.equal(p(s)?.dueAt, before?.dueAt);
    assert.equal(p(s)?.learned, false);
    s = answer(s, "q001", clock + DAY + 10 * 60000);
    assert.deepEqual([p(s)?.stage, p(s)?.dueAt], [1, clock + 4 * DAY + 10 * 60000]);
});
test("coverage forecast begins empty and keeps custom eight incompatible", () => {
    let s = createLearner(clock);
    assert.equal(courseView(s, clock).covered, 0);
    assert.equal(courseView(s, clock).requiredStudyDays, 50);
    assert.equal(courseView(s, clock).bufferDays, 10);
    s = run(s, {
        kind: "update_profile",
        requestId: requestId(),
        dailyGoal: 8
    }, clock);
    assert.equal(courseView(s, clock).requiredStudyDays, 75);
    assert.equal(courseView(s, clock).targetCompatible, false);
    assert.equal(listUnits(s, "", clock).customCategory.familyCount, 245);
});
test("every wrong answer re-queues individual learning and help moves nothing", () => {
    let s = answer(createLearner(clock), "q001", clock);
    s = answer(s, "q001", clock + DAY);
    s = answer(s, "q002", clock + DAY);
    assert.equal(p(s)?.learned, true);
    s = run(s, { kind: "record_help", requestId: requestId(), questionId: "q001" }, clock + 2 * DAY);
    assert.equal(p(s)?.learned, true, "help alone does not unlearn");
    assert.equal(p(s)?.dueAt, null);
    s = answer(s, "q001", clock + 2 * DAY, wrong("q001"));
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 0, clock + 3 * DAY]);
    assert.equal(p(s, "q002")?.learned, true);
    s = answer(s, "q001", clock + 3 * DAY);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 1, clock + 6 * DAY]);
    s = answer(s, "q001", clock + 6 * DAY);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 2, clock + 13 * DAY]);
});
test("help during the first answer and guesses stop the first encounter counting", () => {
    let s = helpedAnswer(createLearner(clock), "q001", clock + 1000);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 0, clock + 1000 + DAY]);
    s = answer(s, "q001", clock + DAY + 1000);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 1, clock + 4 * DAY + 1000]);
    s = answer(s, "q002", clock, right("q002"), "guess");
    assert.deepEqual([p(s, "q002")?.learned, p(s, "q002")?.dueAt], [false, clock + DAY]);
    assert.equal(courseView(s, clock).covered, 2);
});
test("confusion queues a learned question, stays through correct reviews and clearing keeps the schedule", () => {
    let s = answer(createLearner(clock), "q001", clock);
    assert.equal(p(s)?.dueAt, null);
    s = run(s, { kind: "set_confusion", requestId: requestId(), questionId: "q001", enabled: true }, clock + DAY);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt, p(s)?.confused], [false, 0, clock + 2 * DAY, true]);
    s = answer(s, "q001", clock + 2 * DAY);
    assert.equal(p(s)?.confused, true);
    assert.deepEqual([p(s)?.stage, p(s)?.dueAt], [1, clock + 5 * DAY]);
    s = answer(s, "q001", clock + 5 * DAY, wrong("q001"));
    const due = p(s)?.dueAt;
    assert.equal(due, clock + 6 * DAY);
    s = run(s, { kind: "set_confusion", requestId: requestId(), questionId: "q001", enabled: false }, clock + 5 * DAY);
    assert.equal(p(s)?.dueAt, due);
    assert.equal(p(s)?.confused, false);
    assert.equal(p(s)?.learned, false);
});
test("a gap queues a learned question for tomorrow", () => {
    const { state, m } = mockState(answer(createLearner(clock), "q001", clock), clock + 1000);
    const q = "q001";
    if (!m.questionIds.includes(q)) m.questionIds[0] = q;
    const s = run(state, { kind: "finalise_mock", requestId: requestId(), attemptId: m.id, confirmUnanswered: true }, clock + 2000);
    assert.deepEqual([p(s, q)?.learned, p(s, q)?.stage, p(s, q)?.dueAt], [false, 0, clock + 2000 + DAY]);
});
test("replay is idempotent and changed payload conflicts; wrong does not cycle queue", () => {
    let s = createLearner(clock);
    const start: LearningCommand = {
        kind: "start_study",
        requestId: requestId(),
        questionIds: ["q001"]
    };
    s = run(s, start, clock);
    const session = s.sessions.at(-1);
    assert.ok(session);
    const c: LearningCommand = {
        kind: "answer_study",
        requestId: requestId(),
        sessionId: session.id,
        questionId: "q001",
        answer: wrong("q001")
    };
    s = run(s, c, clock);
    const count = s.evidence.length;
    s = run(s, c, clock + DAY);
    assert.equal(s.evidence.length, count);
    assert.throws(() => run(s, {
        ...c,
        answer: right("q001")
    }, clock), /REQUEST_CONFLICT/);
    s = run(s, {
        kind: "next_study",
        requestId: requestId(),
        sessionId: session.id
    }, clock);
    assert.equal(s.sessions.at(-1)?.status, "complete");
    assert.equal(p(s)?.dueAt, clock + DAY);
});
test("feedback keeps answered question bound until explicit next; no answer leaks at start", () => {
    let s = run(createLearner(clock), {
        kind: "start_study",
        requestId: requestId(),
        questionIds: ["q001", "q002"]
    }, clock);
    const ss = s.sessions.at(-1);
    assert.ok(ss);
    const initial = executeLearning(s, {
        kind: "resume_study",
        requestId: requestId(),
        sessionId: ss.id
    }, clock).view;
    assert.ok(initial.kind === "study");
    assert.equal(initial.currentFeedback, null);
    assert.equal(initial.help, null);
    assert.equal("correctAnswer" in (initial.question ?? {}), false);
    const response = executeLearning(s, {
        kind: "answer_study",
        requestId: requestId(),
        sessionId: ss.id,
        questionId: "q001",
        answer: right("q001")
    }, clock);
    assert.ok(response.view.kind === "study");
    assert.equal(response.view.question?.id, "q001");
    assert.equal(response.view.currentFeedback?.questionId, "q001");
    s = run(response.state, {
        kind: "next_study",
        requestId: requestId(),
        sessionId: ss.id
    }, clock);
    assert.equal(s.sessions.at(-1)?.activeQuestionId, "q002");
});
function mockState(state: LearnerState, now: number) {
    state = run(state, {
        kind: "start_mock",
        requestId: requestId(),
        mode: "random"
    }, now);
    const m = state.mocks.at(-1);
    assert.ok(m);
    return {
        state,
        m
    };
}
test("provisional choices never score; expiry publishes once and unanswered remains gaps", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    let s = state;
    const q = m.questionIds[0];
    assert.ok(q);
    s = run(s, {
        kind: "save_mock_choice",
        requestId: requestId(),
        attemptId: m.id,
        questionId: q,
        answer: wrong(q)
    }, clock + 1000);
    s = run(s, {
        kind: "save_mock_choice",
        requestId: requestId(),
        attemptId: m.id,
        questionId: q,
        answer: right(q)
    }, clock + 2000);
    assert.equal(s.evidence.length, 0);
    s = run(s, {
        kind: "view_mock",
        requestId: requestId(),
        attemptId: m.id
    }, m.deadline);
    assert.equal(s.evidence.filter(e => e.kind === "answer").length, 1);
    assert.equal(s.evidence.filter(e => e.kind === "gap").length, 29);
    assert.equal(courseView(s, m.deadline).covered, 1);
    const n = s.evidence.length;
    s = run(s, {
        kind: "finalise_mock",
        requestId: requestId(),
        attemptId: m.id
    }, m.deadline + DAY);
    assert.equal(s.evidence.length, n);
    assert.equal(s.mocks.at(-1)?.status, "finalised");
});
test("abandon preserves provisional history and adds no coverage", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    let s = state;
    const q = m.questionIds[0];
    assert.ok(q);
    s = run(s, {
        kind: "save_mock_choice",
        requestId: requestId(),
        attemptId: m.id,
        questionId: q,
        answer: right(q)
    }, clock);
    s = run(s, {
        kind: "abandon_mock",
        requestId: requestId(),
        attemptId: m.id
    }, clock);
    assert.equal(s.evidence.length, 0);
    assert.equal(s.mocks.at(-1)?.status, "abandoned");
    assert.throws(() => run(s, {
        kind: "finalise_mock",
        requestId: requestId(),
        attemptId: m.id
    }, clock), /MOCK_ABANDONED/);
});
test("late finalisation replays the earlier wrong before the later answers and cannot fake a graduation", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    let s = state;
    const q = m.questionIds[0];
    assert.ok(q);
    s = run(s, {
        kind: "save_mock_choice",
        requestId: requestId(),
        attemptId: m.id,
        questionId: q,
        answer: wrong(q)
    }, clock + 1000);
    s = answer(s, q, clock + DAY + 2000);
    s = answer(s, q, clock + 4 * DAY + 2000);
    s = run(s, {
        kind: "finalise_mock",
        requestId: requestId(),
        attemptId: m.id
    }, clock + 5 * DAY);
    assert.deepEqual([p(s, q)?.learned, p(s, q)?.stage, p(s, q)?.dueAt], [false, 2, clock + 11 * DAY + 2000], "wrong (queued +1d), due review at +1d (step 1), due review at +4d (step 2)");
    const history = s.evidence.filter(e => e.questionId === q && e.kind === "answer");
    assert.equal(history.length, 3);
});
test("critical errors and unanswered critical items fail deterministic score", () => {
    const ids = bankQuestions.filter(q => q.applicableLicenses.includes("B")).slice(0, 30).map(q => q.questionId);
    const critical = bankQuestions.find(q => q.isCritical);
    assert.ok(critical);
    ids[0] = critical.questionId;
    const distinct = [...new Set(ids)];
    while (distinct.length < 30) {
        const other = bankQuestions.find(q => !distinct.includes(q.questionId));
        assert.ok(other);
        distinct.push(other.questionId);
    }
    const { state, m } = mockState(createLearner(clock), clock);
    let s = state;
    m.questionIds = distinct;
    for (const q of distinct)
        s = run(s, {
            kind: "save_mock_choice",
            requestId: requestId(),
            attemptId: m.id,
            questionId: q,
            answer: q === critical.questionId ? wrong(q) : right(q)
        }, clock + 1000);
    s = run(s, {
        kind: "finalise_mock",
        requestId: requestId(),
        attemptId: m.id
    }, clock + 2000);
    const result = s.mocks.at(-1);
    assert.ok(result?.status === "finalised");
    assert.equal(result.score, 29);
    assert.equal(result.passed, false);
    assert.deepEqual(result.criticalFailures, [critical.questionId]);
});
test('timezone edits cannot make an early answer count as a due review',()=>{let s=answer(createLearner(clock),'q001',clock,wrong('q001'));s=run(s,{kind:'update_profile',requestId:requestId(),timezone:'America/Los_Angeles'},clock+1000);s=answer(s,'q001',clock+60_000);assert.deepEqual([p(s)?.learned,p(s)?.stage,p(s)?.dueAt],[false,0,clock+DAY]);});
test('reviewOnly freezes all due items and skip cannot bypass unresolved review into new coverage',()=>{let s=answer(createLearner(clock),'q001',clock,wrong('q001'));s=run(s,{kind:'start_study',requestId:requestId(),reviewOnly:true},clock+DAY);const ss=s.sessions.at(-1);assert.ok(ss);assert.equal(ss.items.length,1);assert.equal(ss.items[0]?.kind,'review');s=run(s,{kind:'skip_study',requestId:requestId(),sessionId:ss.id},clock+DAY);assert.equal(s.sessions.at(-1)?.status,'paused');assert.equal(s.sessions.at(-1)?.items[0]?.status,'pending');assert.equal(p(s)?.dueAt,clock+DAY);});
test('help does not move the due date, and a helped review answer resets to step 0',()=>{let s=answer(createLearner(clock),'q001',clock,wrong('q001'));s=run(s,{kind:'start_study',requestId:requestId(),reviewOnly:true},clock+DAY);const ss=s.sessions.at(-1);assert.ok(ss);s=run(s,{kind:'record_help',requestId:requestId(),sessionId:ss.id,questionId:'q001'},clock+DAY);assert.equal(p(s)?.dueAt,clock+DAY);s=run(s,{kind:'resume_study',requestId:requestId(),sessionId:ss.id},clock+DAY);assert.equal(s.sessions.at(-1)?.items[0]?.status,'pending');s=run(s,{kind:'answer_study',requestId:requestId(),sessionId:ss.id,questionId:'q001',answer:right('q001')},clock+DAY);assert.deepEqual([p(s)?.learned,p(s)?.stage,p(s)?.dueAt],[false,0,clock+2*DAY]);});
test('direct original-question scoring shares coverage and idempotency',()=>{const c:LearningCommand={kind:'answer_question',requestId:requestId(),questionId:'q001',answer:right('q001')};let response=executeLearning(createLearner(clock),c,clock);assert.equal(response.view.kind,'answer');assert.equal(courseView(response.state,clock).covered,1);const n=response.state.evidence.length;response=executeLearning(response.state,c,clock+DAY);assert.equal(response.state.evidence.length,n);assert.equal(response.view.kind,'answer');});
test("a choice made in time but delayed past the deadline still counts, once, and only within the grace window", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    const [first, second, third] = m.questionIds;
    assert.ok(first && second && third);
    let s = run(state, { kind: "save_mock_choice", requestId: requestId(), attemptId: m.id, questionId: first, answer: right(first) }, clock + 1000);
    s = run(s, { kind: "view_mock", requestId: requestId(), attemptId: m.id }, m.deadline + 1000);
    assert.equal(s.evidence.filter(e => e.kind === "gap").length, 29, "the test closed at its deadline with 29 gaps");
    const late = (state: LearnerState, questionId: string, extra: { leftMs?: number }, at: number) =>
        run(state, { kind: "save_mock_choice", requestId: requestId(), attemptId: m.id, questionId, answer: right(questionId), ...extra }, at);
    assert.throws(() => late(s, second, {}, m.deadline + 2000), /MOCK_NOT_ACTIVE/, "a late save without proof it was made in time is refused");
    assert.throws(() => late(s, second, { leftMs: 3000 }, m.deadline + 31000), /MOCK_NOT_ACTIVE/, "a save past the grace window is refused");
    s = late(s, second, { leftMs: 3000 }, m.deadline + 2000);
    const closed = s.mocks.find(x => x.id === m.id);
    assert.deepEqual([closed?.status, closed?.status === "finalised" ? closed.reason : null, closed?.status === "finalised" ? closed.closedAt : null], ["finalised", "expiry", m.deadline]);
    assert.equal(closed?.status === "finalised" ? closed.score : null, 2);
    assert.equal(s.evidence.filter(e => e.kind === "gap").length, 28);
    assert.equal(s.evidence.filter(e => e.kind === "answer" && e.activityId === m.id).length, 2, "each answer is recorded once after the re-close");
    const changed = run(s, { kind: "save_mock_choice", requestId: requestId(), attemptId: m.id, questionId: second, answer: wrong(second), leftMs: 1000 }, m.deadline + 3000);
    const closedAgain = changed.mocks.find(x => x.id === m.id);
    assert.equal(closedAgain?.status === "finalised" ? closedAgain.score : null, 1, "a last-second change of answer replaces the earlier choice");
    assert.equal(changed.evidence.filter(e => e.kind === "answer" && e.activityId === m.id).length, 2, "and each answer is still recorded once");
});
test("any command first finalises an expired mock at its deadline so review-first sees its results", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    const q = m.questionIds[0];
    assert.ok(q);
    let s = run(state, { kind: "save_mock_choice", requestId: requestId(), attemptId: m.id, questionId: q, answer: wrong(q) }, clock + 1000);
    s = run(s, { kind: "record_help", requestId: requestId(), questionId: q }, m.deadline + 1000);
    const closed = s.mocks.find(x => x.id === m.id);
    assert.equal(closed?.status, "finalised");
    assert.equal(closed?.status === "finalised" ? closed.closedAt : null, m.deadline);
    s = run(s, { kind: "start_study", requestId: requestId() }, m.deadline + 25 * 3600000);
    const session = s.sessions.at(-1);
    assert.equal(session?.items.find(i => i.questionId === q)?.kind, "review");
    assert.equal(session?.items[0]?.kind, "review");
});
test("a running mock question cannot be answered or explained through study", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ["q001"] }, clock);
    const session = s.sessions.at(-1);
    assert.ok(session);
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock + 1000);
    const m = s.mocks.at(-1);
    assert.ok(m);
    if (!m.questionIds.includes("q001")) m.questionIds[0] = "q001";
    assert.throws(() => run(s, { kind: "answer_study", requestId: requestId(), sessionId: session.id, questionId: "q001", answer: wrong("q001") }, clock + 2000), /MOCK_IN_PROGRESS/);
    assert.throws(() => run(s, { kind: "answer_question", requestId: requestId(), questionId: "q001", answer: wrong("q001") }, clock + 2000), /MOCK_IN_PROGRESS/);
    assert.throws(() => run(s, { kind: "record_help", requestId: requestId(), questionId: "q001" }, clock + 2000), /MOCK_IN_PROGRESS/);
});
test("default study and mock starts resume the open activity instead of duplicating it", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId() }, clock);
    const daily = s.sessions.at(-1);
    assert.ok(daily);
    s = run(s, { kind: "pause_study", requestId: requestId(), sessionId: daily.id }, clock + 1000);
    s = run(s, { kind: "start_study", requestId: requestId() }, clock + 2000);
    assert.equal(s.sessions.length, 1);
    assert.equal(s.sessions[0]?.status, "active");
    const nothingDue = executeLearning(s, { kind: "start_study", requestId: requestId(), reviewOnly: true }, clock + 3000);
    assert.ok(nothingDue.view.kind === "course" && nothingDue.view.nothingToStudy, "nothing due says so instead of saving an empty session");
    s = run(nothingDue.state, { kind: "start_study", requestId: requestId(), unitId: "bien_bao" }, clock + 4000);
    assert.equal(s.sessions.length, 2);
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock + 5000);
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock + 6000);
    assert.equal(s.mocks.length, 1);
    s = run(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, (s.mocks[0]?.deadline ?? 0) + 1);
    assert.equal(s.mocks.length, 2);
    assert.equal(s.mocks[0]?.status, "finalised");
});
test("answer feedback and explicit help never move the due date; a helped review answer resets it", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    s = answer(s, "q001", clock + 23 * 3600000);
    assert.equal(p(s)?.dueAt, clock + DAY, "feedback and an early clean answer change nothing");
    let h = run(s, { kind: "record_help", requestId: requestId(), questionId: "q001" }, clock + 23 * 3600000);
    assert.equal(p(h)?.dueAt, clock + DAY, "help does not move the due date");
    s = answer(s, "q001", clock + DAY + 5 * 60000);
    assert.deepEqual([p(s)?.learned, p(s)?.stage, p(s)?.dueAt], [false, 1, clock + 4 * DAY + 5 * 60000]);
    h = helpedAnswer(h, "q001", clock + DAY + 5 * 60000);
    assert.deepEqual([p(h)?.learned, p(h)?.stage, p(h)?.dueAt], [false, 0, clock + 2 * DAY + 5 * 60000]);
});
test("imported legacy answers are scheduled for review rather than stranded", () => {
    const s = importLegacyAttempts(createLearner(clock), [{ id: "legacy-1", questionId: "q001", selectedAnswer: right("q001"), createdAt: clock }]);
    assert.notEqual(p(s)?.dueAt, null);
    const later = run(s, { kind: "start_study", requestId: requestId() }, clock + 400 * DAY);
    assert.equal(later.sessions.at(-1)?.items[0]?.questionId, "q001");
    assert.equal(later.sessions.at(-1)?.items[0]?.kind, "review");
});
test("returning to an open session keeps the answered question's feedback until next", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId() }, clock);
    const daily = s.sessions.at(-1);
    assert.ok(daily);
    const q = daily.activeQuestionId;
    assert.ok(q);
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId: daily.id, questionId: q, answer: wrong(q) }, clock + 1000);
    const again = executeLearning(s, { kind: "start_study", requestId: requestId() }, clock + 2000);
    assert.equal(again.state.sessions.at(-1)?.activeQuestionId, q);
    assert.notEqual("currentFeedback" in again.view ? again.view.currentFeedback : null, null);
    s = run(again.state, { kind: "pause_study", requestId: requestId(), sessionId: daily.id }, clock + 3000);
    const resumed = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId: daily.id }, clock + 4000);
    assert.equal(resumed.state.sessions.at(-1)?.activeQuestionId, q);
    assert.equal(resumed.state.sessions.at(-1)?.status, "active");
    assert.notEqual("currentFeedback" in resumed.view ? resumed.view.currentFeedback : null, null);
});
test("saved feedback says whether the answer was a guess or followed help, so a reopened card shows the same verdict", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ["q001", "q002"] }, clock);
    const ss = s.sessions.at(-1);
    assert.ok(ss);
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId: ss.id, questionId: "q001", answer: right("q001"), confidence: "guess" }, clock + 1000);
    const guessed = executeLearning(s, { kind: "resume_study", requestId: requestId(), sessionId: ss.id }, clock + 2000).view;
    assert.ok(guessed.kind === "study");
    assert.equal(guessed.currentFeedback?.confidence, "guess");
    assert.equal(guessed.currentFeedback?.assisted, false);
    assert.notEqual(guessed.help, null, "the server records feedback as help, so help alone cannot mark an answer assisted");
    s = run(s, { kind: "next_study", requestId: requestId(), sessionId: ss.id }, clock + 3000);
    s = run(s, { kind: "record_help", requestId: requestId(), sessionId: ss.id, questionId: "q002" }, clock + 4000);
    const helped = executeLearning(s, { kind: "answer_study", requestId: requestId(), sessionId: ss.id, questionId: "q002", answer: right("q002") }, clock + 5000).view;
    assert.ok(helped.kind === "study");
    assert.equal(helped.currentFeedback?.assisted, true);
    assert.equal(helped.currentFeedback?.confidence, "unknown");
});
test("course and session views report right and wrong answers from saved evidence", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ["q001", "q002", "q003"] }, clock);
    const session = s.sessions.at(-1);
    assert.ok(session);
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId: session.id, questionId: "q001", answer: right("q001") }, clock + 1000);
    s = run(s, { kind: "next_study", requestId: requestId(), sessionId: session.id }, clock + 2000);
    const view = executeLearning(s, { kind: "answer_study", requestId: requestId(), sessionId: session.id, questionId: "q002", answer: wrong("q002") }, clock + 3000);
    assert.ok(view.view.kind === "study");
    assert.deepEqual(view.view.sessionResults, { answered: 2, correct: 1, wrong: 1, items: [{ questionId: "q001", answer: right("q001"), correct: true }, { questionId: "q002", answer: wrong("q002"), correct: false }] });
    const course = courseView(view.state, clock + 4000);
    assert.deepEqual(course.results, { totalAttempts: 2, correctAttempts: 1, wrongAttempts: 1, accuracyPercent: 50 });
    assert.deepEqual(course.recentAnswers.map(a => [a.questionId, a.correct]), [["q002", false], ["q001", true]]);
});
test("starting a mock while one runs says it resumed, and a later start shuffles a new test", () => {
    const first = executeLearning(createLearner(clock), { kind: "start_mock", requestId: requestId(), mode: "random" }, clock);
    assert.ok(first.view.kind === "mock");
    assert.equal(first.view.resumed, false);
    const again = executeLearning(first.state, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock + 60000);
    assert.ok(again.view.kind === "mock");
    assert.equal(again.view.resumed, true);
    assert.equal(again.view.attemptId, first.view.attemptId);
    const abandoned = run(again.state, { kind: "abandon_mock", requestId: requestId(), attemptId: first.view.attemptId }, clock + 120000);
    const fresh = executeLearning(abandoned, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock + 180000);
    assert.ok(fresh.view.kind === "mock");
    assert.equal(fresh.view.resumed, false);
    assert.notDeepEqual(fresh.view.questions.map(q => q.id), first.view.questions.map(q => q.id), "a new test is a new shuffle");
});
test("the custom confusing-question category starts a session of the requested size, grouped by family", () => {
    const s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), unitId: "de_nham_lan", count: 5 }, clock);
    const items = s.sessions.at(-1)?.items.map(i => i.questionId) ?? [];
    assert.equal(items.length, 5);
    const firstFamily = families[0];
    assert.ok(firstFamily);
    assert.deepEqual(items.slice(0, Math.min(5, firstFamily.questionIds.length)), firstFamily.questionIds.slice(0, 5), "siblings in one family come together");
    const daily = run(createLearner(clock), { kind: "start_study", requestId: requestId(), count: 3 }, clock);
    assert.equal(daily.sessions.at(-1)?.items.length, 3);
});
test("unit listings carry counts instead of every question ID, and explicit sessions stay tidy", () => {
    const units = listUnits(createLearner(clock), "", clock).units;
    const signs = units.find(u => u.id === "bien_bao");
    assert.ok(signs);
    assert.equal(signs.questionCount, 185);
    assert.equal(typeof signs.firstQuestionId, "string");
    assert.equal("questionIds" in signs, false);
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId() }, clock);
    s = run(s, { kind: "start_study", requestId: requestId(), count: 5 }, clock + 1000);
    assert.equal(s.sessions.length, 2, "a requested count starts its own session even with the daily one open");
    assert.equal(s.sessions.at(-1)?.items.length, 5);
    s = run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 3 }, clock + 2000);
    assert.deepEqual(s.sessions.map(x => [x.override, x.status]), [[false, "active"], [true, "paused"], [true, "active"]]);
});
test("a running mock keeps its questions out of study and finished mocks report no time left", () => {
    const { state, m } = mockState(createLearner(clock), clock);
    const q = m.questionIds[0];
    assert.ok(q);
    const other = bankQuestions.map(x => x.questionId).find(id => !m.questionIds.includes(id));
    assert.ok(other);
    let s = run(state, { kind: "start_study", requestId: requestId(), questionIds: [q, other] }, clock + 1000);
    assert.deepEqual(s.sessions.at(-1)?.items.map(i => i.questionId), [other], "mock questions are left out of new study sessions");
    s = run(s, { kind: "finalise_mock", requestId: requestId(), attemptId: m.id, confirmUnanswered: true }, clock + 2000);
    const view = executeLearning(s, { kind: "view_mock", requestId: requestId(), attemptId: m.id }, clock + 3000).view;
    assert.ok(view.kind === "mock");
    assert.equal(view.remainingMs, 0);
    assert.throws(() => run(s, { kind: "abandon_mock", requestId: requestId(), attemptId: m.id }, clock + 4000), /MOCK_NOT_ACTIVE/);
});

test("the confusing-question category counts its due reviews, and a closed mock says when it closed", () => {
    const s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    assert.equal(listUnits(s, "", clock).customCategory.due, 0);
    assert.equal(listUnits(s, "", clock + DAY).customCategory.due, 1, "q001 belongs to a confusing-question family");
    const started = executeLearning(s, { kind: "start_mock", requestId: requestId(), mode: "random" }, clock);
    assert.ok(started.view.kind === "mock");
    assert.equal(started.view.closedAt, null);
    const done = executeLearning(started.state, { kind: "finalise_mock", requestId: requestId(), attemptId: started.view.attemptId, confirmUnanswered: true }, clock + 5 * 60000).view;
    assert.ok(done.kind === "mock");
    assert.equal(done.closedAt, clock + 5 * 60000);
});

test("today's mistakes list each wrong question once with its latest choice, the bank key and explanation, and leave yesterday out", () => {
    const yesterday = clock; // 23:55 in Vietnam
    const today = clock + 2 * 3600000; // 01:55 the next day
    const noText = bankQuestions.find(q => !q.explanation)?.questionId ?? "";
    let s = answer(createLearner(yesterday), "q010", yesterday, wrong("q010"));
    s = answer(s, "q011", today, wrong("q011"));
    s = answer(s, "q012", today, right("q012"));
    s = answer(s, noText, today + 60000, wrong(noText));
    s = answer(s, "q011", today + 120000, wrong("q011"));
    const before = JSON.stringify(s);
    const items = todayMistakes(s, today + 180000);
    assert.deepEqual(items.map(i => i.question.id), ["q011", noText], "newest first, one entry per question, no correct or earlier-day answers");
    assert.deepEqual([items[0]?.chosen, items[0]?.correctAnswer], [wrong("q011"), right("q011")]);
    assert.equal(items[0]?.explanation, bankQuestions.find(q => q.questionId === "q011")?.explanation);
    assert.equal(items[1]?.explanation, null, "a question without bank text says so rather than showing a fallback sentence");
    assert.equal(courseView(s, today + 180000).wrongToday, 2);
    assert.equal(JSON.stringify(s), before, "reviewing mistakes records nothing");
});

test("onTheWay counts queued questions that are not learned, and nextLearnAt is the earliest due among them", () => {
    const MINUTE = 60000;
    let s = createLearner(clock);
    for (const [i, q] of ["q001", "q002", "q003"].entries())
        s = answer(s, q, clock + i * MINUTE, wrong(q));
    s = answer(s, "q004", clock + 3 * MINUTE);
    const today = courseView(s, clock + 5 * MINUTE);
    assert.deepEqual([today.learned, today.onTheWay, today.nextLearnAt], [1, 3, clock + DAY], "q004 was learned first try; three wrong answers are queued");
    const units = listUnits(s, "", clock + 5 * MINUTE);
    assert.equal(units.units.filter(u => u.kind === "category").reduce((sum, u) => sum + u.onTheWay, 0), 3, "each category counts its own");
    assert.equal(units.customCategory.onTheWay, 3, "q001 to q003 are all in confusing-question families");
    s = answer(s, "q001", clock + DAY);
    const reviewed = courseView(s, clock + DAY + MINUTE);
    assert.deepEqual([reviewed.learned, reviewed.onTheWay, reviewed.nextLearnAt], [1, 3, clock + MINUTE + DAY], "one correct review does not graduate q001");
    let at = clock + DAY;
    for (const wait of [3, 7, 14]) {
        at += wait * DAY;
        s = answer(s, "q001", at);
    }
    const graduated = courseView(s, at + MINUTE);
    assert.deepEqual([graduated.learned, graduated.onTheWay, graduated.nextLearnAt], [2, 2, clock + MINUTE + DAY], "the fourth correct due review graduates q001");
    assert.equal(p(s)?.dueAt, null);
    s = answer(s, "q002", at + 2 * MINUTE, wrong("q002"));
    const lapsed = courseView(s, at + 3 * MINUTE);
    assert.deepEqual([lapsed.learned, lapsed.onTheWay, lapsed.nextLearnAt], [2, 2, clock + 2 * MINUTE + DAY], "a wrong answer re-queues q002 but it was already on the way");
    s = run(s, { kind: "record_help", requestId: requestId(), questionId: "q003" }, at + 4 * MINUTE);
    assert.equal(p(s, "q003")?.dueAt, clock + 2 * MINUTE + DAY, "help does not move the due date");
});

test("lesson keys cover the open queue and stop once the lesson completes", () => {
    const started = executeLearning(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ["q001", "q002", "q003"] }, clock);
    if (started.view.kind !== "study") assert.fail("expected study view");
    const sessionId = started.view.sessionId;
    const keys = lessonMeta(started.state, sessionId, clock)?.lessonKeys;
    assert.deepEqual(Object.entries(keys ?? {}).map(([id, key]) => [id, key.correctAnswer]), [["q001", "B"], ["q002", "B"], ["q003", "A"]]);
    assert.match(keys?.q001?.explanation ?? "", /phần đường xe chạy/);
    const missed = executeLearning(started.state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: "A" }, clock + 1000);
    if (missed.view.kind !== "study") assert.fail("expected study view");
    assert.deepEqual(missed.view.queue.map(i => i.questionId), ["q001", "q002", "q003"], "a wrong answer adds no repair item to the queue");
    assert.deepEqual(Object.keys(lessonMeta(missed.state, sessionId, clock + 1000)?.lessonKeys ?? {}), ["q001", "q002", "q003"]);
    let state = missed.state;
    for (const [at, q] of [[2, "q002"], [4, "q003"]] as const) {
        state = run(state, { kind: "next_study", requestId: requestId(), sessionId }, clock + at * 1000);
        state = run(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: q, answer: right(q) }, clock + at * 1000 + 500);
    }
    const done = executeLearning(state, { kind: "next_study", requestId: requestId(), sessionId }, clock + 8000);
    if (done.view.kind !== "study") assert.fail("expected study view");
    assert.equal(done.view.status, "complete");
    assert.equal(lessonMeta(done.state, sessionId, clock + 8000), null);
});

const ids = (s: LearnerState) => s.sessions.at(-1)?.items.map(i => i.questionId) ?? [];
test("a topic start is refused while reviews are due, unless reviewOnly or explicit questions", () => {
    const s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    assert.throws(() => run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao" }, clock + DAY), /REVIEWS_DUE/);
    assert.throws(() => run(s, { kind: "start_study", requestId: requestId(), count: 5 }, clock + DAY), /REVIEWS_DUE/);
    assert.throws(() => run(s, { kind: "start_study", requestId: requestId(), override: true }, clock + DAY), /REVIEWS_DUE/);
    const early = run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 2 }, clock + DAY - 1);
    assert.equal(ids(early).length, 2, "nothing is due yet");
    const explicit = run(s, { kind: "start_study", requestId: requestId(), questionIds: ["q002"] }, clock + DAY);
    assert.deepEqual(ids(explicit), ["q002"]);
    const review = run(s, { kind: "start_study", requestId: requestId(), reviewOnly: true }, clock + DAY);
    assert.deepEqual(ids(review), ["q001"]);
});
test("a topic start takes only never-answered questions, and all remaining when fewer than requested", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 3 }, clock);
    const first = ids(s);
    assert.equal(first.length, 3);
    const sessionId = s.sessions.at(-1)!.id;
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: first[0]!, answer: right(first[0]!) }, clock + 1000);
    s = run(s, { kind: "next_study", requestId: requestId(), sessionId }, clock + 1500);
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: first[1]!, answer: wrong(first[1]!) }, clock + 2000);
    const next = run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 3 }, clock + 3000);
    const second = ids(next);
    assert.equal(second.length, 3);
    assert.deepEqual(second.filter(q => first.slice(0, 2).includes(q)), [], "answered questions are skipped");
    assert.equal(second[0], first[2], "the remaining never-answered question comes first, in bank order");
    let all = run(createLearner(clock), { kind: "start_study", requestId: requestId(), unitId: "cau_tao", count: 35 }, clock);
    const covered = ids(all);
    assert.equal(covered.length, 35);
    const sid = all.sessions.at(-1)!.id;
    for (const [i, q] of covered.entries()) {
        if (i) all = run(all, { kind: "next_study", requestId: requestId(), sessionId: sid }, clock + i * 1000);
        all = run(all, { kind: "answer_study", requestId: requestId(), sessionId: sid, questionId: q, answer: right(q) }, clock + i * 1000 + 500);
    }
    assert.equal(courseView(all, clock + 40000).dueCount, 0);
    const rest = run(all, { kind: "start_study", requestId: requestId(), unitId: "cau_tao", count: 10 }, clock + 40000);
    assert.equal(ids(rest).length, 2, "cau_tao has 37 questions: fewer than requested takes the 2 remaining never-answered ones");
    assert.deepEqual(ids(rest).filter(q => covered.includes(q)), []);
    assert.equal(rest.sessions.at(-1)?.items.every(i => i.kind === "new"), true);
});
test("practice replays already-answered questions of the pool instead of new ones", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 3 }, clock);
    const first = ids(s);
    const sessionId = s.sessions.at(-1)!.id;
    for (const [i, q] of first.entries()) {
        if (i) s = run(s, { kind: "next_study", requestId: requestId(), sessionId }, clock + i * 1000);
        s = run(s, { kind: "answer_study", requestId: requestId(), sessionId, questionId: q, answer: right(q) }, clock + i * 1000 + 500);
    }
    const practice = run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 2, practice: true }, clock + 5000);
    assert.deepEqual(ids(practice), first.slice(0, 2));
    assert.equal(practice.sessions.at(-1)?.items.every(i => i.kind === "practice"), true);
    const before = courseView(practice, clock + 5000).covered;
    assert.equal(before, 3, "practice adds no first-pass coverage");
});
test("count alone starts an extra batch of never-answered questions from the whole bank", () => {
    const s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), count: 4 }, clock);
    assert.deepEqual(ids(s), ["q001", "q002", "q003", "q004"]);
    assert.equal(s.sessions.at(-1)?.override, true);
});
test("a no-argument start reopens the latest open topic session instead of starting the daily one", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId(), unitId: "bien_bao", count: 3 }, clock);
    const topic = s.sessions.at(-1)!;
    assert.equal(topic.override, true);
    s = run(s, { kind: "pause_study", requestId: requestId(), sessionId: topic.id }, clock + 1000);
    const resumed = executeLearning(s, { kind: "start_study", requestId: requestId() }, clock + 2000);
    assert.equal(resumed.state.sessions.length, 1);
    assert.equal(resumed.state.sessions[0]?.id, topic.id);
    assert.equal(resumed.state.sessions[0]?.status, "active");
    assert.ok(resumed.view.kind === "study");
    assert.equal(resumed.view.sessionId, topic.id);
});

test("an unfinished extra session does not hide due reviews: Học tiếp starts the daily one and Tiếp tục only returns once reviews are done", () => {
    let s = answer(createLearner(clock), "q001", clock, wrong("q001"));
    s = run(s, { kind: "start_study", requestId: requestId(), count: 5 }, clock + 1000);
    const extra = s.sessions.at(-1)!;
    assert.equal(extra.override, true);
    assert.equal(courseView(s, clock + 2000).openSession?.id, extra.id, "nothing is due yet, so the extra session can be resumed");
    assert.equal(courseView(s, clock + DAY + 5000).dueCount, 1);
    assert.equal(courseView(s, clock + DAY + 5000).openSession, null, "a due review hides the extra session's Tiếp tục");
    const next = run(s, { kind: "start_study", requestId: requestId() }, clock + DAY + 5000);
    const daily = next.sessions.at(-1)!;
    assert.notEqual(daily.id, extra.id);
    assert.equal(daily.items[0]?.questionId, "q001");
    assert.equal(daily.items[0]?.kind, "review");
});
