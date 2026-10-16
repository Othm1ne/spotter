/** Daily calorie, macro and water targets from a profile. Deterministic: no AI involved. */
import { ACTIVITIES, age, type Goal, type Profile } from './profile';

export type Targets = {
  bmr: number;
  maintenance: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
};

/** Calorie change from maintenance per goal. */
const GOAL_FACTOR: Record<Goal, number> = {
  lose_fat: -0.2,
  recomp: -0.1,
  maintain: 0,
  strength: 0.05,
  build_muscle: 0.1,
};

/** Protein in grams per kg of body weight per goal (higher in a deficit to keep muscle). */
const PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.2,
  recomp: 2.2,
  maintain: 1.6,
  strength: 1.8,
  build_muscle: 1.8,
};

/** Never recommend eating less than this, whatever the goal. */
export const CALORIE_FLOOR = { male: 1500, female: 1200 } as const;

const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Mifflin-St Jeor resting energy expenditure. */
export function bmr(p: Pick<Profile, 'sex' | 'birthYear' | 'heightCm'>, weightKg: number, now: Date): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * age(p, now) + (p.sex === 'male' ? 5 : -161);
}

export function computeTargets(profile: Profile, weightKg: number, now: Date): Targets {
  const rest = bmr(profile, weightKg, now);
  const factor = ACTIVITIES.find((a) => a.value === profile.activity)?.factor ?? 1.375;
  const maintenance = rest * factor;
  const calories = Math.max(
    CALORIE_FLOOR[profile.sex],
    maintenance * (1 + GOAL_FACTOR[profile.goal]) + profile.calorieAdjustment
  );

  // For high body fat, base protein on a leaner reference weight (BMI 27) instead of total weight.
  const heightM = profile.heightCm / 100;
  const proteinWeight = Math.min(weightKg, 27 * heightM * heightM);
  const protein = PROTEIN_PER_KG[profile.goal] * proteinWeight;
  const fat = Math.max(MIN_FAT_PER_KG * weightKg, (calories * FAT_SHARE) / 9);
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  return {
    bmr: round(rest, 10),
    maintenance: round(maintenance, 10),
    calories: round(calories, 10),
    protein: round(protein, 5),
    carbs: round(carbs, 5),
    fat: round(fat, 5),
    waterMl: round(weightKg * 35, 250),
  };
}
