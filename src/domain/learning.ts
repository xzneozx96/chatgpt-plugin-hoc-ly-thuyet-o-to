import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { submitAnswer } from "./quiz.js";
import { bankQuestions, bankVersion, categories, categoryTitles, CONFUSING_CATEGORY_ID, families, safeQuestion, unitQuestions } from "./course.js";
export const DAY = 86400000;
const id = z.string().uuid();
const qid = z.string().regex(/^q\d{3}$/).refine(value => bankQuestions.some(q => q.questionId === value), "Unknown original question");
const time = z.number().finite().nonnegative();
const choice = z.enum(["A", "B", "C", "D"]);
const confidence = z.enum(["guess", "confident", "unknown"]);
const factBase = {
    id,
    questionId: qid,
    at: time,
    localDay: z.string(),
    sequence: z.number().int().nonnegative()
};
const fact = z.discriminatedUnion("kind", [
    z.object({
        ...factBase,
        kind: z.literal("answer"),
        answer: choice,
        correct: z.boolean(),
        assisted: z.boolean(),
        confidence,
        origin: z.enum(["study", "mock"]),
        activityId: id
    }),
    z.object({
        ...factBase,
        kind: z.literal("help"),
        feedback: z.boolean().default(false)
    }),
    z.object({
        ...factBase,
        kind: z.literal("confusion"),
        enabled: z.boolean()
    }),
    z.object({
        ...factBase,
        kind: z.literal("gap")
    })
]);
const item = z.object({
    questionId: qid,
    kind: z.enum(["review", "new", "practice"]),
    status: z.enum(["pending", "answered"]),
    bindingAt: time
});
const session = z.object({
    id,
    createdAt: time,
    status: z.enum(["active", "paused", "complete"]),
    override: z.boolean(),
    reviewOnly: z.boolean().default(false),
    unitId: z.string().nullable(),
    items: z.array(item),
    activeQuestionId: qid.nullable()
});
const provisional = z.object({
    answer: choice,
    at: time,
    localDay: z.string(),
    acceptedOrder: z.number().int().nonnegative()
});
const mockBase = {
    id,
    createdAt: time,
    deadline: time,
    questionIds: z.array(qid).length(30).refine(ids => new Set(ids).size === 30, "Mock membership must be unique"),
    choices: z.record(provisional)
};
const mock = z.discriminatedUnion("status", [z.object({
        ...mockBase,
        status: z.literal("active")
    }), z.object({
        ...mockBase,
        status: z.literal("abandoned"),
        closedAt: time
    }), z.object({
        ...mockBase,
        status: z.literal("finalised"),
        closedAt: time,
        reason: z.enum(["submit", "expiry"]),
        score: z.number().int(),
        passed: z.boolean(),
        criticalFailures: z.array(qid)
    })]);
export const LearnerStateSchema = z.object({
    version: z.literal(1),
    policyVersion: z.literal("recall-1"),
    createdAt: time,
    nextOrder: z.number().int().nonnegative(),
    profile: z.object({
        timezone: z.string(),
        dailyGoal: z.number().int().positive().max(600),
        targetDate: time,
        studyWeekdays: z.array(z.number().int().min(0).max(6)).min(1)
    }),
    evidence: z.array(fact),
    sessions: z.array(session),
    mocks: z.array(mock),
    receipts: z.record(z.object({
        digest: z.string(),
        activityId: z.string().nullable(),
        viewKind: z.enum(["course", "study", "mock", "help", "answer"])
    }))
});
export type LearnerState = z.infer<typeof LearnerStateSchema>;
const base = {
    requestId: id
};
const sessionInput = {
    ...base,
    sessionId: id
};
const mockInput = {
    ...base,
    attemptId: id
};
export const LearningCommandSchema = z.discriminatedUnion("kind", [
    z.object({
        ...base,
        kind: z.literal("start_study"),
        unitId: z.string().optional(),
        questionIds: z.array(qid).optional(),
        override: z.boolean().optional(),
        reviewOnly: z.boolean().optional(),
        count: z.number().int().min(1).max(50).optional()
    }),
    z.object({
        ...base,
        kind: z.literal("answer_question"),
        questionId: qid,
        answer: choice,
        confidence: confidence.optional()
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("answer_study"),
        questionId: qid,
        answer: choice,
        confidence: confidence.optional()
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("skip_study")
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("pause_study")
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("resume_study")
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("next_study")
    }),
    z.object({
        ...base,
        kind: z.literal("record_help"),
        questionId: qid,
        sessionId: id.optional(),
        helpKind: z.enum(["hint", "explanation", "reveal"]).optional()
    }),
    z.object({
        ...base,
        kind: z.literal("set_confusion"),
        questionId: qid,
        enabled: z.boolean()
    }),
    z.object({
        ...base,
        kind: z.literal("update_profile"),
        timezone: z.string().optional(),
        dailyGoal: z.number().int().positive().max(600).optional(),
        targetDate: time.optional(),
        studyWeekdays: z.array(z.number().int().min(0).max(6)).min(1).optional()
    }),
    z.object({
        ...base,
        kind: z.literal("start_mock"),
        mode: z.enum(["random", "library"]).default("random")
    }),
    z.object({
        ...mockInput,
        kind: z.literal("save_mock_choice"),
        questionId: qid,
        answer: choice
    }),
    z.object({
        ...mockInput,
        kind: z.literal("finalise_mock"),
        confirmUnanswered: z.boolean().optional()
    }),
    z.object({
        ...mockInput,
        kind: z.literal("abandon_mock")
    }),
    z.object({
        ...mockInput,
        kind: z.literal("view_mock")
    })
]);
export type LearningCommand = z.infer<typeof LearningCommandSchema>;
export function createLearner(now: number): LearnerState {
    return LearnerStateSchema.parse({
        version: 1,
        policyVersion: "recall-1",
        createdAt: now,
        nextOrder: 0,
        profile: {
            timezone: "Asia/Ho_Chi_Minh",
            dailyGoal: 12,
            targetDate: now + 60 * DAY,
            studyWeekdays: [0, 1, 2, 3, 4, 5, 6]
        },
        evidence: [],
        sessions: [],
        mocks: [],
        receipts: {}
    });
}
function localDay(at: number, timezone: string) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(at);
}
export function questionProgress(state: LearnerState) {
    const result = new Map<string, {
        successes: number;
        stage: number;
        dueAt: number | null;
        eligibleAt: number;
        prior: boolean;
        coveredAt: number | null;
        coveredDay: string | null;
        confused: boolean;
        lastDay: string | null;
        lastAt: number | null;
        lastWrong: boolean;
    }>();
    for (const q of bankQuestions)
        result.set(q.questionId, {
            successes: 0,
            stage: 0,
            dueAt: null,
            eligibleAt: 0,
            prior: false,
            coveredAt: null,
            coveredDay: null,
            confused: false,
            lastDay: null,
            lastAt: null,
            lastWrong: false
        });
    for (const e of [...state.evidence].sort((a, b) => a.at - b.at || a.sequence - b.sequence || a.id.localeCompare(b.id))) {
        const p = result.get(e.questionId);
        if (!p)
            throw new Error("QUESTION_NOT_FOUND");
        const soon = e.at + DAY;
        const earlier = (a: number | null, b: number) => a === null ? b : Math.min(a, b);
        if (e.kind === "confusion") {
            p.confused = e.enabled;
            if (e.enabled)
                p.dueAt = earlier(p.dueAt, soon);
            continue;
        }
        if (e.kind === "gap") {
            p.dueAt = earlier(p.dueAt, soon);
            continue;
        }
        if (e.kind === "help") {
            p.prior = true;
            if (!e.feedback)
                p.eligibleAt = Math.max(p.eligibleAt, soon);
            if (!e.feedback || p.dueAt === null)
                p.dueAt = earlier(p.dueAt, soon);
            continue;
        }
        if (p.coveredAt === null) {
            p.coveredAt = e.at;
            p.coveredDay = e.localDay;
        }
        const due = p.dueAt !== null && e.at >= p.dueAt;
        const qualifies = e.correct && !e.assisted && e.confidence !== "guess" && (!p.prior || (due && e.at >= p.eligibleAt && (p.lastAt === null || e.at - p.lastAt >= DAY) && p.lastDay !== e.localDay));
        if (!e.correct) {
            p.successes = 0;
            p.stage = 0;
            p.lastAt = null;
            p.lastDay = null;
            p.eligibleAt = soon;
            p.dueAt = due ? soon : earlier(p.dueAt, soon);
            p.lastWrong = true;
        }
        else if (qualifies) {
            if (p.prior)
                p.stage = Math.min(p.stage + 1, 4);
            p.successes++;
            p.lastAt = e.at;
            p.lastDay = e.localDay;
            p.eligibleAt = soon;
            p.dueAt = e.at + ([1, 3, 7, 14, 30][p.stage] ?? 30) * DAY;
            p.lastWrong = false;
        }
        else if (due) {
            p.dueAt = p.eligibleAt > e.at ? p.eligibleAt : soon;
        }
        if (p.confused && due)
            p.dueAt = earlier(p.dueAt, soon);
        p.prior = true;
    }
    return result;
}
function dueIds(state: LearnerState, now: number) {
    const progress = questionProgress(state);
    return bankQuestions.filter(q => {
        const p = progress.get(q.questionId);
        return p?.dueAt !== null && p?.dueAt !== undefined && p.dueAt <= now;
    }).sort((a, b) => {
        const x = progress.get(a.questionId), y = progress.get(b.questionId);
        return Number(y?.lastWrong) - Number(x?.lastWrong) || Number(b.isCritical) - Number(a.isCritical) || (x?.dueAt ?? 0) - (y?.dueAt ?? 0) || a.id - b.id;
    }).map(q => q.questionId);
}
type AnswerFact = Extract<z.infer<typeof fact>, { kind: "answer" }>;
function answerFacts(evidence: LearnerState["evidence"]) {
    return evidence.filter((e): e is AnswerFact => e.kind === "answer").sort((a, b) => a.at - b.at || a.sequence - b.sequence);
}
function answerResults(answers: AnswerFact[]) {
    const correctAttempts = answers.filter(e => e.correct).length;
    return {
        totalAttempts: answers.length,
        correctAttempts,
        wrongAttempts: answers.length - correctAttempts,
        accuracyPercent: answers.length ? Math.round(correctAttempts * 100 / answers.length) : 0
    };
}
export function courseView(state: LearnerState, now: number) {
    const p = questionProgress(state);
    const covered = [...p.values()].filter(q => q.coveredAt !== null);
    const today = localDay(now, state.profile.timezone);
    const requiredStudyDays = Math.ceil((600 - covered.length) / state.profile.dailyGoal);
    const todayNew=covered.filter(q=>q.coveredDay===today).length;
    let cursor = todayNew>=state.profile.dailyGoal?now+DAY:now, availableStudyDays = 0, forecastFinishAt: number | null = requiredStudyDays === 0 ? now : null;
    for (let i = 0; i < 10000 && forecastFinishAt === null; i++, cursor += DAY) {
        const weekday = new Date(new Intl.DateTimeFormat("en-US", {
            timeZone: state.profile.timezone,
            year: "numeric",
            month: "numeric",
            day: "numeric"
        }).format(cursor)).getDay();
        if (state.profile.studyWeekdays.includes(weekday)) {
            availableStudyDays++;
            if (availableStudyDays === requiredStudyDays)
                forecastFinishAt = cursor;
        }
    }
    const calendarCapacity = Math.max(0, Math.ceil((state.profile.targetDate - now) / DAY));
    return {
        kind: "course" as const,
        bankVersion,
        total: 600,
        covered: covered.length,
        learned: [...p.values()].filter(q => q.successes >= 2).length,
        newToday: covered.filter(q => q.coveredDay === today).length,
        dailyGoal: state.profile.dailyGoal,
        dueCount: dueIds(state, now).length,
        requiredStudyDays,
        calendarCapacity,
        bufferDays: calendarCapacity - requiredStudyDays,
        forecastFinishAt,
        targetCompatible: forecastFinishAt !== null && forecastFinishAt <= state.profile.targetDate,
        profile: state.profile,
        familyStatus: "draft_bank_analysis",
        units: listUnits(state, "", now).units.filter(u => u.kind === "category"),
        customCategory: listUnits(state, "", now).customCategory,
        mockLibraryAvailable: false,
        results: answerResults(answerFacts(state.evidence)),
        recentAnswers: answerFacts(state.evidence).slice(-20).reverse().map(e => ({
            questionId: e.questionId,
            answer: e.answer,
            correct: e.correct,
            at: e.at,
            origin: e.origin
        })),
        sessions: state.sessions.map(s => ({
            id: s.id,
            status: s.status
        })),
        mocks: state.mocks.map(m => ({
            id: m.id,
            status: m.status,
            deadline: m.deadline
        }))
    };
}
export function listUnits(state: LearnerState, query = "", now = Date.now()) {
    const p = questionProgress(state);
    const units = [...categories.map(id => ({
            id,
            title: categoryTitles[id] ?? id,
            kind: "category",
            status: "bank",
            questionIds: unitQuestions(id),
            comparisonAxes: [] as string[]
        })), ...families.map(f => ({
            ...f,
            kind: "family"
        }))];
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
    const selected = units.filter(u => normalize(`${u.id} ${u.title} ${u.questionIds.join(" ")} ${u.comparisonAxes.join(" ")}`).includes(normalize(query))).map(u => ({
        ...u,
        covered: u.questionIds.filter(id => p.get(id)?.coveredAt !== null).length,
        learned: u.questionIds.filter(id => (p.get(id)?.successes ?? 0) >= 2).length,
        due: u.questionIds.filter(id => {
            const due = p.get(id)?.dueAt;
            return due !== null && due !== undefined && due <= now;
        }).length
    }));
    return {
        kind: "units" as const,
        customCategory: {
            id: CONFUSING_CATEGORY_ID,
            title: "C\u00E2u h\u1ECFi d\u1EC5 nh\u1EA7m l\u1EABn",
            status: "draft_bank_analysis",
            familyCount: families.length,
            total: new Set(families.flatMap(f => f.questionIds)).size,
            covered: [...new Set(families.flatMap(f => f.questionIds))].filter(id => p.get(id)?.coveredAt !== null).length,
            learned: [...new Set(families.flatMap(f => f.questionIds))].filter(id => (p.get(id)?.successes ?? 0) >= 2).length
        },
        units: selected,
        suggestions: selected.filter(u => u.kind === "family").sort((a, b) => b.due - a.due || a.covered - b.covered).slice(0, 3)
    };
}
function findSession(state: LearnerState, id: string) {
    const s = state.sessions.find(s => s.id === id);
    if (!s)
        throw new Error("SESSION_NOT_FOUND");
    return s;
}
function findMock(state: LearnerState, id: string) {
    const m = state.mocks.find(m => m.id === id);
    if (!m)
        throw new Error("MOCK_NOT_FOUND");
    return m;
}
export function studyView(state: LearnerState, sessionId: string, now: number) {
    const s = findSession(state, sessionId);
    const q = s.activeQuestionId;
    const answers = answerFacts(state.evidence).filter(e => e.activityId === s.id);
    const results = answerResults(answers);
    return {
        kind: "study" as const,
        sessionId: s.id,
        status: s.status,
        override: s.override,
        pendingDue: dueIds(state, now).length,
        remaining: s.items.filter(i => i.status === "pending").length,
        completed: s.items.filter(i => i.status === "answered").length,
        total: s.items.length,
        estimatedMinutes: {
            review: s.items.filter(i => i.kind === "review" && i.status === "pending").length,
            new: s.items.filter(i => i.kind === "new" && i.status === "pending").length,
            provisional: true
        },
        question: q ? safeQuestion(q) : null,
        confusionEnabled: q ? questionProgress(state).get(q)?.confused ?? false : false,
        questionStatus: s.items.find(i => i.questionId === q)?.status ?? null,
        queue: s.items,
        currentFeedback: answers.filter(e => e.questionId === q).slice(-1).map(e => e.kind === "answer" ? {
            ...submitAnswer(e.questionId, e.answer),
            sourceId: `question-bank.json#${e.questionId}`,
            teachingStatus: "bank_text_unreviewed"
        } : null)[0] ?? null,
        help: q && state.evidence.some(e => e.kind === "help" && e.questionId === q && e.at >= s.createdAt) ? helpView(q) : null,
        sessionResults: {
            answered: results.totalAttempts,
            correct: results.correctAttempts,
            wrong: results.wrongAttempts,
            items: answers.map(e => ({ questionId: e.questionId, answer: e.answer, correct: e.correct }))
        }
    };
}
export function mockView(state: LearnerState, attemptId: string, now: number, resumed = false) {
    const m = findMock(state, attemptId);
    const common = {
        kind: "mock" as const,
        attemptId: m.id,
        resumed,
        createdAt: m.createdAt,
        status: m.status,
        deadline: m.deadline,
        serverNow: now,
        remainingMs: Math.max(0, m.deadline - now),
        expired: m.status === "active" && now >= m.deadline,
        profile: "owner-30-27-20-v1",
        composition: "random bank practice; official category distribution unvalidated",
        questions: m.questionIds.map(safeQuestion),
        choices: m.choices,
        answeredCount: Object.keys(m.choices).length
    };
    return m.status === "finalised" ? {
        ...common,
        score: m.score,
        passed: m.passed,
        criticalFailures: m.criticalFailures,
        results: m.questionIds.map(q => {
            const saved = m.choices[q];
            return saved ? submitAnswer(q, saved.answer) : {
                questionId: q,
                unanswered: true,
                correctAnswer: submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer
            };
        })
    } : common;
}
export function helpView(questionId: string) {
    const question = safeQuestion(questionId);
    const metadata = bankQuestions.find(q => q.questionId === questionId);
    return {
        kind: "help" as const,
        question,
        correctAnswer: submitAnswer(questionId, question.options[0]?.id ?? "A").correctAnswer,
        explanation: metadata?.explanation ?? null,
        teachingStatus: metadata?.explanation ? "bank_text_unreviewed" : "teaching_gap",
        knowledgeBaseAvailable: false,
        sourceId: question.sourceId
    };
}
export function answerView(state: LearnerState, evidenceId: string) {
    const e = state.evidence.find(e => e.id === evidenceId);
    if (!e || e.kind !== "answer")
        throw new Error("ANSWER_NOT_FOUND");
    return {
        kind: "answer" as const,
        feedback: submitAnswer(e.questionId, e.answer),
        nextReviewAt: questionProgress(state).get(e.questionId)?.dueAt ?? null
    };
}
export type LearningView = ReturnType<typeof answerView> | ReturnType<typeof helpView> | ReturnType<typeof courseView> | ReturnType<typeof studyView> | ReturnType<typeof mockView>;
function append(state: LearnerState, questionId: string, now: number, event: Omit<Extract<z.infer<typeof fact>, {
    kind: "answer";
}>, "id" | "questionId" | "at" | "localDay" | "sequence"> | {
    kind: "help";
    feedback?: boolean;
} | {
    kind: "gap";
} | {
    kind: "confusion";
    enabled: boolean;
}, day?: string, acceptedOrder?: number) {
    safeQuestion(questionId);
    state.evidence.push(fact.parse({
        ...event,
        id: randomUUID(),
        questionId,
        at: now,
        localDay: day ?? localDay(now, state.profile.timezone),
        sequence: acceptedOrder ?? state.nextOrder++
    }));
}
function reconcile(state: LearnerState, s: z.infer<typeof session>, now: number) {
    for (const i of s.items) {
        const handled = state.evidence.some(e => e.kind === "answer" && e.questionId === i.questionId && e.at >= i.bindingAt && e.activityId !== s.id);
        if (i.status === "pending" && i.kind === "review" && handled)
            i.status = "answered";
    }
    if (!s.override)
        for (const q of dueIds(state, now))
            if (!s.items.some(i => i.questionId === q))
                s.items.push({
                    questionId: q,
                    kind: "review",
                    status: "pending",
                    bindingAt: now
                });
    s.items.sort((a, b) => Number(b.kind === "review") - Number(a.kind === "review"));
    s.activeQuestionId = s.items.find(i => i.status === "pending")?.questionId ?? null;
    s.status = s.activeQuestionId ? "active" : "complete";
}
function reopen(state: LearnerState, s: z.infer<typeof session>, now: number) {
    if (s.items.some(i => i.questionId === s.activeQuestionId && i.status === "answered"))
        s.status = "active";
    else
        reconcile(state, s, now);
}
function closeMock(state: LearnerState, attemptId: string, now: number, reason: "submit" | "expiry") {
    const m = findMock(state, attemptId);
    if (m.status !== "active")
        return;
    const closedAt = reason === "expiry" ? m.deadline : now;
    let score = 0;
    const criticalFailures: string[] = [];
    for (const questionId of m.questionIds) {
        const saved = m.choices[questionId];
        const metadata = safeQuestion(questionId);
        if (saved) {
            const scored = submitAnswer(questionId, saved.answer);
            if (scored.correct)
                score++;
            else if (metadata.critical)
                criticalFailures.push(questionId);
            append(state, questionId, saved.at, {
                kind: "answer",
                answer: saved.answer,
                correct: scored.correct,
                assisted: false,
                confidence: "unknown",
                origin: "mock",
                activityId: m.id
            }, saved.localDay, saved.acceptedOrder);
        }
        else {
            if (metadata.critical)
                criticalFailures.push(questionId);
            append(state, questionId, closedAt, {
                kind: "gap"
            });
        }
    }
    const index = state.mocks.findIndex(a => a.id === attemptId);
    state.mocks[index] = {
        ...m,
        status: "finalised",
        closedAt,
        reason,
        score,
        passed: score >= 27 && criticalFailures.length === 0,
        criticalFailures
    };
}
function assertNotInRunningMock(state: LearnerState, questionId: string) {
    if (state.mocks.some(m => m.status === "active" && m.questionIds.includes(questionId)))
        throw new Error("MOCK_IN_PROGRESS");
}
function digest(command: LearningCommand) {
    return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}
export function executeLearning(original: LearnerState, input: LearningCommand, now: number): {
    state: LearnerState;
    view: LearningView;
} {
    const command = LearningCommandSchema.parse(input);
    const state = LearnerStateSchema.parse(structuredClone(original));
    const receipt = state.receipts[command.requestId];
    if (receipt) {
        if (receipt.digest !== digest(command))
            throw new Error("REQUEST_CONFLICT");
        if (receipt.viewKind === "study" && receipt.activityId)
            return {
                state,
                view: studyView(state, receipt.activityId, now)
            };
        if (receipt.viewKind === "mock" && receipt.activityId) {
            const m = findMock(state, receipt.activityId);
            if (m.status === "active" && now >= m.deadline)
                closeMock(state, m.id, now, "expiry");
            return {
                state,
                view: mockView(state, m.id, now)
            };
        }
        if (receipt.viewKind === "answer" && receipt.activityId)
            return {
                state,
                view: answerView(state, receipt.activityId)
            };
        if (receipt.viewKind === "help" && receipt.activityId)
            return {
                state,
                view: helpView(receipt.activityId)
            };
        return {
            state,
            view: courseView(state, now)
        };
    }
    const expired = state.mocks.filter(m => m.status === "active" && now >= m.deadline).map(m => m.id);
    for (const attemptId of expired)
        closeMock(state, attemptId, now, "expiry");
    let activityId: string | null = null;
    let viewKind: "course" | "study" | "mock" | "help" | "answer" = "course";
    let resumed = false;
    switch (command.kind) {
        case "answer_question": {
            assertNotInRunningMock(state, command.questionId);
            const last = state.evidence.filter(e => e.questionId === command.questionId).at(-1);
            const assisted = last?.kind === "help" && now - last.at < DAY;
            const scored = submitAnswer(command.questionId, command.answer);
            append(state, command.questionId, now, {
                kind: "answer",
                answer: command.answer,
                correct: scored.correct,
                assisted,
                confidence: command.confidence ?? "unknown",
                origin: "study",
                activityId: randomUUID()
            });
            activityId = state.evidence.at(-1)?.id ?? null;
            append(state, command.questionId, now, {
                kind: "help",
                feedback: true
            });
            viewKind = "answer";
            break;
        }
        case "start_study": {
            const progress = questionProgress(state);
            const overridden = command.override === true || command.unitId !== undefined || command.questionIds !== undefined;
            const open = overridden ? undefined : [...state.sessions].reverse().find(s => !s.override && s.reviewOnly === (command.reviewOnly === true) && s.status !== "complete");
            if (open) {
                reopen(state, open, now);
                activityId = open.id;
                viewKind = "study";
                break;
            }
            const pool = command.questionIds ? [...new Set(command.questionIds)] : unitQuestions(command.unitId);
            for (const q of pool)
                safeQuestion(q);
            const reviews = overridden ? [] : dueIds(state, now);
            const today = courseView(state, now);
            const remainingQuota = Math.max(0, state.profile.dailyGoal - today.newToday);
            const selected = command.reviewOnly ? [] : overridden ? pool.slice(0, command.count ?? state.profile.dailyGoal) : pool.filter(q => progress.get(q)?.coveredAt === null).slice(0, Math.min(remainingQuota, command.count ?? remainingQuota));
            const ids = [...new Set([...reviews, ...selected])];
            activityId = randomUUID();
            const s: z.infer<typeof session> = {
                id: activityId,
                createdAt: now,
                status: ids.length ? "active" : "complete",
                override: overridden,
                reviewOnly: command.reviewOnly === true,
                unitId: command.unitId ?? null,
                items: ids.map(questionId => ({
                    questionId,
                    kind: reviews.includes(questionId) ? "review" : progress.get(questionId)?.coveredAt === null ? "new" : "practice",
                    status: "pending",
                    bindingAt: now
                })),
                activeQuestionId: ids[0] ?? null
            };
            state.sessions.push(s);
            viewKind = "study";
            break;
        }
        case "answer_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.status !== "active")
                throw new Error("SESSION_NOT_ACTIVE");
            if (s.activeQuestionId !== command.questionId)
                throw new Error("QUESTION_BINDING_MISMATCH");
            const i = s.items.find(i => i.questionId === command.questionId && i.status === "pending");
            if (!i)
                throw new Error("QUESTION_NOT_PENDING");
            assertNotInRunningMock(state, command.questionId);
            const scored = submitAnswer(command.questionId, command.answer);
            const latestAnswer = [...state.evidence].reverse().find(e => e.kind === "answer" && e.questionId === command.questionId);
            const assisted = state.evidence.some(e => e.kind === "help" && e.questionId === command.questionId && e.at >= i.bindingAt && (latestAnswer === undefined || e.sequence > latestAnswer.sequence));
            append(state, command.questionId, now, {
                kind: "answer",
                answer: command.answer,
                correct: scored.correct,
                assisted,
                confidence: command.confidence ?? "unknown",
                origin: "study",
                activityId: s.id
            });
            i.status = "answered";
            append(state, command.questionId, now, {
                kind: "help",
                feedback: true
            });
            break;
        }
        case "next_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.status !== "active")
                throw new Error("SESSION_NOT_ACTIVE");
            if (s.items.some(i => i.questionId === s.activeQuestionId && i.status === "pending"))
                throw new Error("ANSWER_OR_SKIP_FIRST");
            reconcile(state, s, now);
            break;
        }
        case "skip_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.status !== "active")
                throw new Error("SESSION_NOT_ACTIVE");
            const i = s.items.findIndex(i => i.questionId === s.activeQuestionId);
            const skipped = s.items.splice(i, 1)[0];
            if (skipped)
                s.items.push(skipped);
            s.activeQuestionId = s.items.find(i => i.status === "pending" && i.questionId !== skipped?.questionId && (skipped?.kind!=="review"||i.kind==="review"))?.questionId ?? null;
            if (!s.activeQuestionId)
                s.status = "paused";
            break;
        }
        case "pause_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.status === "active")
                s.status = "paused";
            break;
        }
        case "resume_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            reopen(state, s, now);
            break;
        }
        case "record_help": {
            if (command.sessionId) {
                const s = findSession(state, command.sessionId);
                if (s.activeQuestionId !== command.questionId)
                    throw new Error("QUESTION_BINDING_MISMATCH");
                activityId = s.id;
                viewKind = "study";
            }
            assertNotInRunningMock(state, command.questionId);
            append(state, command.questionId, now, {
                kind: "help"
            });
            if (!command.sessionId) {
                activityId = command.questionId;
                viewKind = "help";
            }
            break;
        }
        case "set_confusion":
            append(state, command.questionId, now, {
                kind: "confusion",
                enabled: command.enabled
            });
            break;
        case "update_profile": {
            if (command.timezone !== undefined) {
                localDay(now, command.timezone);
                state.profile.timezone = command.timezone;
            }
            if (command.dailyGoal !== undefined)
                state.profile.dailyGoal = command.dailyGoal;
            if (command.targetDate !== undefined)
                state.profile.targetDate = command.targetDate;
            if (command.studyWeekdays !== undefined)
                state.profile.studyWeekdays = [...new Set(command.studyWeekdays)];
            break;
        }
        case "start_mock": {
            if (command.mode === "library")
                throw new Error("LIBRARY_UNAVAILABLE");
            const running = state.mocks.find(m => m.status === "active");
            if (running) {
                activityId = running.id;
                viewKind = "mock";
                resumed = true;
                break;
            }
            const pool = unitQuestions();
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const a = pool[i], b = pool[j];
                if (a !== undefined && b !== undefined) {
                    pool[i] = b;
                    pool[j] = a;
                }
            }
            activityId = randomUUID();
            state.mocks.push({
                id: activityId,
                createdAt: now,
                deadline: now + 20 * 60000,
                questionIds: pool.slice(0, 30),
                choices: {},
                status: "active"
            });
            viewKind = "mock";
            break;
        }
        case "save_mock_choice": {
            const m = findMock(state, command.attemptId);
            activityId = m.id;
            viewKind = "mock";
            if (expired.includes(m.id))
                break;
            if (m.status !== "active")
                throw new Error("MOCK_NOT_ACTIVE");
            if (!m.questionIds.includes(command.questionId))
                throw new Error("QUESTION_BINDING_MISMATCH");
            if (!safeQuestion(command.questionId).options.some(o => o.id === command.answer))
                throw new Error("INVALID_ANSWER");
            m.choices[command.questionId] = {
                answer: command.answer,
                at: now,
                localDay: localDay(now, state.profile.timezone),
                acceptedOrder: state.nextOrder++
            };
            break;
        }
        case "finalise_mock": {
            const m = findMock(state, command.attemptId);
            activityId = m.id;
            viewKind = "mock";
            if (m.status === "abandoned")
                throw new Error("MOCK_ABANDONED");
            if (m.status === "active" && Object.keys(m.choices).length < 30 && !command.confirmUnanswered)
                throw new Error("CONFIRM_UNANSWERED");
            closeMock(state, m.id, now, "submit");
            break;
        }
        case "abandon_mock": {
            const m = findMock(state, command.attemptId);
            activityId = m.id;
            viewKind = "mock";
            if (m.status === "active")
                state.mocks[state.mocks.findIndex(x => x.id === m.id)] = {
                    ...m,
                    status: "abandoned",
                    closedAt: now
                };
            break;
        }
        case "view_mock": {
            activityId = findMock(state, command.attemptId).id;
            viewKind = "mock";
            break;
        }
        default: {
            const exhaustive: never = command;
            throw new Error(String(exhaustive));
        }
    }
    state.receipts[command.requestId] = {
        digest: digest(command),
        activityId,
        viewKind
    };
    return {
        state,
        view: viewKind === "study" && activityId ? studyView(state, activityId, now) : viewKind === "mock" && activityId ? mockView(state, activityId, now, resumed) : viewKind === "help" && activityId ? helpView(activityId) : viewKind === "answer" && activityId ? answerView(state, activityId) : courseView(state, now)
    };
}
export const startStudy = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "start_study";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "start_study"
}, now);
export const answerStudy = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "answer_study";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "answer_study"
}, now);
export const skipStudy = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "skip_study";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "skip_study"
}, now);
export const pauseStudy = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "pause_study";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "pause_study"
}, now);
export const resumeStudy = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "resume_study";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "resume_study"
}, now);
export const recordHelp = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "record_help";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "record_help"
}, now);
export const setConfusion = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "set_confusion";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "set_confusion"
}, now);
export const updateProfile = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "update_profile";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "update_profile"
}, now);
export const startMock = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "start_mock";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "start_mock"
}, now);
export const saveMockChoice = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "save_mock_choice";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "save_mock_choice"
}, now);
export const finaliseMock = (s: LearnerState, c: Omit<Extract<LearningCommand, {
    kind: "finalise_mock";
}>, "kind">, now: number) => executeLearning(s, {
    ...c,
    kind: "finalise_mock"
}, now);
export const nextStudy = (state: LearnerState, input: Omit<Extract<LearningCommand, {
    kind: "next_study";
}>, "kind">, now: number) => executeLearning(state, {
    ...input,
    kind: "next_study"
}, now);
const legacySchema = z.array(z.object({
    id: z.string(),
    questionId: qid,
    selectedAnswer: choice,
    createdAt: z.union([z.string(), time])
}));
export function importLegacyAttempts(original: LearnerState, attempts: unknown) {
    const state = LearnerStateSchema.parse(structuredClone(original));
    for (const attempt of legacySchema.parse(attempts)) {
        const evidenceId = createHash("sha256").update("legacy:" + attempt.id).digest("hex");
        const receiptKey = `legacy:${evidenceId}`;
        if (state.receipts[receiptKey])
            continue;
        const at = typeof attempt.createdAt === "number" ? attempt.createdAt : Date.parse(attempt.createdAt);
        if (!Number.isFinite(at))
            throw new Error("INVALID_LEGACY_TIME");
        const scored = submitAnswer(attempt.questionId, attempt.selectedAnswer);
        append(state, attempt.questionId, at, {
            kind: "answer",
            answer: attempt.selectedAnswer,
            correct: scored.correct,
            assisted: true,
            confidence: "unknown",
            origin: "study",
            activityId: randomUUID()
        });
        append(state, attempt.questionId, at, {
            kind: "help",
            feedback: true
        });
        state.receipts[receiptKey] = {
            digest: evidenceId,
            activityId: null,
            viewKind: "course"
        };
    }
    return state;
}
