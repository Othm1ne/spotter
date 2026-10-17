/** Achievements are computed from history every time, so they can never get out of sync. */

export type AchievementInput = {
  workouts: number;
  sets: number;
  volume: number;
  longestDayStreak: number;
  longestWeekStreak: number;
  heaviestWeight: number;
  exercisesTried: number;
  earlyBird: boolean;
  nightOwl: boolean;
};

/** Title and description are translations: `achievements.<id>.title` / `.description`. */
export type Achievement = {
  id: string;
  emoji: string;
  value: number;
  target: number;
  unlocked: boolean;
};

type Definition = Omit<Achievement, 'value' | 'unlocked'> & { measure: (s: AchievementInput) => number };

function tiers(
  id: string,
  measure: (s: AchievementInput) => number,
  levels: [target: number, emoji: string][]
): Definition[] {
  return levels.map(([target, emoji]) => ({
    id: `${id}-${target}`,
    emoji,
    target,
    measure,
  }));
}

const DEFINITIONS: Definition[] = [
  ...tiers('workouts', (s) => s.workouts, [
    [1, '🏁'],
    [10, '💪'],
    [50, '🏋️'],
    [100, '💯'],
    [250, '👑'],
  ]),
  ...tiers('day-streak', (s) => s.longestDayStreak, [
    [3, '🔥'],
    [7, '☄️'],
  ]),
  ...tiers('week-streak', (s) => s.longestWeekStreak, [
    [4, '🎯'],
    [12, '📅'],
    [26, '🗓️'],
  ]),
  ...tiers('sets', (s) => s.sets, [
    [100, '✅'],
    [500, '📈'],
    [1000, '🚀'],
  ]),
  ...tiers('volume', (s) => s.volume, [
    [10_000, '🧱'],
    [100_000, '🏗️'],
    [1_000_000, '⛰️'],
  ]),
  ...tiers('heaviest', (s) => s.heaviestWeight, [
    [100, '🥇'],
    [150, '🦍'],
    [200, '🐘'],
  ]),
  ...tiers('variety', (s) => s.exercisesTried, [
    [10, '🧭'],
    [25, '🌈'],
  ]),
  ...tiers('early', (s) => (s.earlyBird ? 1 : 0), [[1, '🌅']]),
  ...tiers('night', (s) => (s.nightOwl ? 1 : 0), [[1, '🦉']]),
];

export function computeAchievements(input: AchievementInput): Achievement[] {
  return DEFINITIONS.map(({ measure, ...def }) => {
    const value = measure(input);
    return { ...def, value: Math.min(value, def.target), unlocked: value >= def.target };
  });
}
