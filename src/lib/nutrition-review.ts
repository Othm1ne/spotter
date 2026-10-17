/**
 * Nutrition review: deterministic stats for a day or a week against the targets, the AI review
 * prompt built from them, and validation of the AI's answer. Pure: no db, no network.
 */
import type { Targets } from './nutrition';
import { goalTitle, type Profile } from './profile';

export type DayIntake = { day: string; kcal: number; protein: number; carbs: number; fat: number; entries: number };
export type TopFood = { name: string; kcal: number; protein: number; times: number };
export type MealItem = { name: string; meal: string; grams: number | null; kcal: number; protein: number };

export type WeekStats = {
  daysLogged: number;
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  /** Days within 10% of the calorie target. */
  onTargetDays: number;
  /** Days reaching at least 90% of the protein target. */
  proteinDays: number;
  avgWaterMl: number;
};

export type Review = { headline: string; wins: string[]; fixes: string[]; ideas: string[] };

/** Days with fewer entries than this look like partial logging and are left out of averages. */
const MIN_ENTRIES = 2;

export function weekStats(days: DayIntake[], targets: Targets, waterMl: number[]): WeekStats {
  const logged = days.filter((d) => d.entries >= MIN_ENTRIES);
  const n = logged.length || 1;
  const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => Math.round(logged.reduce((s, d) => s + d[k], 0) / n);
  const water = waterMl.filter((w) => w > 0);
  return {
    daysLogged: logged.length,
    avgKcal: avg('kcal'),
    avgProtein: avg('protein'),
    avgCarbs: avg('carbs'),
    avgFat: avg('fat'),
    onTargetDays: logged.filter((d) => Math.abs(d.kcal - targets.calories) <= targets.calories * 0.1).length,
    proteinDays: logged.filter((d) => d.protein >= targets.protein * 0.9).length,
    avgWaterMl: water.length ? Math.round(water.reduce((s, w) => s + w, 0) / water.length) : 0,
  };
}

/** One line for the Nutrition tab, no AI needed. */
export function quickInsight(stats: WeekStats, targets: Targets): string {
  if (stats.daysLogged < 2) return 'Log food on a few days to get your weekly review.';
  const kcalGap = stats.avgKcal - targets.calories;
  if (stats.proteinDays < Math.ceil(stats.daysLogged / 2)) {
    return `Protein hit on ${stats.proteinDays} of ${stats.daysLogged} days: averaging ${stats.avgProtein} g of ${targets.protein} g.`;
  }
  if (Math.abs(kcalGap) > targets.calories * 0.1) {
    return `Averaging ${stats.avgKcal.toLocaleString()} kcal, ${Math.abs(Math.round(kcalGap))} ${kcalGap > 0 ? 'over' : 'under'} your target.`;
  }
  return `On target ${stats.onTargetDays} of ${stats.daysLogged} days, protein ${stats.proteinDays} of ${stats.daysLogged}. Nice work.`;
}

/** Changes whenever the log changes, so a cached review is only reused for the same food. */
export function logSignature(items: { kcal: number; protein: number }[]): string {
  const kcal = Math.round(items.reduce((s, i) => s + i.kcal, 0));
  const protein = Math.round(items.reduce((s, i) => s + i.protein, 0));
  return `${items.length}:${kcal}:${protein}`;
}

const SHAPE = `JSON shape: {"headline":"one short sentence verdict","wins":["..."],"fixes":["..."],"ideas":["..."]}
- wins: 1-3 specific things done well, citing numbers.
- fixes: 1-3 specific, doable changes, citing numbers.
- ideas: 2-4 concrete foods or meals with rough amounts and their protein/kcal.
Each item is one sentence, under 25 words. Plain text, no markdown.`;

function profileLine(profile: Profile, targets: Targets) {
  return `Goal: ${goalTitle(profile.goal)}. ${profile.sex}, ${profile.weightKg} kg. Daily targets: ${targets.calories} kcal, protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g, water ${(targets.waterMl / 1000).toFixed(1)} L.`;
}

export function dayReviewPrompt(profile: Profile, targets: Targets, items: MealItem[], waterMl: number, hour: number): string {
  const t = items.reduce(
    (s, i) => ({ kcal: s.kcal + i.kcal, protein: s.protein + i.protein }),
    { kcal: 0, protein: 0 }
  );
  const list = items
    .map((i) => `- ${i.meal}: ${i.name}${i.grams ? ` ${Math.round(i.grams)} g` : ''} (${Math.round(i.kcal)} kcal, ${Math.round(i.protein)} g protein)`)
    .join('\n');
  return `Review what this person ate today. It is ${hour}:00, so the day may not be over: suggest what to eat for the rest of the day to reach the targets.
${profileLine(profile, targets)}
So far: ${Math.round(t.kcal)} kcal, ${Math.round(t.protein)} g protein, water ${(waterMl / 1000).toFixed(1)} L.
Left: ${Math.round(targets.calories - t.kcal)} kcal, ${Math.max(0, Math.round(targets.protein - t.protein))} g protein.
Foods:
${list || '- nothing logged yet'}

${SHAPE}
"ideas" must fit the calories and protein left.`;
}

export function weekReviewPrompt(
  profile: Profile,
  targets: Targets,
  stats: WeekStats,
  days: DayIntake[],
  top: TopFood[]
): string {
  const perDay = days
    .filter((d) => d.entries >= MIN_ENTRIES)
    .map((d) => `- ${d.day}: ${Math.round(d.kcal)} kcal, P ${Math.round(d.protein)} g, C ${Math.round(d.carbs)} g, F ${Math.round(d.fat)} g`)
    .join('\n');
  const foods = top.map((f) => `- ${f.name}: ${f.times}×, ${Math.round(f.kcal)} kcal total, ${Math.round(f.protein)} g protein total`).join('\n');
  return `Review this person's eating over the last 7 days.
${profileLine(profile, targets)}
Days logged: ${stats.daysLogged}. Averages: ${stats.avgKcal} kcal, P ${stats.avgProtein} g, C ${stats.avgCarbs} g, F ${stats.avgFat} g. Within 10% of calories on ${stats.onTargetDays} days; protein reached on ${stats.proteinDays} days. Average water ${(stats.avgWaterMl / 1000).toFixed(1)} L.
Per day:
${perDay}
Foods that gave the most calories:
${foods}

${SHAPE}
"ideas" should be easy swaps or additions based on the foods they already eat.`;
}

function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().replace(/\*\*/g, '').slice(0, 220))
    .slice(0, max);
}

export function parseReview(raw: string): Review | null {
  try {
    const data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>;
    const review = {
      headline: typeof data.headline === 'string' ? data.headline.trim().slice(0, 160) : '',
      wins: strings(data.wins, 3),
      fixes: strings(data.fixes, 3),
      ideas: strings(data.ideas, 4),
    };
    if (!review.headline && review.wins.length + review.fixes.length === 0) return null;
    return review;
  } catch {
    return null;
  }
}

export const REVIEW_SYSTEM =
  'You are Spotter Coach, a sports nutritionist. Be specific, encouraging and practical. Never suggest eating below the calorie target, crash diets or skipping meals to compensate. Reply with JSON only.';
