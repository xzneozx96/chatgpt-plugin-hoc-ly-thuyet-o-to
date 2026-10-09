// Game values (PRD section 6) derived from saved learning events. Nothing here is stored, so a replayed
// request, which adds no evidence, cannot add XP, and these rules never feed back into B4 scheduling.
import { applyAnswer, localDay, questionProgress, type AnswerFact, type AnswerStep, type LearnerState, type ScoredAnswer } from "./learning.js";

export type AwardReason = "first_correct" | "first_wrong" | "review_correct" | "review_wrong" | "assisted" | "practice" | "lightning";
export interface Award {
    xp: number;
    reason: AwardReason;
    masteredNow: boolean;
}

const HOUR = 3600000;
const DAY_MS = 24 * HOUR;
const BASE_XP: Record<Exclude<AwardReason, "lightning">, number> = {
    first_correct: 10,
    first_wrong: -3,
    review_correct: 10,
    review_wrong: -3,
    assisted: 3,
    practice: 2
};
const MASTERED_BONUS = 15;
const PRACTICE_CAP_PER_DAY = 50;
const LIGHTNING_CAP_PER_ROUND = 15;
const LESSON_XP = 10;
const MIN_BONUS_ANSWERS = 5;
const MOCK_FINALISED_XP = 20;
const MOCK_PASSED_XP = 30;
const SUSPICIOUS_DAILY_XP = 500;
const LEAGUE_UTC_OFFSET = 7 * HOUR;

/** Where a study answer was given: a lightning round or any other study step. */
type AnswerPath = "lightning" | "study";
/** What is left of the two XP caps for an answer: the learner-local day's practice XP and the lightning round's XP. */
interface AwardBudget {
    practiceLeft: number;
    lightningLeft: number;
}

/**
 * The award for one scored study answer. Precedence, first match wins: lightning round,
 * assisted, first answer, due review, other practice. Assisted answers on questions that were neither new
 * nor due share the practice cap. masteredNow adds its bonus outside both caps. charge is the XP the
 * answer takes from a cap, so the caller can track what is left.
 */
function awardFor(step: AnswerStep, answer: Pick<AnswerFact, "correct" | "assisted">, path: AnswerPath, budget: AwardBudget): { award: Award; charge: { cap: "practice" | "lightning"; xp: number } | null } {
    if (!answer.correct) {
        const reason: AwardReason = path === "lightning" ? "lightning" : answer.assisted ? "assisted" : step.first ? "first_wrong" : step.due ? "review_wrong" : "practice";
        return { award: { xp: -3, reason, masteredNow: false }, charge: null };
    }
    const masteredNow = !step.learnedBefore && step.learnedAfter;
    const bonus = masteredNow ? MASTERED_BONUS : 0;
    if (path === "lightning") {
        const xp = budget.lightningLeft > 0 ? 1 : 0;
        return { award: { xp: xp + bonus, reason: "lightning", masteredNow }, charge: { cap: "lightning", xp } };
    }
    const reason: AwardReason = answer.assisted ? "assisted" : step.first ? "first_correct" : step.due ? "review_correct" : "practice";
    if (step.first || step.due)
        return { award: { xp: BASE_XP[reason] + bonus, reason, masteredNow }, charge: null };
    const xp = Math.min(BASE_XP[reason], budget.practiceLeft);
    return { award: { xp: xp + bonus, reason, masteredNow }, charge: { cap: "practice", xp } };
}

/**
 * Replays every scored study answer through awardFor, in questionProgress replay order. Mock answers get no
 * award. Practice XP is bucketed by the learner-local day saved with each answer, so a later timezone change
 * cannot move past awards; lightning XP by round.
 */
function replayAwards(state: LearnerState) {
    const lightning = new Set(state.sessions.filter(s => s.mode === "lightning").map(s => s.id));
    const practiceSpent = new Map<string, number>();
    const lightningSpent = new Map<string, number>();
    const awards = new Map<string, Award>();
    const progress = questionProgress(state, (e, step) => {
        if (e.origin === "mock")
            return;
        const path: AnswerPath = lightning.has(e.activityId) ? "lightning" : "study";
        const budget = { practiceLeft: PRACTICE_CAP_PER_DAY - (practiceSpent.get(e.localDay) ?? 0), lightningLeft: LIGHTNING_CAP_PER_ROUND - (lightningSpent.get(e.activityId) ?? 0) };
        const { award, charge } = awardFor(step, e, path, budget);
        if (charge?.cap === "practice")
            practiceSpent.set(e.localDay, (practiceSpent.get(e.localDay) ?? 0) + charge.xp);
        if (charge?.cap === "lightning")
            lightningSpent.set(e.activityId, (lightningSpent.get(e.activityId) ?? 0) + charge.xp);
        awards.set(e.id, award);
    });
    return { awards, progress, practiceSpent, lightningSpent };
}

export function answerAwards(state: LearnerState) {
    return replayAwards(state).awards;
}

/**
 * What answering each question now would earn, unassisted, in this session:
 * correct, correct but marked a guess, and wrong. Each hypothetical answer goes through the same applyAnswer
 * and awardFor as a saved one, so a hint cannot drift from the award the answer then gets. budget is what is
 * left of the caps now; lightningLeft is null outside a lightning round.
 */
export function awardHints(state: LearnerState, sessionId: string, now: number) {
    const { progress, practiceSpent, lightningSpent } = replayAwards(state);
    const day = localDay(now, state.profile.timezone);
    const lightningRound = state.sessions.some(s => s.id === sessionId && s.mode === "lightning");
    const path: AnswerPath = lightningRound ? "lightning" : "study";
    const budget = { practiceLeft: PRACTICE_CAP_PER_DAY - (practiceSpent.get(day) ?? 0), lightningLeft: LIGHTNING_CAP_PER_ROUND - (lightningSpent.get(sessionId) ?? 0) };
    const hintFor = (questionId: string) => {
        const p = progress.get(questionId);
        if (!p)
            throw new Error("QUESTION_NOT_FOUND");
        const award = (correct: boolean, confidence: ScoredAnswer["confidence"]) => {
            const answer = { at: now, localDay: day, correct, assisted: false, confidence };
            return awardFor(applyAnswer(structuredClone(p), answer), answer, path, budget).award;
        };
        return { correct: awardParts(award(true, "unknown")), guess: awardParts(award(true, "guess")), wrong: award(false, "unknown").xp };
    };
    return { hintFor, budget: { practiceLeft: budget.practiceLeft, lightningLeft: lightningRound ? budget.lightningLeft : null } };
}

/** An award split into the answer's own XP and the mastery bonus it includes, so the card shows both without arithmetic. */
export function awardParts(award: Award): Award & { baseXp: number; bonusXp: number };
export function awardParts(award: Award | undefined): (Award & { baseXp: number; bonusXp: number }) | null;
export function awardParts(award: Award | undefined) {
    if (!award)
        return null;
    const bonusXp = award.masteredNow ? MASTERED_BONUS : 0;
    return { ...award, baseXp: award.xp - bonusXp, bonusXp };
}

function sessionAnswers(state: LearnerState, sessionId: string) {
    return state.evidence.filter((e): e is AnswerFact => e.kind === "answer" && e.activityId === sessionId).sort((a, b) => a.at - b.at || a.sequence - b.sequence);
}

/**
 * A lesson counts as finished once it has completed with at least one answer of its own. A daily lesson
 * reopened later for newly due reviews keeps that finish. Sessions saved before completedAt existed use
 * their last answer while complete.
 */
export function lessonFinishedAt(state: LearnerState, session: LearnerState["sessions"][number]) {
    const lastAnswerAt = sessionAnswers(state, session.id).at(-1)?.at;
    if (session.mode !== "lesson" || lastAnswerAt === undefined)
        return null;
    return session.completedAt ?? (session.status === "complete" ? lastAnswerAt : null);
}

/** The lesson-finished bonus: 10 once a lesson of at least 5 answers is finished, so tiny lessons cannot farm it. */
export function lessonXp(state: LearnerState, session: LearnerState["sessions"][number]) {
    return lessonFinishedAt(state, session) === null || sessionAnswers(state, session.id).length < MIN_BONUS_ANSWERS ? 0 : LESSON_XP;
}

export function hasFinishedLesson(state: LearnerState) {
    return state.sessions.some(s => lessonFinishedAt(state, s) !== null);
}

export function comboOf(answers: Pick<AnswerFact, "correct">[]) {
    let combo = 0;
    for (let i = answers.length - 1; i >= 0 && answers[i]?.correct; i--)
        combo++;
    return combo;
}

/** Consecutive correct answers at the end of the session; a wrong answer resets it to 0. */
export function sessionCombo(state: LearnerState, sessionId: string) {
    return comboOf(sessionAnswers(state, sessionId));
}

/** The league week: Monday 00:00 to Sunday 23:59:59.999 in Vietnam time (UTC+7), whatever the learner's timezone. */
export function leagueWeek(now: number) {
    const day = Math.floor((now + LEAGUE_UTC_OFFSET) / DAY_MS);
    // 1970-01-01 was a Thursday, three days after a Monday.
    const weekStartsAt = (day - (day + 3) % 7) * DAY_MS - LEAGUE_UTC_OFFSET;
    return { weekStartsAt, weekEndsAt: weekStartsAt + 7 * DAY_MS - 1 };
}

/** Every XP grant with the time it was earned. */
function xpEvents(state: LearnerState) {
    const at = new Map(state.evidence.map(e => [e.id, e.at]));
    const events: { at: number; xp: number }[] = [];
    for (const [evidenceId, award] of answerAwards(state))
        events.push({ at: at.get(evidenceId) ?? 0, xp: award.xp });
    for (const s of state.sessions) {
        const finishedAt = lessonFinishedAt(state, s);
        if (finishedAt !== null)
            events.push({ at: finishedAt, xp: LESSON_XP });
    }
    for (const m of state.mocks)
        if (m.status === "finalised")
            events.push({ at: m.closedAt, xp: MOCK_FINALISED_XP + (m.passed ? MOCK_PASSED_XP : 0) });
    return events;
}

/**
 * total: all XP. today: learner-local today in the current profile timezone. week: the league week.
 * suspicious: a learner-local day in the current league week earned more than 500 XP (LEA-04), so one
 * heavy day only affects that week's ranking.
 */
export function xpSummary(state: LearnerState, now: number) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: state.profile.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const today = day.format(now);
    const { weekStartsAt, weekEndsAt } = leagueWeek(now);
    const perDay = new Map<string, number>();
    const summary = { total: 0, today: 0, week: 0, weekStartsAt, weekEndsAt, suspicious: false };
    for (const e of xpEvents(state)) {
        const key = day.format(e.at);
        if (e.at >= weekStartsAt && e.at <= weekEndsAt)
            perDay.set(key, (perDay.get(key) ?? 0) + e.xp);
        summary.total += e.xp;
        if (key === today)
            summary.today += e.xp;
        if (e.at >= weekStartsAt && e.at <= weekEndsAt)
            summary.week += e.xp;
    }
    summary.suspicious = [...perDay.values()].some(xp => xp > SUSPICIOUS_DAILY_XP);
    return summary;
}
