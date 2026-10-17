/**
 * The Home coach tip: one short, timely piece of advice picked from the user's day. Rules run on
 * the phone (no AI, works offline). A tip is an id plus values; the screen translates
 * `tips.<id>.title`, `.body` and `.question` (the follow-up asked to the coach).
 */
export type TipInput = {
  hour: number;
  /** Day of the year, to rotate the general tips. */
  dayOfYear: number;
  hasProfile: boolean;
  kcalLeft: number | null;
  proteinLeft: number | null;
  waterMl: number;
  waterTarget: number | null;
  foodsToday: number;
  trainedToday: boolean;
  daysSinceWorkout: number | null;
  nextWorkout: string | null;
  weighedToday: boolean;
  streak: number;
};

export type Tip = { id: string; icon: string; params?: Record<string, string | number> };

const GENERAL: Tip[] = [
  { id: 'sleep', icon: 'moon' },
  { id: 'smallJumps', icon: 'trending-up' },
  { id: 'plants', icon: 'leaf' },
  { id: 'steps', icon: 'walk' },
  { id: 'reserve', icon: 'timer' },
  { id: 'spreadProtein', icon: 'restaurant' },
  { id: 'warmUp', icon: 'body' },
];

/** The most useful tip right now: specific situations first, then a general tip of the day. */
export function pickTip(t: TipInput): Tip {
  if (t.hasProfile && t.trainedToday && t.proteinLeft !== null && t.proteinLeft > 30 && t.hour >= 11) {
    return { id: 'refuel', icon: 'barbell', params: { protein: Math.round(t.proteinLeft) } };
  }
  if (t.hasProfile && t.proteinLeft !== null && t.proteinLeft > 40 && t.hour >= 19 && t.foodsToday > 0) {
    return { id: 'proteinCatchUp', icon: 'nutrition', params: { protein: Math.round(t.proteinLeft) } };
  }
  if (t.waterTarget && t.hour >= 15 && t.waterMl < t.waterTarget * 0.4) {
    return {
      id: 'water',
      icon: 'water',
      params: { liters: (t.waterMl / 1000).toFixed(1), target: (t.waterTarget / 1000).toFixed(1) },
    };
  }
  if (t.hasProfile && !t.weighedToday && t.hour < 11) {
    return { id: 'weighIn', icon: 'scale' };
  }
  if (t.daysSinceWorkout !== null && t.daysSinceWorkout >= 4 && !t.trainedToday) {
    return t.nextWorkout
      ? { id: 'lapsedNext', icon: 'flash', params: { days: t.daysSinceWorkout, workout: t.nextWorkout } }
      : { id: 'lapsed', icon: 'flash', params: { days: t.daysSinceWorkout } };
  }
  if (t.nextWorkout && !t.trainedToday && t.hour < 20) {
    return { id: 'today', icon: 'play-circle', params: { workout: t.nextWorkout } };
  }
  if (t.streak >= 3) {
    return { id: 'streak', icon: 'flame', params: { days: t.streak } };
  }
  return GENERAL[t.dayOfYear % GENERAL.length];
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}
