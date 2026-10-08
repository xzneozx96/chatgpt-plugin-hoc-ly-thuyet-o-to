import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning, importLegacyAttempts, lessonKeys, questionProgress, courseView, listUnits, todayMistakes, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
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
const p = (s: LearnerState, q = "q001") => questionProgress(s).get(q);
test("immediate retry preserves the original mistake, reuses one repair and cannot earn mastery", () => {
    for (const ids of [["q001", "q002", "q003"], ["q001"]]) {
        let state = run(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ids }, clock);
        const sessionId = state.sessions.at(-1)!.id;
        state = run(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: wrong("q001") }, clock + 1000);
        const evidence = structuredClone(state.evidence);
        const command: LearningCommand = { kind: "retry_study", requestId: requestId(), sessionId, questionId: "q001" };
        const retried = executeLearning(state, command, clock + 2000);
        assert.equal(retried.view.kind, "study");
        if (retried.view.kind !== "study") assert.fail("expected study view");
        assert.equal(retried.view.repairOf, "q001");
        assert.equal(retried.view.currentFeedback, null);
        assert.equal(retried.view.canRetry, false);
        assert.deepEqual(retried.state.evidence, evidence, "retry navigation does not record another attempt");
        assert.equal(retried.state.sessions.at(-1)!.items.filter(i => i.repairOf === "q001").length, 1);
        assert.deepEqual(executeLearning(retried.state, command, clock + 3000).state, retried.state, "replayed navigation is idempotent");
        const paused = run(retried.state, { kind: "pause_study", requestId: requestId(), sessionId }, clock + 4000);
        const resumed = executeLearning(paused, { kind: "resume_study", requestId: requestId(), sessionId }, clock + 5000);
        if (resumed.view.kind !== "study") assert.fail("expected study view");
        assert.equal(resumed.view.repairOf, "q001", "resume preserves an unfinished immediate repair");
        const corrected = executeLearning(resumed.state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: right("q001") }, clock + DAY);
        if (corrected.view.kind !== "study") assert.fail("expected study view");
        assert.equal(corrected.view.currentFeedback?.assisted, true);
        assert.equal(corrected.view.lastAward?.baseXp, 2);
        assert.equal(corrected.view.canRetry, false);
        assert.equal(p(corrected.state)?.successes, 0);
        assert.throws(() => executeLearning(corrected.state, { ...command, requestId: requestId() }, clock + DAY + 1), /RETRY_NOT_AVAILABLE/);
        state = run(corrected.state, { kind: "next_study", requestId: requestId(), sessionId }, clock + DAY + 2);
        assert.equal(state.sessions.at(-1)!.activeQuestionId, ids.length > 1 ? "q002" : null);
    }
});

test("immediate retry rejects correct feedback and an unrelated question", () => {
    const state = answer(createLearner(clock), "q001", clock);
    const sessionId = state.sessions.at(-1)!.id;
    for (const questionId of ["q001", "q002"]) assert.throws(() => executeLearning(state, { kind: "retry_study", requestId: requestId(), sessionId, questionId }, clock + 1000), /RETRY_NOT_AVAILABLE/);
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
test("midnight and early practice do not advance or move review", () => {
    let s = answer(createLearner(clock), "q001", clock);
    assert.equal(p(s)?.successes, 1);
    const due = p(s)?.dueAt;
    s = answer(s, "q001", clock + 10 * 60000);
    assert.equal(p(s)?.successes, 1);
    assert.equal(p(s)?.dueAt, due);
    s = answer(s, "q001", clock + DAY + 10 * 60000);
    assert.equal(p(s)?.successes, 2);
});
test("every wrong resets individual learning including assisted and before learned", () => {
    let s = answer(createLearner(clock), "q001", clock);
    s = answer(s, "q001", clock + DAY);
    s = answer(s, "q002", clock + DAY);
    s = run(s, {
        kind: "record_help",
        requestId: requestId(),
        questionId: "q001"
    }, clock + 2 * DAY);
    s = answer(s, "q001", clock + 2 * DAY, wrong("q001"));
    assert.equal(p(s)?.successes, 0);
    assert.equal(p(s, "q002")?.successes, 1);
    s = answer(s, "q001", clock + 3 * DAY);
    assert.equal(p(s)?.successes, 1);
    s = answer(s, "q001", clock + 6 * DAY);
    assert.equal(p(s)?.successes, 2);
});
test("prior help across a new session and guesses cannot count first encounter", () => {
    let s = run(createLearner(clock), {
        kind: "record_help",
        requestId: requestId(),
        questionId: "q001"
    }, clock);
    s = answer(s, "q001", clock + 1000);
    assert.equal(p(s)?.successes, 0);
    s = answer(s, "q001", clock + DAY + 1000);
    assert.equal(p(s)?.successes, 1);
    s = answer(s, "q002", clock, right("q002"), "guess");
    assert.equal(p(s, "q002")?.successes, 0);
    assert.equal(courseView(s, clock).covered, 2);
});
test("confusion stays through correct reviews, caps intervals and clearing preserves lapse", () => {
    let s = answer(createLearner(clock), "q001", clock);
    s = answer(s, "q001", clock + DAY);
    s = run(s, {
        kind: "set_confusion",
        requestId: requestId(),
        questionId: "q001",
        enabled: true
    }, clock + DAY);
    assert.equal(p(s)?.dueAt, clock + 2 * DAY);
    s = answer(s, "q001", clock + 2 * DAY);
    assert.equal(p(s)?.confused, true);
    assert.equal(p(s)?.dueAt, clock + 3 * DAY);
    s = answer(s, "q001", clock + 3 * DAY, wrong("q001"));
    const due = p(s)?.dueAt;
    s = run(s, {
        kind: "set_confusion",
        requestId: requestId(),
        questionId: "q001",
        enabled: false
    }, clock + 3 * DAY);
    assert.equal(p(s)?.dueAt, due);
    assert.equal(p(s)?.successes, 0);
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
test("late finalisation replays earlier wrong before later recall and cannot fake delay", () => {
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
    assert.equal(p(s, q)?.successes, 2);
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
test('timezone edits cannot change elapsed eligibility',()=>{let s=answer(createLearner(clock),'q001',clock);s=run(s,{kind:'update_profile',requestId:requestId(),timezone:'America/Los_Angeles'},clock+1000);s=answer(s,'q001',clock+60_000);assert.equal(p(s)?.successes,1);});
test('reviewOnly freezes all due items and skip cannot bypass unresolved review into new coverage',()=>{let s=answer(createLearner(clock),'q001',clock,wrong('q001'));s=run(s,{kind:'start_study',requestId:requestId(),reviewOnly:true},clock+DAY);const ss=s.sessions.at(-1);assert.ok(ss);assert.equal(ss.items.length,1);assert.equal(ss.items[0]?.kind,'review');s=run(s,{kind:'skip_study',requestId:requestId(),sessionId:ss.id},clock+DAY);assert.equal(s.sessions.at(-1)?.status,'paused');assert.equal(s.sessions.at(-1)?.items[0]?.status,'pending');assert.equal(p(s)?.dueAt,clock+DAY);});
test('help-shifted due date does not fabricate completion at resume',()=>{let s=answer(createLearner(clock),'q001',clock,wrong('q001'));s=run(s,{kind:'start_study',requestId:requestId(),reviewOnly:true},clock+DAY);const ss=s.sessions.at(-1);assert.ok(ss);s=run(s,{kind:'record_help',requestId:requestId(),sessionId:ss.id,questionId:'q001'},clock+DAY);s=run(s,{kind:'resume_study',requestId:requestId(),sessionId:ss.id},clock+DAY);assert.equal(s.sessions.at(-1)?.items[0]?.status,'pending');s=run(s,{kind:'answer_study',requestId:requestId(),sessionId:ss.id,questionId:'q001',answer:right('q001')},clock+DAY);assert.equal(p(s)?.successes,0);assert.equal(p(s)?.dueAt,clock+2*DAY);});
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
test("answer feedback does not delay the next due recall, but explicit help still does", () => {
    let s = answer(createLearner(clock), "q001", clock);
    s = answer(s, "q001", clock + 23 * 3600000);
    s = answer(s, "q001", clock + DAY + 5 * 60000);
    assert.equal(p(s)?.successes, 2);
    let h = answer(createLearner(clock), "q001", clock);
    h = run(h, { kind: "record_help", requestId: requestId(), questionId: "q001" }, clock + 23 * 3600000);
    h = answer(h, "q001", clock + DAY + 5 * 60000);
    assert.equal(p(h)?.successes, 1);
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

test("questions with one qualifying success are on the way to Đã thuộc until their due review or a wrong answer", () => {
    const MINUTE = 60000;
    let s = createLearner(clock);
    for (const [i, q] of ["q001", "q002", "q003"].entries())
        s = answer(s, q, clock + i * MINUTE);
    const today = courseView(s, clock + 5 * MINUTE);
    assert.deepEqual([today.learned, today.onTheWay, today.nextLearnAt], [0, 3, clock + DAY], "three first-time correct answers are on the way, the earliest back 24 hours later");
    const units = listUnits(s, "", clock + 5 * MINUTE);
    assert.equal(units.units.filter(u => u.kind === "category").reduce((sum, u) => sum + u.onTheWay, 0), 3, "each category counts its own");
    assert.equal(units.customCategory.onTheWay, 3, "q001 to q003 are all in confusing-question families");
    s = answer(s, "q001", clock + DAY);
    const reviewed = courseView(s, clock + DAY + MINUTE);
    assert.deepEqual([reviewed.learned, reviewed.onTheWay, reviewed.nextLearnAt], [1, 2, clock + MINUTE + DAY], "the due review next day learns q001");
    s = answer(s, "q002", clock + DAY + 2 * MINUTE, wrong("q002"));
    const lapsed = courseView(s, clock + DAY + 3 * MINUTE);
    assert.deepEqual([lapsed.learned, lapsed.onTheWay, lapsed.nextLearnAt], [1, 1, clock + 2 * MINUTE + DAY], "a wrong answer takes q002 off the way");
    // Help after the success lets a review count only 24 hours after the help, later than q003's due time.
    s = run(s, { kind: "record_help", requestId: requestId(), questionId: "q003" }, clock + DAY + 4 * MINUTE);
    assert.equal(p(s, "q003")?.dueAt, clock + 2 * MINUTE + DAY);
    assert.equal(courseView(s, clock + DAY + 5 * MINUTE).nextLearnAt, clock + 4 * MINUTE + 2 * DAY);
    s = answer(s, "q003", clock + DAY + 6 * MINUTE, wrong("q003"));
    const none = courseView(s, clock + DAY + 7 * MINUTE);
    assert.deepEqual([none.onTheWay, none.nextLearnAt], [0, null]);
});

test("lesson keys cover the open queue, repair steps included, and stop once the lesson completes", () => {
    const started = executeLearning(createLearner(clock), { kind: "start_study", requestId: requestId(), questionIds: ["q001", "q002", "q003"] }, clock);
    if (started.view.kind !== "study") assert.fail("expected study view");
    const sessionId = started.view.sessionId;
    const keys = lessonKeys(started.view);
    assert.deepEqual(Object.entries(keys ?? {}).map(([id, key]) => [id, key.correctAnswer]), [["q001", "B"], ["q002", "B"], ["q003", "A"]]);
    assert.match(keys?.q001?.explanation ?? "", /phần đường xe chạy/);
    const missed = executeLearning(started.state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: "q001", answer: "A" }, clock + 1000);
    if (missed.view.kind !== "study") assert.fail("expected study view");
    assert.deepEqual(missed.view.queue.map(i => i.questionId), ["q001", "q002", "q003", "q001"], "the repair step joins the queue");
    assert.deepEqual(Object.keys(lessonKeys(missed.view) ?? {}), ["q001", "q002", "q003"]);
    let state = missed.state;
    for (const [at, q] of [[2, "q002"], [4, "q003"], [6, "q001"]] as const) {
        state = run(state, { kind: "next_study", requestId: requestId(), sessionId }, clock + at * 1000);
        state = run(state, { kind: "answer_study", requestId: requestId(), sessionId, questionId: q, answer: right(q) }, clock + at * 1000 + 500);
    }
    const done = executeLearning(state, { kind: "next_study", requestId: requestId(), sessionId }, clock + 8000);
    if (done.view.kind !== "study") assert.fail("expected study view");
    assert.equal(done.view.status, "complete");
    assert.equal(lessonKeys(done.view), null);
});
