/**
 * Hand-written supplement guide, based on position stands from the International Society of
 * Sports Nutrition and the IOC consensus on supplements (2018). Pure data and rules: no AI, so it
 * stays accurate and works offline. Doses are for healthy adults.
 *
 * The text lives in the translations under `supp.<id>`: name, summary, dose, timing, and
 * newline-separated benefits, safety notes and coach questions.
 */
import type { Profile } from './profile';

export type Tier = 'strong' | 'situational' | 'skip';

export type Supplement = { id: string; tier: Tier; icon: string };

export const TIERS: Tier[] = ['strong', 'situational', 'skip'];

export const SUPPLEMENTS: Supplement[] = [
  { id: 'creatine', tier: 'strong', icon: 'flash' },
  { id: 'protein', tier: 'strong', icon: 'nutrition' },
  { id: 'caffeine', tier: 'strong', icon: 'cafe' },
  { id: 'vitaminD', tier: 'situational', icon: 'sunny' },
  { id: 'omega3', tier: 'situational', icon: 'fish' },
  { id: 'betaAlanine', tier: 'situational', icon: 'timer' },
  { id: 'magnesium', tier: 'situational', icon: 'moon' },
  { id: 'bcaa', tier: 'skip', icon: 'close-circle' },
  { id: 'fatBurners', tier: 'skip', icon: 'warning' },
  { id: 'testBoosters', tier: 'skip', icon: 'close-circle' },
  { id: 'glutamine', tier: 'skip', icon: 'close-circle' },
];

/** Caffeine for this body weight: 2–3 mg per kg, never above 400 mg a day. */
export function caffeineDose(profile: Profile | null): { min: number; max: number } | null {
  if (!profile?.weightKg) return null;
  return { min: Math.round(profile.weightKg * 2), max: Math.min(400, Math.round(profile.weightKg * 3)) };
}

export type SupplementContext = {
  profile: Profile | null;
  /** Average daily protein over the last week, when enough days are logged. */
  avgProtein: number | null;
  proteinTarget: number | null;
  /** Whether oily fish shows up in the food log; null when there is too little logged. */
  eatsFish: boolean | null;
  month: number;
};

/** Why this supplement fits the user (a `supp.forYou.<key>` translation), or null. */
export function forYou(s: Supplement, ctx: SupplementContext): { key: string; params?: Record<string, number> } | null {
  const goal = ctx.profile?.goal;
  switch (s.id) {
    case 'creatine':
      return goal && goal !== 'maintain' ? { key: 'creatine' } : null;
    case 'protein':
      if (ctx.avgProtein !== null && ctx.proteinTarget && ctx.avgProtein < ctx.proteinTarget * 0.9) {
        return { key: 'protein', params: { avg: ctx.avgProtein, target: ctx.proteinTarget } };
      }
      return null;
    case 'vitaminD':
      // October to March: little sun in Europe and North America.
      return ctx.month >= 9 || ctx.month <= 2 ? { key: 'vitaminD' } : null;
    case 'omega3':
      return ctx.eatsFish === false ? { key: 'omega3' } : null;
    default:
      return null;
  }
}

/** Matches oily fish in food names (English, French, Spanish, German). */
export const FISH = /salmon|saumon|lachs|tuna|thon|atún|atun|thunfisch|sardin|mackerel|maquereau|caballa|makrele|herring|hareng|arenque|hering|trout|truite|trucha|forelle|anchov|anchois|anchoa|sardell/i;
