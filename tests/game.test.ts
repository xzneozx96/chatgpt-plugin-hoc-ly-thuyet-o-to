import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { executeLearning, LearnerStateSchema } from "../src/domain/learning.js";

const clock = Date.parse("2026-10-05T16:55:00Z");
const requestId = () => randomUUID();

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
});
