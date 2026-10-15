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

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  value: number;
  target: number;
  unlocked: boolean;
};

type Definition = Omit<Achievement, 'value' | 'unlocked'> & { measure: (s: AchievementInput) => number };

function tiers(
  id: string,
  measure: (s: AchievementInput) => number,
  levels: [target: number, emoji: string, title: string, description: string][]
): Definition[] {
  return levels.map(([target, emoji, title, description]) => ({
    id: `${id}-${target}`,
    emoji,
    title,
    description,
    target,
    measure,
  }));
}

const DEFINITIONS: Definition[] = [
  ...tiers('workouts', (s) => s.workouts, [
    [1, '🏁', 'First rep', 'Finish your first workout'],
    [10, '💪', 'Regular', 'Finish 10 workouts'],
    [50, '🏋️', 'Committed', 'Finish 50 workouts'],
    [100, '💯', 'Centurion', 'Finish 100 workouts'],
    [250, '👑', 'Gym legend', 'Finish 250 workouts'],
  ]),
  ...tiers('day-streak', (s) => s.longestDayStreak, [
    [3, '🔥', 'On fire', 'Train 3 days in a row'],
    [7, '☄️', 'Unstoppable', 'Train 7 days in a row'],
  ]),
  ...tiers('week-streak', (s) => s.longestWeekStreak, [
    [4, '🎯', 'Goal getter', 'Hit your weekly goal 4 weeks in a row'],
    [12, '📅', 'Habit built', 'Hit your weekly goal 12 weeks in a row'],
    [26, '🗓️', 'Half a year strong', 'Hit your weekly goal 26 weeks in a row'],
  ]),
  ...tiers('sets', (s) => s.sets, [
    [100, '✅', 'Hundred sets', 'Complete 100 sets'],
    [500, '📈', 'Set machine', 'Complete 500 sets'],
    [1000, '🚀', 'Thousand club', 'Complete 1,000 sets'],
  ]),
  ...tiers('volume', (s) => s.volume, [
    [10_000, '🧱', 'Ten tonner', 'Lift 10 tonnes in total'],
    [100_000, '🏗️', 'Heavy hauler', 'Lift 100 tonnes in total'],
    [1_000_000, '⛰️', 'Mountain mover', 'Lift 1,000 tonnes in total'],
  ]),
  ...tiers('heaviest', (s) => s.heaviestWeight, [
    [100, '🥇', 'Triple digits', 'Lift 100 kg in any exercise'],
    [150, '🦍', 'Heavyweight', 'Lift 150 kg in any exercise'],
    [200, '🐘', 'Two hundred', 'Lift 200 kg in any exercise'],
  ]),
  ...tiers('variety', (s) => s.exercisesTried, [
    [10, '🧭', 'Explorer', 'Try 10 different exercises'],
    [25, '🌈', 'Well rounded', 'Try 25 different exercises'],
  ]),
  ...tiers('early', (s) => (s.earlyBird ? 1 : 0), [[1, '🌅', 'Early bird', 'Start a workout before 7 am']]),
  ...tiers('night', (s) => (s.nightOwl ? 1 : 0), [[1, '🦉', 'Night owl', 'Start a workout after 9 pm']]),
];

export function computeAchievements(input: AchievementInput): Achievement[] {
  return DEFINITIONS.map(({ measure, ...def }) => {
    const value = measure(input);
    return { ...def, value: Math.min(value, def.target), unlocked: value >= def.target };
  });
}
