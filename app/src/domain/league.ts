// Weekly leagues (PRD 6.3, LEA-01..05): opt-in, pseudonymous boards built from other learners' saved events.
// A board row carries rank, display name and weekly XP only.
import { DAY, type LearnerState } from "./learning.js";
import { hasFinishedLesson, leagueWeek, xpSummary } from "./game.js";

const COHORT_SIZE = 30;
// Latin-script letters, which include every Vietnamese letter, plus digits, space and . _ -
const NAME_CHARACTERS = /^(?:(?=\p{Script=Latin})\p{L}|[0-9 ._-])+$/u;
// Vietnamese swear words differ from everyday words only by tone ("lồn" and "lớn", "buồi" and "buổi"), so accented
// words are checked against accented forms and only unaccented words against the ASCII list. Whole words match
// exactly; stems are rejected anywhere once separators are removed.
const BANNED_WORDS = new Set([
    "fuck", "fucker", "fucking", "fuk", "shit", "bitch", "cunt", "dick", "cock", "pussy", "asshole", "bastard", "whore", "slut", "porn", "rape", "nigger", "nigga", "faggot", "fag",
    "dit", "dm", "dmm", "dcm", "dkm", "dmcs", "vcl", "vkl", "vl", "cl", "clgt", "lon", "buoi", "cac", "deo"
]);
const BANNED_ACCENTED_WORDS = new Set(["lồn", "buồi", "cặc", "đéo", "địt", "đụ", "đĩ", "đcm", "đm", "đmm"]);
const BANNED_ACCENTED_STEMS = ["địtmẹ", "đụmá", "đụmẹ", "cáilồn", "conlồn", "concặc", "đéomẹ", "óccho"];
const BANNED_STEMS = ["fuck", "cunt", "nigger", "nigga", "faggot", "pussy", "asshole", "bitch", "ditme", "ditmen", "ditcon", "dume", "duma", "dumay", "dcm", "dmm", "vcl", "vkl", "clgt", "cailon", "conlon", "occho", "concac", "deome"];

function fold(text: string) {
    return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** The trimmed display name, or LEAGUE_NAME_INVALID (3–20 characters, letters, digits, space, . _ -) or LEAGUE_NAME_REJECTED. */
export function leagueDisplayName(raw: string) {
    const name = raw.normalize("NFC").trim();
    const length = [...name].length;
    if (length < 3 || length > 20 || !NAME_CHARACTERS.test(name) || !/[\p{L}0-9]/u.test(name))
        throw new Error("LEAGUE_NAME_INVALID");
    const words = name.toLowerCase().split(/[^\p{L}0-9]+/u).filter(Boolean);
    const plain = words.filter(word => fold(word) === word);
    const joined = words.join("");
    if (words.some(word => BANNED_ACCENTED_WORDS.has(word)) || BANNED_ACCENTED_STEMS.some(stem => joined.includes(stem))
        || plain.some(word => BANNED_WORDS.has(word)) || (plain.length === words.length && BANNED_STEMS.some(stem => joined.includes(stem))))
        throw new Error("LEAGUE_NAME_REJECTED");
    return name;
}

export interface LeagueMember {
    userId: string;
    state: LearnerState;
}

/**
 * Members, ordered by join time, form cohorts of 30; hidden and flagged members still hold their places,
 * so hiding never moves anyone between cohorts. The cohort is ranked by this week's XP, ties by join time.
 * Hidden members appear only on their own board. A member with a day over 500 XP is left out of ranking:
 * others do not see them, and they see their own row without a rank.
 */
export function leagueView(userId: string, self: LearnerState, members: LeagueMember[], now: number) {
    const { weekStartsAt, weekEndsAt } = leagueWeek(now);
    const own = xpSummary(self, now);
    const view = {
        kind: "league" as const,
        joined: self.league !== null,
        canJoin: self.league === null && hasFinishedLesson(self),
        displayName: self.league?.displayName ?? null,
        hidden: self.league?.hidden ?? false,
        weekStartsAt,
        weekEndsAt,
        daysLeft: Math.ceil((weekEndsAt + 1 - now) / DAY),
        rank: null as number | null,
        weekXp: own.week,
        rows: [] as { rank: number | null; displayName: string; weekXp: number; you: boolean }[]
    };
    if (!self.league)
        return view;
    const everyone = [...members.filter(m => m.userId !== userId), { userId, state: self }]
        .flatMap(m => m.state.league ? [{ ...m, league: m.state.league }] : [])
        .sort((a, b) => a.league.joinedAt - b.league.joinedAt || a.userId.localeCompare(b.userId));
    const index = everyone.findIndex(m => m.userId === userId);
    const cohort = everyone.slice(index - index % COHORT_SIZE, index - index % COHORT_SIZE + COHORT_SIZE)
        .map(m => ({ you: m.userId === userId, league: m.league, xp: m.userId === userId ? own : xpSummary(m.state, now) }));
    view.rows = cohort
        .filter(m => !m.xp.suspicious && (m.you || !m.league.hidden))
        .sort((a, b) => b.xp.week - a.xp.week || a.league.joinedAt - b.league.joinedAt)
        .map((m, i) => ({ rank: i + 1, displayName: m.league.displayName, weekXp: m.xp.week, you: m.you }));
    if (own.suspicious)
        view.rows.push({ rank: null, displayName: self.league.displayName, weekXp: own.week, you: true });
    view.rank = view.rows.find(row => row.you)?.rank ?? null;
    return view;
}

/** The home card's league line: null until the learner can join, then their invitation or their rank. */
export function leagueSummary(view: ReturnType<typeof leagueView>) {
    return view.joined || view.canJoin ? { joined: view.joined, rank: view.rank, weekXp: view.weekXp } : null;
}
