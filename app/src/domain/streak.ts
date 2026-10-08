const DAY_MS = 86400000;

export function dailyStreak(answerTimes: readonly number[], timezone: string, now: number) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" });
  const dayOf = (at: number) => {
    const parts = formatter.formatToParts(at);
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value);
    return Date.UTC(number("year"), number("month") - 1, number("day")) / DAY_MS;
  };
  const today = dayOf(now);
  const days = new Set(answerTimes.filter(at => at <= now).map(dayOf));
  const activeToday = days.has(today);
  let count = 0;
  for (let day = activeToday ? today : today - 1; days.has(day); day--) count++;
  return {
    days: count,
    activeToday,
    week: Array.from({ length: 7 }, (_, index) => {
      const day = today - 6 + index;
      return { date: new Date(day * DAY_MS).toISOString().slice(0, 10), active: days.has(day), today: day === today };
    })
  };
}
