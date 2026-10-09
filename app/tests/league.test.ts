import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearner, executeLearning, type LearnerState, type LearningCommand } from "../src/domain/learning.js";
import { leagueDisplayName } from "../src/domain/league.js";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { createLearningTools } from "../src/learning-tools.js";
import { safeQuestion, bankQuestions } from "../src/domain/course.js";
import { submitAnswer } from "../src/domain/quiz.js";
import { SqliteLearningStore } from "../src/persistence/learning-store.js";

// Tuesday 10:00 in Vietnam.
const morning = Date.parse("2026-10-06T03:00:00Z");
const requestId = () => randomUUID();
const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const run = (state: LearnerState, c: LearningCommand, now = morning) => executeLearning(state, c, now).state;

/** A learner who finished a one-question lesson: 25 XP for the answer (10 plus the 15 mastery bonus) and 10 for the lesson. */
function finishedLesson(q = "q001") {
    let s = run(createLearner(morning), { kind: "start_study", requestId: requestId(), questionIds: [q] });
    const id = s.sessions.at(-1)?.id ?? "";
    s = run(s, { kind: "answer_study", requestId: requestId(), sessionId: id, questionId: q, answer: right(q) });
    return run(s, { kind: "next_study", requestId: requestId(), sessionId: id });
}
const join = (state: LearnerState, displayName: string, at = morning) => run(state, { kind: "join_league", requestId: requestId(), displayName }, at);
/** Adds n first-time correct answers (25 XP each) through the direct answer path. */
function earn(state: LearnerState, n: number, from = 100) {
    for (const q of bankQuestions.slice(from, from + n).map(q => q.questionId))
        state = run(state, { kind: "answer_question", requestId: requestId(), questionId: q, answer: right(q) });
    return state;
}
async function storeWith(members: LearnerState[]) {
    const store = new SqliteLearningStore(":memory:");
    for (const [i, state] of members.entries())
        assert.ok(await store.compareAndSwap(`user-${i}`, null, state));
    return store;
}

test("display names are trimmed, 3 to 20 letters, digits, spaces or . _ -, and free of profanity in any case or accent", () => {
    assert.equal(leagueDisplayName("  Tuấn_01  "), "Tuấn_01");
    for (const ok of ["Lan.B", "minh_lai_xe", "Hà Nội 2026", "abc", "Nguyễn Thị Minh Khai", "Lớn", "Các bạn", "Buổi sáng", "Con Lớn", "Đèo Hải Vân"])
        assert.equal(leagueDisplayName(ok), ok);
    for (const bad of ["ab", "a".repeat(21), "abc$", "Аня", "...", "x́́́"])
        assert.throws(() => leagueDisplayName(bad), /LEAGUE_NAME_INVALID/, bad);
    for (const rude of ["FuCk you", "ĐỊT", "Địt mẹ", "đ.ị.t m.ẹ", "Lồn", "VCL", "f.u.c.k", "Cặc", "con cặc", "lon", "ditme", "Buồi"])
        assert.throws(() => leagueDisplayName(rude), /LEAGUE_NAME_REJECTED/, rude);
});

test("joining needs a finished lesson, then renaming keeps the place, and leaving clears it", () => {
    assert.throws(() => join(createLearner(morning), "Lan.B"), /LEAGUE_NEEDS_LESSON/);
    let s = join(finishedLesson(), "Lan.B");
    assert.deepEqual(s.league, { displayName: "Lan.B", joinedAt: morning, hidden: false });
    s = join(s, "Lan B", morning + 1000);
    assert.deepEqual(s.league, { displayName: "Lan B", joinedAt: morning, hidden: false });
    assert.throws(() => run(createLearner(morning), { kind: "set_league_hidden", requestId: requestId(), hidden: true }), /LEAGUE_NOT_JOINED/);
    s = run(s, { kind: "leave_league", requestId: requestId() });
    assert.equal(s.league, null);
});

test("members form cohorts of 30 by join time and see only their own cohort, ranked by weekly XP", async () => {
    const template = finishedLesson();
    const members = Array.from({ length: 61 }, (_, i) => join(i === 40 ? earn(template, 3) : template, `Member ${i}`, morning + i * 1000));
    const store = await storeWith(members);
    const board = await new LearningRuntime(store, "user-45", () => morning + 60000).league();
    assert.equal(board.rows.length, 30);
    assert.deepEqual(board.rows.map(r => r.displayName).sort(), Array.from({ length: 30 }, (_, i) => `Member ${i + 30}`).sort());
    assert.deepEqual(board.rows[0], { rank: 1, displayName: "Member 40", weekXp: 110, you: false });
    assert.deepEqual(board.rows[1], { rank: 2, displayName: "Member 30", weekXp: 35, you: false }, "ties keep join order");
    assert.deepEqual(board.rows.find(r => r.you), { rank: 16, displayName: "Member 45", weekXp: 35, you: true });
    assert.equal(board.rank, 16);
    const last = await new LearningRuntime(store, "user-60", () => morning + 60000).league();
    assert.deepEqual(last.rows.map(r => r.displayName), ["Member 60"]);
    store.close();
});

test("hidden members appear only on their own board, and a learner with a day over 500 XP is left out of ranking", async () => {
    const template = finishedLesson();
    const hidden = run(join(earn(template, 5), "Hidden One"), { kind: "set_league_hidden", requestId: requestId(), hidden: true });
    const flagged = join(earn(template, 51), "Busy Bee", morning + 1000);
    const plain = join(template, "Plain Jane", morning + 2000);
    const store = await storeWith([hidden, flagged, plain]);
    const others = await new LearningRuntime(store, "user-2", () => morning + 60000).league();
    assert.deepEqual(others.rows, [{ rank: 1, displayName: "Plain Jane", weekXp: 35, you: true }]);
    const own = await new LearningRuntime(store, "user-0", () => morning + 60000).league();
    assert.deepEqual(own.rows, [{ rank: 1, displayName: "Hidden One", weekXp: 160, you: true }, { rank: 2, displayName: "Plain Jane", weekXp: 35, you: false }]);
    assert.equal(own.hidden, true);
    const busy = await new LearningRuntime(store, "user-1", () => morning + 60000).league();
    assert.deepEqual(busy.rows.at(-1), { rank: null, displayName: "Busy Bee", weekXp: 1310, you: true });
    assert.equal(busy.rank, null);
    store.close();
});

test("the league view and the home summary never carry user IDs or learning data", async () => {
    const store = await storeWith([join(finishedLesson(), "Lan.B"), join(finishedLesson("q002"), "Tuấn", morning + 1000), finishedLesson("q003"), createLearner(morning)]);
    const runtime = new LearningRuntime(store, "user-1", () => morning + 60000);
    const board = await runtime.league();
    const text = JSON.stringify(board);
    for (const leak of ["user-0", "user-1", "accuracy", "targetDate", "answer", "evidence", "questionId", "dailyGoal"])
        assert.equal(text.includes(leak), false, leak);
    assert.deepEqual(Object.keys(board.rows[0] ?? {}).sort(), ["displayName", "rank", "weekXp", "you"]);
    assert.deepEqual((await runtime.course()).leagueSummary, { joined: true, rank: 2, weekXp: 35 });
    assert.deepEqual((await new LearningRuntime(store, "user-2", () => morning + 60000).course()).leagueSummary, { joined: false, rank: null, weekXp: 35 }, "a finished lesson brings the invitation");
    assert.equal((await new LearningRuntime(store, "user-3", () => morning + 60000).course()).leagueSummary, null, "no league line before a finished lesson");
    assert.deepEqual((await store.leagueMembers()).map(m => m.userId).sort(), ["user-0", "user-1"]);
    await new LearningRuntime(store, "user-0").delete();
    assert.deepEqual((await store.leagueMembers()).map(m => m.userId), ["user-1"], "deleting study data removes league history");
    store.close();
});

test("league tools open the card and return the board, never a user ID", async () => {
    const store = new SqliteLearningStore(":memory:");
    const tools = createLearningTools(new LearningRuntime(store, "learner-a", () => morning), "local");
    const tool = (name: string) => {
        const found = tools.find(t => t.name === name);
        assert.ok(found, name);
        return found;
    };
    assert.ok(["get_league", "join_league", "leave_league", "set_league_hidden", "start_lightning"].every(name => tool(name).card));
    assert.equal(tool("get_league").readOnly, true);
    await assert.rejects(tool("join_league").run({ requestId: requestId(), displayName: "Lan.B" }), /LEAGUE_NEEDS_LESSON/);
    const started = await tool("start_study").run({ requestId: requestId(), questionIds: ["q001"] }) as { sessionId: string };
    await tool("submit_study_answer").run({ requestId: requestId(), sessionId: started.sessionId, questionId: "q001", answer: right("q001") });
    await tool("next_study_question").run({ requestId: requestId(), sessionId: started.sessionId });
    const joined = await tool("join_league").run({ requestId: requestId(), displayName: "Lan.B" }) as { kind: string; rows: unknown[]; joined: boolean };
    assert.deepEqual([joined.kind, joined.joined, joined.rows.length], ["league", true, 1]);
    const hidden = await tool("set_league_hidden").run({ requestId: requestId(), hidden: true }) as { hidden: boolean };
    assert.equal(hidden.hidden, true);
    const left = await tool("leave_league").run({ requestId: requestId() }) as { joined: boolean; canJoin: boolean };
    assert.deepEqual([left.joined, left.canJoin], [false, true]);
    assert.equal(JSON.stringify(await tool("get_league").run({})).includes("learner-a"), false);
    store.close();
});

test("a member's finished lesson and finalised mock test carry their league line, and a non-member's do not", async () => {
    const store = new SqliteLearningStore(":memory:");
    const rival = join(earn(finishedLesson(), 3), "Rival", morning);
    assert.ok(await store.compareAndSwap("rival", null, rival));
    const member = new LearningRuntime(store, "member", () => morning + 60000);
    const outsider = new LearningRuntime(store, "outsider", () => morning + 60000);
    const lesson = async (runtime: LearningRuntime) => {
        const started = await runtime.command({ kind: "start_study", requestId: requestId(), questionIds: ["q001"] }) as { sessionId: string };
        await runtime.command({ kind: "answer_study", requestId: requestId(), sessionId: started.sessionId, questionId: "q001", answer: right("q001") });
        return { sessionId: started.sessionId, done: await runtime.command({ kind: "next_study", requestId: requestId(), sessionId: started.sessionId }) as { status: string; leagueSummary?: unknown } };
    };
    const first = await lesson(member);
    assert.equal(first.done.status, "complete");
    assert.equal(first.done.leagueSummary, undefined, "a learner who has not joined gets no league line");
    await member.command({ kind: "join_league", requestId: requestId(), displayName: "Member" });
    const second = await lesson(member);
    // 35 for the first lesson, then 3 for the repeated answer (assisted) and 10 for the second lesson.
    const home = (await member.course()).leagueSummary;
    assert.deepEqual(home, { joined: true, rank: 2, weekXp: 48 });
    assert.deepEqual(second.done.leagueSummary, home, "the finish card shows the same line as the home card");
    assert.deepEqual((await member.session(second.sessionId) as { leagueSummary?: unknown }).leagueSummary, home, "a reloaded finish card shows it too");
    assert.equal((await lesson(outsider)).done.leagueSummary, undefined);
    const mock = await member.command({ kind: "start_mock", requestId: requestId(), mode: "random" }) as { attemptId: string; leagueSummary?: unknown };
    assert.equal(mock.leagueSummary, undefined, "a running mock test has no rank yet");
    const result = await member.command({ kind: "finalise_mock", requestId: requestId(), attemptId: mock.attemptId, confirmUnanswered: true }) as { score: number; leagueSummary?: { joined: boolean; rank: number | null } };
    assert.equal(result.leagueSummary?.joined, true);
    assert.equal(typeof result.leagueSummary?.rank, "number");
    store.close();
});
