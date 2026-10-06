// Game values (PRD section 6) derived from saved learning events. Nothing here is stored, so a replayed
// request, which adds no evidence, cannot add XP, and these rules never feed back into B4 scheduling.
import { questionProgress, type AnswerFact, type LearnerState } from "./learning.js";

export type AwardReason = "first_correct" | "first_wrong" | "review_correct" | "review_wrong" | "assisted" | "repair" | "practice" | "lightning";
export interface Award {
    xp: number;
    reason: AwardReason;
    masteredNow: boolean;
}

const HOUR = 3600000;
const DAY_MS = 24 * HOUR;
const BASE_XP: Record<Exclude<AwardReason, "lightning">, number> = {
    first_correct: 10,
    first_wrong: 3,
    review_correct: 10,
    review_wrong: 3,
    assisted: 3,
    repair: 2,
    practice: 2
};
const MASTERED_BONUS = 15;
const PRACTICE_CAP_PER_DAY = 50;
const LIGHTNING_CAP_PER_ROUND = 15;
const LESSON_XP = 10;
const MOCK_FINALISED_XP = 20;
const MOCK_PASSED_XP = 30;
const SUSPICIOUS_DAILY_XP = 500;
const LEAGUE_UTC_OFFSET = 7 * HOUR;

/**
 * One award per scored study answer, in questionProgress replay order. Precedence, first match wins:
 * mock answer (no award), lightning round, repair step, assisted, first answer, due review, other practice.
 * Assisted answers on questions that were neither new nor due share the practice cap, bucketed by the
 * learner-local day saved with each answer so a later timezone change cannot move past awards.
 * masteredNow adds its bonus outside both caps.
 */
export function answerAwards(state: LearnerState) {
    const lightning = new Set(state.sessions.filter(s => s.mode === "lightning").map(s => s.id));
    const repairs = new Set(state.sessions.flatMap(s => s.items.flatMap(i => i.repairOf !== undefined && i.answerId ? [i.answerId] : [])));
    const practiceSpent = new Map<string, number>();
    const lightningSpent = new Map<string, number>();
    const awards = new Map<string, Award>();
    questionProgress(state, (e, step) => {
        if (e.origin === "mock")
            return;
        const masteredNow = !step.learnedBefore && step.learnedAfter;
        let reason: AwardReason;
        let xp: number;
        if (lightning.has(e.activityId)) {
            const spent = lightningSpent.get(e.activityId) ?? 0;
            reason = "lightning";
            xp = e.correct && spent < LIGHTNING_CAP_PER_ROUND ? 1 : 0;
            lightningSpent.set(e.activityId, spent + xp);
        }
        else if (repairs.has(e.id)) {
            reason = "repair";
            xp = BASE_XP.repair;
        }
        else {
            reason = e.assisted ? "assisted" : step.first ? e.correct ? "first_correct" : "first_wrong" : step.due ? e.correct ? "review_correct" : "review_wrong" : "practice";
            xp = BASE_XP[reason];
            if (!step.first && !step.due) {
                const spent = practiceSpent.get(e.localDay) ?? 0;
                xp = Math.min(xp, PRACTICE_CAP_PER_DAY - spent);
                practiceSpent.set(e.localDay, spent + xp);
            }
        }
        awards.set(e.id, { xp: xp + (masteredNow ? MASTERED_BONUS : 0), reason, masteredNow });
    });
    return awards;
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

/** The lesson-finished bonus a session has earned: 10 once it is finished, otherwise 0. */
export function lessonXp(state: LearnerState, session: LearnerState["sessions"][number]) {
    return lessonFinishedAt(state, session) === null ? 0 : LESSON_XP;
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
 * suspicious: some learner-local day in the learner's history earned more than 500 XP (LEA-04).
 */
export function xpSummary(state: LearnerState, now: number) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: state.profile.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const today = day.format(now);
    const { weekStartsAt, weekEndsAt } = leagueWeek(now);
    const perDay = new Map<string, number>();
    const summary = { total: 0, today: 0, week: 0, weekStartsAt, weekEndsAt, suspicious: false };
    for (const e of xpEvents(state)) {
        const key = day.format(e.at);
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
