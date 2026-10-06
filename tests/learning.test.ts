import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning, importLegacyAttempts, questionProgress, courseView, listUnits, DAY, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { safeQuestion, bankQuestions } from "../src/domain/course.js";
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
    assert.equal(listUnits(s, "", clock).customCategory.familyCount, 249);
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
    const { state, m } = mockState(createLearner(clock), clock);
    const q = m.questionIds[0];
    assert.ok(q);
    const s = run(state, { kind: "start_study", requestId: requestId(), questionIds: [q] }, clock + 1000);
    const session = s.sessions.at(-1);
    assert.ok(session);
    assert.throws(() => run(s, { kind: "answer_study", requestId: requestId(), sessionId: session.id, questionId: q, answer: wrong(q) }, clock + 2000), /MOCK_IN_PROGRESS/);
    assert.throws(() => run(s, { kind: "answer_question", requestId: requestId(), questionId: q, answer: wrong(q) }, clock + 2000), /MOCK_IN_PROGRESS/);
    assert.throws(() => run(s, { kind: "record_help", requestId: requestId(), questionId: q }, clock + 2000), /MOCK_IN_PROGRESS/);
});
test("default study and mock starts resume the open activity instead of duplicating it", () => {
    let s = run(createLearner(clock), { kind: "start_study", requestId: requestId() }, clock);
    const daily = s.sessions.at(-1);
    assert.ok(daily);
    s = run(s, { kind: "pause_study", requestId: requestId(), sessionId: daily.id }, clock + 1000);
    s = run(s, { kind: "start_study", requestId: requestId() }, clock + 2000);
    assert.equal(s.sessions.length, 1);
    assert.equal(s.sessions[0]?.status, "active");
    s = run(s, { kind: "start_study", requestId: requestId(), reviewOnly: true }, clock + 3000);
    s = run(s, { kind: "start_study", requestId: requestId(), unitId: "bien_bao" }, clock + 4000);
    assert.equal(s.sessions.length, 3);
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
