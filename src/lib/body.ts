/** Body weight trend and the calorie check-in it drives. Pure functions, no db. */
import type { Goal } from './profile';

export type WeightEntry = { id: number; measured_at: number; weight: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 21;
const MIN_TREND_DAYS = 14;
const MIN_ENTRIES = 5;
export const ADJUST_STEP = 150;

/** Average of the entries in the 7 days up to `at`: smooths out water and food swings. */
export function smoothedWeight(entries: WeightEntry[], at: number): number | null {
  const window = entries.filter((e) => e.measured_at <= at && e.measured_at > at - 7 * DAY_MS);
  if (window.length === 0) return null;
  return window.reduce((sum, e) => sum + e.weight, 0) / window.length;
}

/**
 * Weight change per week over the last 3 weeks (least-squares slope), as kg and % of body weight.
 * Null until there are at least 2 weeks and 5 weigh-ins of data.
 */
export function weeklyRate(entries: WeightEntry[], now: number) {
  const recent = entries.filter((e) => e.measured_at > now - TREND_DAYS * DAY_MS);
  if (recent.length < MIN_ENTRIES) return null;
  const span = (recent[recent.length - 1].measured_at - recent[0].measured_at) / DAY_MS;
  if (span < MIN_TREND_DAYS - 1) return null;
  const xs = recent.map((e) => e.measured_at / DAY_MS);
  const ys = recent.map((e) => e.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const kgPerWeek = den === 0 ? 0 : (num / den) * 7;
  return { kgPerWeek, percentPerWeek: (kgPerWeek / my) * 100 };
}

/** Healthy weekly change per goal, as % of body weight (min, max). */
const TARGET_RATE: Record<Goal, [number, number]> = {
  lose_fat: [-1, -0.4],
  recomp: [-0.5, 0.1],
  maintain: [-0.25, 0.25],
  strength: [-0.1, 0.4],
  build_muscle: [0.1, 0.5],
};

export type CheckIn = { kind: 'on_track' | 'increase' | 'decrease'; message: string; delta: number };

/** Compares the actual trend with the goal's healthy range and suggests a calorie change. */
export function calorieCheckIn(goal: Goal, rate: { percentPerWeek: number; kgPerWeek: number }): CheckIn {
  const [min, max] = TARGET_RATE[goal];
  const kg = Math.round(rate.kgPerWeek * 100) / 100 || 0; // `|| 0` turns -0 into 0
  const change = `${kg > 0 ? '+' : ''}${kg.toFixed(2)} kg/week`;
  if (rate.percentPerWeek < min) {
    return {
      kind: 'increase',
      delta: ADJUST_STEP,
      message:
        goal === 'build_muscle' || goal === 'strength'
          ? `Your weight isn't going up yet (${change}). Eating ${ADJUST_STEP} kcal more fuels muscle growth.`
          : `You're losing weight faster than planned (${change}). Eating ${ADJUST_STEP} kcal more protects your muscle and energy.`,
    };
  }
  if (rate.percentPerWeek > max) {
    return {
      kind: 'decrease',
      delta: -ADJUST_STEP,
      message:
        goal === 'lose_fat' || goal === 'recomp'
          ? `Your weight isn't dropping yet (${change}). Eating ${ADJUST_STEP} kcal less should get it moving.`
          : `You're gaining faster than planned (${change}). Eating ${ADJUST_STEP} kcal less keeps the gain lean.`,
    };
  }
  return { kind: 'on_track', delta: 0, message: `Right on track: ${change}. Keep doing what you're doing.` };
}
