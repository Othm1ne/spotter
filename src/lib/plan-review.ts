/**
 * AI review of a workout plan: the prompt (plan + recent performance + allowed exercises) and the
 * validation of the suggested changes. Suggestions only reference exercises the app knows, so each
 * one can be applied with a tap. Pure: no db, no network.
 */
import type { Candidate } from './program';
import type { Profile } from './profile';

export type PlanItem = {
  exerciseId: number;
  name: string;
  muscle: string;
  sets: number;
  /** Rep target of the plan, e.g. "8" or "6-10". */
  reps: string;
  restSeconds: number;
  /** Last sessions, newest first, e.g. "60 kg × 10, 10, 9". */
  history: string[];
};

export type PlanSuggestion =
  | { type: 'swap'; exerciseId: number; newExerciseId: number; reason: string }
  | { type: 'sets'; exerciseId: number; sets: number; reason: string }
  | { type: 'reps'; exerciseId: number; repMin: number; repMax: number; reason: string }
  | { type: 'rest'; exerciseId: number; restSeconds: number; reason: string }
  | { type: 'remove'; exerciseId: number; reason: string }
  | { type: 'add'; newExerciseId: number; sets: number; repMin: number; repMax: number; restSeconds: number; reason: string };

export type PlanReview = { summary: string; suggestions: PlanSuggestion[] };

const MAX_SUGGESTIONS = 5;

export function buildPlanReviewPrompt(
  planName: string,
  items: PlanItem[],
  profile: Profile | null,
  candidates: Candidate[],
  language = 'English'
): string {
  const person = profile
    ? `Goal: ${profile.goal}. Experience: ${profile.experience}. ${profile.daysPerWeek} workouts a week, ${profile.sessionMinutes} min each.${
        profile.limitations.length || profile.notes ? ` Be careful with: ${[...profile.limitations, profile.notes].filter(Boolean).join(', ')}.` : ''
      }`
    : 'No profile set.';
  const plan = items
    .map(
      (i) =>
        `- id ${i.exerciseId} | ${i.name} (${i.muscle}) | ${i.sets} sets × ${i.reps} reps | rest ${i.restSeconds}s | recent: ${
          i.history.length ? i.history.join(' / ') : 'not done yet'
        }`
    )
    .join('\n');
  const catalog = candidates.map((c) => `${c.id}|${c.name}|${c.muscle}`).join('\n');
  return `Review this workout plan "${planName}" and suggest at most ${MAX_SUGGESTIONS} concrete changes. Reply with JSON only.
${person}

Plan (in order):
${plan}

Exercises you may swap in or add (id|name|muscle):
${catalog}

Look at: balance between muscles, volume for the goal, rep ranges, rest times, and stalls in the recent results (same weight and reps for several sessions). Only suggest changes that clearly help; an empty list is fine if the plan is good.

JSON shape:
{"summary":"one or two sentences on the plan","suggestions":[
 {"type":"swap","exerciseId":12,"newExerciseId":34,"reason":"..."},
 {"type":"sets","exerciseId":12,"sets":4,"reason":"..."},
 {"type":"reps","exerciseId":12,"repMin":6,"repMax":10,"reason":"..."},
 {"type":"rest","exerciseId":12,"restSeconds":120,"reason":"..."},
 {"type":"remove","exerciseId":12,"reason":"..."},
 {"type":"add","newExerciseId":34,"sets":3,"repMin":10,"repMax":15,"restSeconds":75,"reason":"..."}
]}
"exerciseId" must be an id from the plan; "newExerciseId" an id from the list above. Each reason is one short sentence. Write "summary" and every "reason" in ${language}.`;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Keeps only suggestions that point at real exercises and sensible numbers. */
export function parsePlanReview(raw: string, planIds: Set<number>, candidateIds: Set<number>): PlanReview | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>;
  } catch {
    return null;
  }
  const out: PlanSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(data.suggestions) ? data.suggestions : []) {
    if (!s || typeof s !== 'object') continue;
    const x = s as Record<string, unknown>;
    const reason = typeof x.reason === 'string' ? x.reason.trim().slice(0, 200) : '';
    const id = num(x.exerciseId);
    const newId = num(x.newExerciseId);
    const onPlan = id !== null && planIds.has(id);
    let suggestion: PlanSuggestion | null = null;
    switch (x.type) {
      case 'swap':
        if (onPlan && newId !== null && candidateIds.has(newId) && !planIds.has(newId)) {
          suggestion = { type: 'swap', exerciseId: id, newExerciseId: newId, reason };
        }
        break;
      case 'sets': {
        const sets = num(x.sets);
        if (onPlan && sets !== null) suggestion = { type: 'sets', exerciseId: id, sets: clamp(sets, 1, 8), reason };
        break;
      }
      case 'reps': {
        const lo = num(x.repMin);
        const hi = num(x.repMax);
        if (onPlan && lo !== null && hi !== null) {
          const repMin = clamp(Math.min(lo, hi), 1, 30);
          suggestion = { type: 'reps', exerciseId: id, repMin, repMax: clamp(Math.max(lo, hi), repMin, 30), reason };
        }
        break;
      }
      case 'rest': {
        const rest = num(x.restSeconds);
        if (onPlan && rest !== null) suggestion = { type: 'rest', exerciseId: id, restSeconds: clamp(rest / 15, 2, 20) * 15, reason };
        break;
      }
      case 'remove':
        if (onPlan && planIds.size > 1) suggestion = { type: 'remove', exerciseId: id, reason };
        break;
      case 'add': {
        const sets = num(x.sets) ?? 3;
        const lo = num(x.repMin) ?? 8;
        const hi = num(x.repMax) ?? 12;
        const rest = num(x.restSeconds) ?? 90;
        if (newId !== null && candidateIds.has(newId) && !planIds.has(newId)) {
          const repMin = clamp(Math.min(lo, hi), 1, 30);
          suggestion = {
            type: 'add',
            newExerciseId: newId,
            sets: clamp(sets, 1, 8),
            repMin,
            repMax: clamp(Math.max(lo, hi), repMin, 30),
            restSeconds: clamp(rest / 15, 2, 20) * 15,
            reason,
          };
        }
        break;
      }
    }
    if (!suggestion) continue;
    // One suggestion per exercise and kind.
    const key = `${suggestion.type}-${'exerciseId' in suggestion ? suggestion.exerciseId : suggestion.newExerciseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  const summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 300) : '';
  if (!summary && out.length === 0) return null;
  return { summary, suggestions: out };
}
