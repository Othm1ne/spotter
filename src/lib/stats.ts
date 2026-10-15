/** Calendar, streak and weekly stats over finished workouts. Dates use the phone's local time. */

export type WorkoutStat = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  sets: number;
  volume: number;
};

export type DayStat = { workouts: WorkoutStat[]; sets: number; volume: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-14" in local time. */
export function dayKey(date: Date | number): string {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday 00:00 of the week containing `date`. */
export function startOfWeek(date: Date | number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function groupByDay(workouts: WorkoutStat[]): Map<string, DayStat> {
  const days = new Map<string, DayStat>();
  for (const w of workouts) {
    const key = dayKey(w.started_at);
    const day = days.get(key) ?? { workouts: [], sets: 0, volume: 0 };
    day.workouts.push(w);
    day.sets += w.sets;
    day.volume += w.volume;
    days.set(key, day);
  }
  return days;
}

/**
 * Consecutive days with a workout. The current streak stays alive through today even if
 * today's workout hasn't happened yet, so it only breaks once a full day is missed.
 */
export function dayStreaks(days: Map<string, DayStat>, now: Date) {
  let day = startOfDay(now);
  if (!days.has(dayKey(day))) day = addDays(day, -1);
  let current = 0;
  while (days.has(dayKey(day))) {
    current += 1;
    day = addDays(day, -1);
  }

  const sorted = [...days.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const d = parseDayKey(key);
    run = prev && Math.round((d.getTime() - prev.getTime()) / DAY_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

/** Workouts per week for the last `weeks` weeks, oldest first, ending with the current week. */
export function weeklyCounts(workouts: WorkoutStat[], weeks: number, now: Date) {
  const thisWeek = startOfWeek(now);
  const result = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)),
    count: 0,
  }));
  const first = result[0].weekStart.getTime();
  for (const w of workouts) {
    if (w.started_at < first) continue;
    const index = Math.round((startOfWeek(w.started_at).getTime() - first) / (7 * DAY_MS));
    if (index >= 0 && index < weeks) result[index].count += 1;
  }
  return result;
}

/**
 * Consecutive weeks that reached the goal. The current week counts once reached,
 * and doesn't break the streak while it's still in progress.
 */
export function weekStreaks(workouts: WorkoutStat[], goal: number, now: Date) {
  if (workouts.length === 0) return { current: 0, longest: 0 };
  const oldest = Math.min(...workouts.map((w) => w.started_at));
  const weeks = Math.round((startOfWeek(now).getTime() - startOfWeek(oldest).getTime()) / (7 * DAY_MS)) + 1;
  const counts = weeklyCounts(workouts, weeks, now).map((w) => w.count >= goal);

  let longest = 0;
  let run = 0;
  for (const met of counts) {
    run = met ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const done = counts[counts.length - 1] ? counts : counts.slice(0, -1);
  let current = 0;
  for (let i = done.length - 1; i >= 0 && done[i]; i--) current += 1;
  return { current, longest };
}

/** Sets per day for the current week, Monday first. */
export function setsThisWeek(days: Map<string, DayStat>, now: Date) {
  const monday = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, sets: days.get(dayKey(date))?.sets ?? 0 };
  });
}

/** 0 (rest) to 4 (big session), by completed sets that day. */
export function activityLevel(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0;
  if (sets < 10) return 1;
  if (sets < 18) return 2;
  if (sets < 26) return 3;
  return 4;
}
