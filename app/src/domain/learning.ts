import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { submitAnswer } from "./quiz.js";
import { bankQuestions, bankVersion, categories, categoryTitles, CONFUSING_CATEGORY_ID, families, safeQuestion, unitQuestions } from "./course.js";
import { answerAwards, awardParts, comboOf, hasFinishedLesson, lessonXp, xpSummary } from "./game.js";
import { dailyStreak } from "./streak.js";
import { leagueDisplayName } from "./league.js";
export const DAY = 86400000;
const LIGHTNING_MS = 60000;
const LIGHTNING_MAX_LAG_MS = 3 * LIGHTNING_MS;
const MOCK_LATE_SAVE_MS = 30000;
// How long after a lightning deadline an answer the card sent in time may still arrive.
const LIGHTNING_LATE_MS = 15000;
const lagMs = z.number().int().min(0).optional().describe("Set only by the study card: milliseconds it waited on earlier lightning requests. Never set it yourself.");
const studyLeftMs = z.number().int().min(0).optional().describe("Set only by the study card: milliseconds of the lightning round it showed as left when the learner acted. Never set it yourself.");
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
    bindingAt: time,
    // Set on the one repair step a wrong lesson answer schedules (PLAY-05).
    repairOf: qid.optional(),
    // Compare-the-pair items share their family ID here (INT-02).
    group: z.string().optional(),
    // The answer fact that resolved this item in this session.
    answerId: id.optional(),
    // Set once the learner skips this item; a skip is never scored, so this is its only trace.
    skipped: z.boolean().optional()
});
const session = z.object({
    id,
    createdAt: time,
    status: z.enum(["active", "paused", "complete"]),
    override: z.boolean(),
    reviewOnly: z.boolean().default(false),
    unitId: z.string().nullable(),
    items: z.array(item),
    activeQuestionId: qid.nullable(),
    // A question can appear twice once it has a repair step, so this says which of the two is active.
    activeRepair: z.boolean().default(false),
    mode: z.enum(["lesson", "lightning"]).default("lesson"),
    deadline: time.optional(),
    // When the session first completed; a reopened daily lesson keeps it, so its finish bonus never moves.
    completedAt: time.optional()
});
type Session = z.infer<typeof session>;
type Item = z.infer<typeof item>;
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
    })),
    league: z.object({
        displayName: z.string(),
        joinedAt: time,
        hidden: z.boolean()
    }).nullable().default(null)
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
        confidence: confidence.optional(),
        lagMs,
        leftMs: studyLeftMs
    }),
    z.object({
        ...sessionInput,
        kind: z.literal("retry_study"),
        questionId: qid
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
        kind: z.literal("next_study"),
        questionId: qid.optional(),
        repair: z.boolean().optional(),
        lagMs,
        leftMs: studyLeftMs
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
        answer: choice,
        leftMs: z.number().int().min(0).optional().describe("Set only by the test card: milliseconds it showed as left when the learner chose. Never set it yourself.")
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
    }),
    z.object({
        ...base,
        kind: z.literal("start_lightning")
    }),
    z.object({
        ...base,
        kind: z.literal("join_league"),
        displayName: z.string().max(100)
    }),
    z.object({
        ...base,
        kind: z.literal("leave_league")
    }),
    z.object({
        ...base,
        kind: z.literal("set_league_hidden"),
        hidden: z.boolean()
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
// observe sees each answer fact as the replay classifies it; it cannot change the replay.
export function questionProgress(state: LearnerState, observe?: (fact: AnswerFact, step: AnswerStep) => void) {
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
        const first = p.coveredAt === null;
        const learnedBefore = p.successes >= 2;
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
        observe?.(e, { first, due, qualified: qualifies, learnedBefore, learnedAfter: p.successes >= 2 });
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
export type AnswerFact = Extract<z.infer<typeof fact>, { kind: "answer" }>;
export interface AnswerStep {
    first: boolean;
    due: boolean;
    // The answer counted toward learning (B4): a qualifying correct answer.
    qualified: boolean;
    learnedBefore: boolean;
    learnedAfter: boolean;
}
function answerFacts(evidence: LearnerState["evidence"]) {
    return evidence.filter((e): e is AnswerFact => e.kind === "answer").sort((a, b) => a.at - b.at || a.sequence - b.sequence);
}
// As in helpView: a question without bank text has no explanation to show, only the fallback sentence.
function teachingStatusOf(questionId: string): "bank_text_unreviewed" | "teaching_gap" {
    return bankQuestions.find(q => q.questionId === questionId)?.explanation ? "bank_text_unreviewed" : "teaching_gap";
}
function feedbackOf(e: AnswerFact) {
    return {
        ...submitAnswer(e.questionId, e.answer),
        assisted: e.assisted,
        confidence: e.confidence,
        sourceId: `question-bank.json#${e.questionId}`,
        teachingStatus: teachingStatusOf(e.questionId)
    };
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
/** Today's wrong answers, the latest per question and newest first, for read-only review. Viewing them records nothing. */
export function todayMistakes(state: LearnerState, now: number) {
    const today = localDay(now, state.profile.timezone);
    const latest = new Map<string, AnswerFact>();
    for (const e of answerFacts(state.evidence))
        if (!e.correct && localDay(e.at, state.profile.timezone) === today)
            latest.set(e.questionId, e);
    return [...latest.values()].sort((a, b) => b.at - a.at || b.sequence - a.sequence).map(e => ({
        question: safeQuestion(e.questionId),
        chosen: e.answer,
        correctAnswer: submitAnswer(e.questionId, e.answer).correctAnswer,
        explanation: bankQuestions.find(q => q.questionId === e.questionId)?.explanation ?? null,
        at: e.at
    }));
}
/** Questions with one qualifying success: not learned yet, learned by the next qualifying answer. */
function onTheWay(questions: { successes: number }[]) {
    return questions.filter(q => q.successes === 1).length;
}
/**
 * Today's goal ring, what comes back tomorrow and the questions on the way to Đã thuộc, shared by the home
 * card and the finish screen. nextLearnAt is the earliest time one of those can count: a due review that is
 * also eligible, since help after the success delays eligibility past the due time.
 */
function dailySummary(state: LearnerState, now: number, p = questionProgress(state)) {
    const today = localDay(now, state.profile.timezone);
    const tomorrow = localDay(now + DAY, state.profile.timezone);
    const progress = [...p.values()];
    const learnAt = progress.flatMap(q => q.successes === 1 && q.dueAt !== null ? [Math.max(q.dueAt, q.eligibleAt)] : []);
    return {
        newToday: progress.filter(q => q.coveredAt !== null && q.coveredDay === today).length,
        dailyGoal: state.profile.dailyGoal,
        dueCount: progress.filter(q => q.dueAt !== null && q.dueAt <= now).length,
        wrongToday: todayMistakes(state, now).length,
        // Not due yet, but due by the end of the learner-local tomorrow: what the finish screen says comes back tomorrow.
        // Answers given just now are due 24 hours after they were given, which is slightly under now + 24 hours.
        tomorrowDue: progress.filter(q => q.dueAt !== null && q.dueAt > now && q.dueAt < now + 3 * DAY && localDay(q.dueAt, state.profile.timezone) <= tomorrow).length,
        onTheWay: onTheWay(progress),
        nextLearnAt: learnAt.length ? Math.min(...learnAt) : null
    };
}
export function courseView(state: LearnerState, now: number, nothingToStudy = false) {
    const p = questionProgress(state);
    const covered = [...p.values()].filter(q => q.coveredAt !== null);
    const daily = dailySummary(state, now, p);
    const requiredStudyDays = Math.ceil((600 - covered.length) / state.profile.dailyGoal);
    const todayNew = daily.newToday;
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
    const unitList = listUnits(state, "", now);
    return {
        kind: "course" as const,
        nothingToStudy,
        bankVersion,
        total: 600,
        covered: covered.length,
        learned: [...p.values()].filter(q => q.successes >= 2).length,
        onTheWay: daily.onTheWay,
        nextLearnAt: daily.nextLearnAt,
        newToday: daily.newToday,
        dailyGoal: daily.dailyGoal,
        dueCount: daily.dueCount,
        wrongToday: daily.wrongToday,
        streak: dailyStreak(state.evidence.filter(event => event.kind === "answer").map(event => event.at), state.profile.timezone, now),
        requiredStudyDays,
        calendarCapacity,
        bufferDays: calendarCapacity - requiredStudyDays,
        forecastFinishAt,
        targetCompatible: forecastFinishAt !== null && forecastFinishAt <= state.profile.targetDate,
        profile: state.profile,
        familyStatus: "approved",
        units: unitList.units.filter(u => u.kind === "category"),
        customCategory: unitList.customCategory,
        mockLibraryAvailable: false,
        results: answerResults(answerFacts(state.evidence)),
        xp: xpSummary(state, now),
        tomorrowDue: daily.tomorrowDue,
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
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();
    const selected = units.filter(u => normalize(`${u.id} ${u.title} ${u.questionIds.join(" ")} ${u.comparisonAxes.join(" ")}`).includes(normalize(query))).map(({ questionIds, ...u }) => ({
        ...u,
        questionCount: questionIds.length,
        firstQuestionId: questionIds[0] ?? null,
        covered: questionIds.filter(id => p.get(id)?.coveredAt !== null).length,
        learned: questionIds.filter(id => (p.get(id)?.successes ?? 0) >= 2).length,
        onTheWay: onTheWay(questionIds.flatMap(id => p.get(id) ?? [])),
        due: questionIds.filter(id => {
            const due = p.get(id)?.dueAt;
            return due !== null && due !== undefined && due <= now;
        }).length
    }));
    return {
        kind: "units" as const,
        customCategory: {
            id: CONFUSING_CATEGORY_ID,
            title: "C\u00E2u h\u1ECFi d\u1EC5 nh\u1EA7m l\u1EABn",
            status: "approved",
            familyCount: families.length,
            total: new Set(families.flatMap(f => f.questionIds)).size,
            covered: [...new Set(families.flatMap(f => f.questionIds))].filter(id => p.get(id)?.coveredAt !== null).length,
            learned: [...new Set(families.flatMap(f => f.questionIds))].filter(id => (p.get(id)?.successes ?? 0) >= 2).length,
            onTheWay: onTheWay([...new Set(families.flatMap(f => f.questionIds))].flatMap(id => p.get(id) ?? [])),
            due: [...new Set(families.flatMap(f => f.questionIds))].filter(id => {
                const due = p.get(id)?.dueAt;
                return due !== null && due !== undefined && due <= now;
            }).length
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
function activeItem(s: Session) {
    return s.items.find(i => i.questionId === s.activeQuestionId && (i.repairOf !== undefined) === s.activeRepair);
}
function canRetryStudy(state: LearnerState, s: Session) {
    const i = activeItem(s);
    return s.status === "active" && s.mode === "lesson" && i?.status === "answered" && i.group === undefined && i.repairOf === undefined && state.evidence.some(e => e.id === i.answerId && e.kind === "answer" && !e.correct);
}
function activate(s: Session, i: Item | undefined) {
    s.activeQuestionId = i?.questionId ?? null;
    s.activeRepair = i?.repairOf !== undefined;
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
    const active = activeItem(s);
    // Both pair verdicts appear together (INT-02), so a half-answered pair's answer stays out of every result below.
    const waitingGroups = new Set(s.items.flatMap(i => i.group !== undefined && i.status === "pending" ? [i.group] : []));
    const withheld = new Set(s.items.flatMap(i => i.group !== undefined && waitingGroups.has(i.group) && i.answerId ? [i.answerId] : []));
    const answers = answerFacts(state.evidence).filter(e => e.activityId === s.id && !withheld.has(e.id));
    const results = answerResults(answers);
    const answerOf = (i: Item) => i.status !== "answered" ? undefined : i.answerId ? answers.find(e => e.id === i.answerId) : answers.filter(e => e.questionId === i.questionId).at(-1);
    const activeAnswer = active ? answerOf(active) : undefined;
    const awards = answerAwards(state);
    const firstSuccesses = new Set<string>();
    questionProgress(state, (e, step) => {
        if (step.first && step.qualified)
            firstSuccesses.add(e.id);
    });
    const planned = s.items.filter(i => i.repairOf === undefined && i.group === undefined);
    const repairStep = active?.repairOf !== undefined && active.status === "pending" ? active : undefined;
    const pairItems = active?.group === undefined ? [] : s.items.filter(i => i.group === active.group);
    const family = families.find(f => f.id === active?.group);
    const wrongItems = [...new Set(answers.filter(e => !e.correct).map(e => e.questionId))];
    const lightningOver = s.mode === "lightning" && (s.status === "complete" || (s.deadline !== undefined && now >= s.deadline));
    return {
        kind: "study" as const,
        sessionId: s.id,
        status: s.status,
        override: s.override,
        // The category or confusing-question group the learner chose, so the intro names the skill (ui-ux 3).
        unit: !s.unitId ? null : {
            id: s.unitId,
            title: s.unitId === CONFUSING_CATEGORY_ID ? "Câu hỏi dễ nhầm lẫn" : categoryTitles[s.unitId] ?? families.find(f => f.id === s.unitId)?.title ?? s.unitId,
            family: !categories.includes(s.unitId)
        },
        reviewOnly: s.reviewOnly,
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
        questionStatus: active?.status ?? null,
        queue: s.items,
        currentFeedback: activeAnswer ? feedbackOf(activeAnswer) : null,
        canRetry: canRetryStudy(state, s),
        // A waiting repair step shows help only when asked for again, not because the wrong answer's feedback was shown.
        help: q && state.evidence.some(e => e.kind === "help" && e.questionId === q && (repairStep ? !e.feedback && e.at >= repairStep.bindingAt : e.at >= s.createdAt)) ? helpView(q) : null,
        sessionResults: {
            answered: results.totalAttempts,
            correct: results.correctAttempts,
            wrong: results.wrongAttempts,
            items: answers.map(e => ({ questionId: e.questionId, answer: e.answer, correct: e.correct }))
        },
        mode: s.mode,
        itemKind: active?.kind ?? null,
        repairOf: active?.repairOf ?? null,
        xp: answers.reduce((sum, e) => sum + (awards.get(e.id)?.xp ?? 0), 0) + lessonXp(state, s),
        combo: comboOf(answers),
        lastAward: activeAnswer ? awardParts(awards.get(activeAnswer.id)) : null,
        // The lesson plan for the intro screen; repair steps and compare-the-pair items are counted separately.
        steps: {
            review: planned.filter(i => i.kind === "review").length,
            new: planned.filter(i => i.kind === "new").length,
            practice: planned.filter(i => i.kind === "practice").length,
            pairGroups: new Set(s.items.flatMap(i => i.group === undefined ? [] : [i.group])).size
        },
        deadline: s.deadline ?? null,
        remainingMs: s.deadline === undefined ? null : Math.max(0, s.deadline - now),
        serverNow: now,
        correctCount: results.correctAttempts,
        wrongItems,
        // Finish-screen counts for this session: newly mastered questions, then the muted assisted, guessed and skipped line.
        masteredCount: answers.filter(e => awards.get(e.id)?.masteredNow).length,
        // First answers to a question that counted toward learning: correct, unassisted, not a guess, with no earlier help.
        firstCorrectCount: answers.filter(e => firstSuccesses.has(e.id)).length,
        assistedCount: answers.filter(e => e.assisted).length,
        guessedCount: answers.filter(e => e.confidence === "guess").length,
        skippedCount: s.items.filter(i => i.skipped).length,
        skippedPending: s.items.filter(i => i.skipped && i.status === "pending").length,
        goal: dailySummary(state, now),
        // Once a lightning round is over, the answers it got wrong, so the card can show them without recording help.
        review: lightningOver ? wrongItems.map(questionId => {
            const chosen = answers.filter(e => e.questionId === questionId && !e.correct).at(-1)?.answer ?? "A";
            return { question: safeQuestion(questionId), chosen, correctAnswer: submitAnswer(questionId, chosen).correctAnswer };
        }) : null,
        pair: active?.group === undefined ? null : {
            group: active.group,
            familyId: active.group,
            title: family?.title ?? active.group,
            axes: family?.comparisonAxes ?? [],
            status: "approved" as const,
            questions: pairItems.map(i => safeQuestion(i.questionId)),
            feedback: pairItems.map(i => {
                const e = answerOf(i);
                return e ? { ...feedbackOf(e), award: awardParts(awards.get(e.id)) } : null;
            })
        }
    };
}
/**
 * The answer key for every question in an open lesson or lightning round, so the card can show a verdict before
 * the server confirms it. It travels in hidden result metadata; mock tests and closed sessions get none.
 */
export function lessonKeys(view: Pick<ReturnType<typeof studyView>, "status" | "mode" | "queue">) {
    if (view.status === "complete" || (view.mode !== "lesson" && view.mode !== "lightning"))
        return null;
    return Object.fromEntries([...new Set(view.queue.map(i => i.questionId))].map(id => {
        const question = safeQuestion(id);
        const { correctAnswer, explanation } = submitAnswer(id, question.options[0]?.id ?? "A");
        return [id, { question, correctAnswer, explanation, teachingStatus: teachingStatusOf(id) }];
    }));
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
        // When the test was submitted, expired or left; the result screen shows the time used.
        closedAt: m.status === "active" ? null : m.closedAt,
        serverNow: now,
        remainingMs: m.status === "active" ? Math.max(0, m.deadline - now) : 0,
        expired: m.status === "active" && now >= m.deadline,
        profile: "owner-30-27-20-v1",
        composition: "random bank practice; official category distribution unvalidated",
        questions: m.questionIds.map(id => ({ ...safeQuestion(id), critical: m.status === "active" ? null : safeQuestion(id).critical })),
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
    const blocked = runningMockQuestions(state);
    if (!s.override)
        for (const q of dueIds(state, now).filter(q => !blocked.has(q)))
            if (!s.items.some(i => i.questionId === q))
                s.items.push({
                    questionId: q,
                    kind: "review",
                    status: "pending",
                    bindingAt: now
                });
    s.items.sort((a, b) => Number(b.kind === "review") - Number(a.kind === "review"));
    activate(s, s.items.find(i => i.status === "pending" && !blocked.has(i.questionId)));
    s.status = s.activeQuestionId ? "active" : s.items.some(i => i.status === "pending") ? "paused" : "complete";
    if (s.status === "complete")
        s.completedAt ??= now;
}
/**
 * PLAY-05: one repair step after a wrong answer, placed after the next two pending steps, or last when
 * fewer remain. With no other step left, nothing separates it from the feedback that just showed the
 * answer, so no repair is added. It never lands inside a compare-the-pair group.
 */
function insertRepair(s: Session, answered: Item, now: number) {
    const at = s.items.indexOf(answered);
    const later = s.items.flatMap((i, index) => index > at && i.status === "pending" ? [index] : []);
    const siblingWaiting = answered.group !== undefined && s.items.some(i => i.group === answered.group && i.status === "pending");
    if (!later.length && !siblingWaiting)
        return;
    let position = later[1] === undefined ? s.items.length : later[1] + 1;
    while (position < s.items.length && s.items[position]?.group !== undefined && s.items[position]?.group === s.items[position - 1]?.group)
        position++;
    // bindingAt equals the feedback event's time, so B4 treats the repair answer as assisted.
    s.items.splice(position, 0, { questionId: answered.questionId, kind: "practice", status: "pending", bindingAt: now, repairOf: answered.questionId });
}
/**
 * INT-02: end the lesson with one of its new questions and a sibling from the same confusing-question
 * family, grouped so both are answered before either verdict shows. The sibling is not learned, not
 * already in the lesson and not in a running mock. Families with comparison axes and fewer members come
 * first; ties take the family whose new question sits latest, which moves the lesson plan least.
 */
function addPair(s: Session, progress: ReturnType<typeof questionProgress>, blocked: Set<string>, now: number) {
    const inLesson = new Set(s.items.map(i => i.questionId));
    const newIds = s.items.filter(i => i.kind === "new").map(i => i.questionId);
    const candidates = families.flatMap((family, order) => {
        const question = newIds.filter(q => family.questionIds.includes(q)).at(-1);
        const sibling = family.questionIds.find(q => !inLesson.has(q) && !blocked.has(q) && (progress.get(q)?.successes ?? 0) < 2);
        return question !== undefined && sibling !== undefined ? [{ family, order, question, sibling }] : [];
    });
    const pick = candidates.sort((a, b) => Number(b.family.comparisonAxes.length > 0) - Number(a.family.comparisonAxes.length > 0)
        || a.family.questionIds.length - b.family.questionIds.length
        || newIds.indexOf(b.question) - newIds.indexOf(a.question)
        || a.order - b.order)[0];
    const moved = s.items.find(i => i.questionId === pick?.question);
    if (!pick || !moved)
        return;
    const group = pick.family.id;
    s.items = [
        ...s.items.filter(i => i !== moved),
        { ...moved, group },
        { questionId: pick.sibling, kind: progress.get(pick.sibling)?.coveredAt === null ? "new" : "practice", status: "pending", bindingAt: now, group }
    ];
}
export function runningMockQuestions(state: LearnerState) {
    return new Set(state.mocks.flatMap(m => m.status === "active" ? m.questionIds : []));
}
function reopen(state: LearnerState, s: z.infer<typeof session>, now: number) {
    if (s.mode === "lightning" && s.status === "complete")
        return;
    if (activeItem(s)?.status === "answered")
        s.status = "active";
    else {
        const repair = activeItem(s);
        reconcile(state, s, now);
        if (repair?.repairOf !== undefined && repair.status === "pending" && !runningMockQuestions(state).has(repair.questionId)) {
            activate(s, repair);
            s.status = "active";
        }
    }
}
/** A lightning round ends at its deadline. Its unanswered questions stay unanswered and unscored. */
export function closeExpiredLightning(state: LearnerState, now: number) {
    let closed = false;
    for (const s of state.sessions)
        if (s.mode === "lightning" && s.status !== "complete" && s.deadline !== undefined && now >= s.deadline) {
            s.status = "complete";
            activate(s, undefined);
            closed = true;
        }
    return closed;
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
/** Undo an expiry close so a choice made before the deadline, but delayed on its way here, can still count. */
function reopenExpiredMock(state: LearnerState, m: Extract<z.infer<typeof mock>, { status: "finalised" }>) {
    const members = new Set(m.questionIds);
    state.evidence = state.evidence.filter(e => !((e.kind === "answer" && e.activityId === m.id) || (e.kind === "gap" && e.at === m.deadline && members.has(e.questionId))));
    state.mocks[state.mocks.findIndex(x => x.id === m.id)] = { id: m.id, createdAt: m.createdAt, deadline: m.deadline, questionIds: m.questionIds, choices: m.choices, status: "active" };
}
function assertNotInRunningMock(state: LearnerState, questionId: string) {
    if (state.mocks.some(m => m.status === "active" && m.questionIds.includes(questionId)))
        throw new Error("MOCK_IN_PROGRESS");
}
function digest(command: LearningCommand) {
    return createHash("sha256").update(JSON.stringify({ ...command, lagMs: undefined, leftMs: undefined })).digest("hex");
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
    if ((command.kind === "answer_study" || command.kind === "next_study") && command.lagMs) {
        // The card pauses its clock while a request is in flight and reports the total wait, so slow loading never costs round time.
        const s = state.sessions.find(s => s.id === command.sessionId);
        if (s?.mode === "lightning" && s.deadline !== undefined)
            s.deadline = Math.max(s.deadline, s.createdAt + LIGHTNING_MS + Math.min(command.lagMs, LIGHTNING_MAX_LAG_MS));
    }
    if ((command.kind === "answer_study" || command.kind === "next_study") && (command.leftMs ?? 0) > 0) {
        // The card answers before the server hears of it, so an action taken in time can arrive after the deadline.
        const s = state.sessions.find(s => s.id === command.sessionId);
        if (s?.mode === "lightning" && s.status !== "complete" && s.deadline !== undefined && now < s.deadline + LIGHTNING_LATE_MS)
            s.deadline = Math.min(s.createdAt + LIGHTNING_MS + LIGHTNING_MAX_LAG_MS, Math.max(s.deadline, now + (command.leftMs ?? 0)));
    }
    closeExpiredLightning(state, now);
    let activityId: string | null = null;
    let viewKind: "course" | "study" | "mock" | "help" | "answer" = "course";
    let resumed = false;
    let nothingToStudy = false;
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
            const overridden = command.override === true || command.unitId !== undefined || command.questionIds !== undefined || command.count !== undefined;
            const open = overridden ? undefined : [...state.sessions].reverse().find(s => !s.override && s.reviewOnly === (command.reviewOnly === true) && s.status !== "complete");
            if (open) {
                reopen(state, open, now);
                activityId = open.id;
                viewKind = "study";
                break;
            }
            const blocked = runningMockQuestions(state);
            const pool = (command.questionIds ? [...new Set(command.questionIds)] : unitQuestions(command.unitId)).filter(q => !blocked.has(q));
            for (const q of pool)
                safeQuestion(q);
            const reviews = overridden ? [] : dueIds(state, now).filter(q => !blocked.has(q));
            const today = courseView(state, now);
            const remainingQuota = Math.max(0, state.profile.dailyGoal - today.newToday);
            const selected = command.reviewOnly ? [] : overridden ? pool.slice(0, command.count ?? state.profile.dailyGoal) : pool.filter(q => progress.get(q)?.coveredAt === null).slice(0, Math.min(remainingQuota, command.count ?? remainingQuota));
            const ids = [...new Set([...reviews, ...selected])];
            if (!ids.length) {
                nothingToStudy = true;
                break;
            }
            if (overridden)
                for (const other of state.sessions)
                    if (other.override && other.status === "active")
                        other.status = "paused";
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
                activeQuestionId: ids[0] ?? null,
                activeRepair: false,
                mode: "lesson"
            };
            // An exact count or question list is the learner's or ChatGPT's chosen lesson, so it gets no extra challenge.
            if (!command.reviewOnly && command.questionIds === undefined && command.count === undefined) {
                addPair(s, progress, blocked, now);
                activate(s, s.items[0]);
            }
            state.sessions.push(s);
            viewKind = "study";
            break;
        }
        case "answer_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.mode === "lightning" && s.deadline !== undefined && now >= s.deadline)
                throw new Error("LIGHTNING_EXPIRED");
            if (s.status !== "active")
                throw new Error("SESSION_NOT_ACTIVE");
            const active = activeItem(s);
            const i = s.activeQuestionId === command.questionId ? active : active?.group === undefined ? undefined : s.items.find(i => i.group === active.group && i.questionId === command.questionId);
            if (!i)
                throw new Error("QUESTION_BINDING_MISMATCH");
            if (i.status !== "pending")
                throw new Error("QUESTION_NOT_PENDING");
            assertNotInRunningMock(state, command.questionId);
            const scored = submitAnswer(command.questionId, command.answer);
            const latestAnswer = [...state.evidence].reverse().find(e => e.kind === "answer" && e.questionId === command.questionId);
            const assisted = i.repairOf !== undefined || state.evidence.some(e => e.kind === "help" && e.questionId === command.questionId && e.at >= i.bindingAt && (latestAnswer === undefined || e.sequence > latestAnswer.sequence));
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
            i.answerId = state.evidence.at(-1)?.id;
            append(state, command.questionId, now, {
                kind: "help",
                feedback: true
            });
            if (!scored.correct && s.mode === "lesson" && i.repairOf === undefined)
                insertRepair(s, i, now);
            // Within a pair, the other question stays active until it is answered too.
            if (i.group !== undefined)
                activate(s, s.items.find(x => x.group === i.group && x.status === "pending") ?? i);
            break;
        }
        case "retry_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.activeQuestionId !== command.questionId || !canRetryStudy(state, s))
                throw new Error("RETRY_NOT_AVAILABLE");
            let repair = s.items.find(i => i.repairOf === command.questionId && i.status === "pending");
            if (!repair) {
                const original = activeItem(s)!;
                const answer = state.evidence.find(e => e.id === original.answerId)!;
                repair = { questionId: command.questionId, kind: "practice", status: "pending", bindingAt: answer.at, repairOf: command.questionId };
                s.items.push(repair);
            }
            activate(s, repair);
            break;
        }
        case "next_study": {
            const s = findSession(state, command.sessionId);
            activityId = s.id;
            viewKind = "study";
            if (s.status !== "active")
                throw new Error("SESSION_NOT_ACTIVE");
            const active = activeItem(s);
            if (command.questionId !== undefined) {
                if (s.mode !== "lesson")
                    throw new Error("QUESTION_NAVIGATION_NOT_AVAILABLE");
                if (active?.status === "pending")
                    throw new Error("ANSWER_OR_SKIP_FIRST");
                const target = s.items.find(i => i.questionId === command.questionId && (i.repairOf !== undefined) === (command.repair === true));
                if (!target)
                    throw new Error("QUESTION_NOT_IN_SESSION");
                if (target.group !== undefined && s.items.some(i => i.group === target.group && i.status === "pending"))
                    throw new Error("PAIR_INCOMPLETE");
                activate(s, target);
                break;
            }
            if (active?.status === "pending" || (active?.group !== undefined && s.items.some(i => i.group === active.group && i.status === "pending")))
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
            const active = activeItem(s);
            // A compare-the-pair group is skipped and requeued as one step.
            const skipped = active?.group === undefined ? active ? [active] : [] : s.items.filter(i => i.group === active.group);
            for (const i of skipped)
                if (i.status === "pending")
                    i.skipped = true;
            s.items = [...s.items.filter(i => !skipped.includes(i)), ...skipped];
            activate(s, s.items.find(i => i.status === "pending" && !skipped.includes(i) && (active?.kind!=="review"||i.kind==="review")));
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
            let m = findMock(state, command.attemptId);
            activityId = m.id;
            viewKind = "mock";
            let late = false;
            if (m.status === "finalised" && m.reason === "expiry" && (command.leftMs ?? 0) > 0 && now < m.deadline + MOCK_LATE_SAVE_MS && m.questionIds.includes(command.questionId)) {
                reopenExpiredMock(state, m);
                m = findMock(state, command.attemptId);
                late = true;
            }
            else if (expired.includes(m.id))
                break;
            if (m.status !== "active")
                throw new Error("MOCK_NOT_ACTIVE");
            if (!m.questionIds.includes(command.questionId))
                throw new Error("QUESTION_BINDING_MISMATCH");
            if (!safeQuestion(command.questionId).options.some(o => o.id === command.answer))
                throw new Error("INVALID_ANSWER");
            const savedAt = Math.min(now, m.deadline);
            m.choices[command.questionId] = {
                answer: command.answer,
                at: savedAt,
                localDay: localDay(now, state.profile.timezone),
                acceptedOrder: state.nextOrder++
            };
            if (late)
                closeMock(state, m.id, now, "expiry");
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
            if (m.status === "finalised")
                throw new Error("MOCK_NOT_ACTIVE");
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
        case "start_lightning": {
            // INT-03: up to 30 distinct questions this learner has answered before, in an order seeded by the request ID.
            const progress = questionProgress(state);
            const blocked = runningMockQuestions(state);
            const seen = bankQuestions.map(q => q.questionId).filter(q => progress.get(q)?.coveredAt !== null && !blocked.has(q));
            if (!seen.length)
                throw new Error("LIGHTNING_NEEDS_HISTORY");
            const order = seen.map(q => ({ q, key: createHash("sha256").update(`${command.requestId}:${q}`).digest("hex") })).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 30);
            activityId = randomUUID();
            state.sessions.push({
                id: activityId,
                createdAt: now,
                status: "active",
                // Lightning is its own activity: never reopened as the daily lesson and never given due reviews.
                override: true,
                reviewOnly: false,
                unitId: null,
                items: order.map(({ q }) => ({ questionId: q, kind: "practice", status: "pending", bindingAt: now })),
                activeQuestionId: order[0]?.q ?? null,
                activeRepair: false,
                mode: "lightning",
                deadline: now + LIGHTNING_MS
            });
            viewKind = "study";
            break;
        }
        case "join_league": {
            // LEA-01: after a finished lesson, under a name the learner chose; joining again only renames.
            if (!hasFinishedLesson(state))
                throw new Error("LEAGUE_NEEDS_LESSON");
            const displayName = leagueDisplayName(command.displayName);
            state.league = state.league ? { ...state.league, displayName } : { displayName, joinedAt: now, hidden: false };
            break;
        }
        case "leave_league":
            state.league = null;
            break;
        case "set_league_hidden":
            if (!state.league)
                throw new Error("LEAGUE_NOT_JOINED");
            state.league.hidden = command.hidden;
            break;
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
        view: viewKind === "study" && activityId ? studyView(state, activityId, now) : viewKind === "mock" && activityId ? mockView(state, activityId, now, resumed) : viewKind === "help" && activityId ? helpView(activityId) : viewKind === "answer" && activityId ? answerView(state, activityId) : courseView(state, now, nothingToStudy)
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
