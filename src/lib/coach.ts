/** Builds the coach's system prompt from the user's data. Pure: no db, no network. */
import { calorieCheckIn, smoothedWeight, weeklyRate, type WeightEntry } from './body';
import { computeTargets } from './nutrition';
import { ACTIVITIES, EQUIPMENTS, EXPERIENCES, age, goalTitle, type Profile } from './profile';
import { formatWeight } from './workout-math';

type TopSet = { exercise: string; sets: number; weight: number | null; reps: number | null };
type Workout = { name: string; started_at: number; top: TopSet[] };
type Best = { name: string; best_weight: number; best_weight_reps: number; best_e1rm: number; times: number };

export type CoachInput = {
  profile: Profile | null;
  weights: WeightEntry[];
  weeklyGoal: number;
  recent: Workout[];
  bests: Best[];
};

const RULES = `You are Spotter Coach, a friendly, expert strength and nutrition coach inside the Spotter gym app.

How to answer:
- Be concise and practical: 2–4 short paragraphs or one bullet list, bold for key numbers. Under 150 words unless the user asks for more detail.
- Never use tables or code blocks: the app cannot display them. Write plans as bullets like "**Bench Press**: 3 × 8, rest 2 min".
- Only state numbers that appear in the data below or that you derive clearly from it. Don't invent dates.
- Use the user's data below to personalise every answer; mention their numbers when relevant. Weights are in kg.
- Reply in the language the user writes in.
- When the user asks for a workout plan or changes, give exercise names, sets × reps and rest times.

Safety rules (always follow):
- You are not a doctor. For pain, injury, illness, medication, pregnancy or eating disorders, give general guidance only and recommend a professional.
- Never recommend eating below the user's calorie target floor, crash diets, fasting for days, or losing more than 1% of body weight per week.
- Never give dosing or sourcing advice for steroids, SARMs, prohormones or other prescription/illegal drugs; explain the risks instead.
- Supplements: only evidence-based ones (creatine monohydrate, protein powder, caffeine, vitamin D, omega-3) at standard doses, and say food comes first.`;

function profileSection(input: CoachInput, now: Date): string {
  const p = input.profile;
  if (!p) return 'The user has not set up a profile yet. If useful, suggest they set their goal in Profile.';
  const latest = input.weights.at(-1)?.weight ?? p.weightKg;
  const avg = smoothedWeight(input.weights, now.getTime());
  const targets = computeTargets(p, avg ?? latest, now);
  const rate = weeklyRate(input.weights, now.getTime());
  const lines = [
    `Name: ${p.name || 'unknown'} · ${p.sex} · ${age(p, now)} years · ${p.heightCm} cm · ${formatWeight(latest)} kg`,
    `Goal: ${goalTitle(p.goal)} · experience: ${EXPERIENCES.find((e) => e.value === p.experience)?.title}`,
    `Trains ${p.daysPerWeek}×/week, ${p.sessionMinutes} min, at: ${EQUIPMENTS.find((e) => e.value === p.equipment)?.title}`,
    `Daily activity: ${ACTIVITIES.find((a) => a.value === p.activity)?.title}`,
    `Daily targets: ${targets.calories} kcal (maintenance ${targets.maintenance}), protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g, water ${(targets.waterMl / 1000).toFixed(1)} L`,
  ];
  if (p.limitations.length || p.notes) lines.push(`Be careful with: ${[...p.limitations, p.notes].filter(Boolean).join(', ')}`);
  if (rate) {
    lines.push(`Weight trend: ${rate.kgPerWeek.toFixed(2)} kg/week. ${calorieCheckIn(p.goal, rate).message}`);
  }
  return lines.join('\n');
}

function daysAgo(time: number, now: Date): string {
  const start = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((start(now.getTime()) - start(time)) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

function trainingSection(input: CoachInput, now: Date): string {
  if (input.recent.length === 0) return 'No workouts logged yet.';
  const recent = input.recent
    .map((w) => {
      const sets = w.top
        .map((t) => `${t.exercise} ${t.sets} sets, top ${t.weight ? `${formatWeight(t.weight)} kg` : 'bodyweight'} × ${t.reps ?? '?'}`)
        .join('; ');
      return `- ${daysAgo(w.started_at, now)} · ${w.name}: ${sets}`;
    })
    .join('\n');
  const bests = input.bests
    .map((b) => `- ${b.name}: best ${formatWeight(b.best_weight)} kg × ${b.best_weight_reps}, e1RM ${Math.round(b.best_e1rm)} kg (${b.times} sessions)`)
    .join('\n');
  return `Weekly workout goal: ${input.weeklyGoal}\nRecent workouts (newest first):\n${recent}\nBest lifts:\n${bests}`;
}

export function buildCoachPrompt(input: CoachInput, now: Date): string {
  return `${RULES}

Today: ${now.toDateString()}

USER PROFILE
${profileSection(input, now)}

TRAINING
${trainingSection(input, now)}`;
}

/** Starter questions, picked from what we know about the user. */
export function suggestedQuestions(input: CoachInput): string[] {
  const out: string[] = [];
  const p = input.profile;
  if (input.recent[0]) out.push(`Review my last workout (${input.recent[0].name})`);
  if (p?.goal === 'lose_fat') out.push('How do I keep my muscle while losing fat?');
  if (p?.goal === 'build_muscle') out.push('How fast should I add weight to my lifts?');
  if (input.bests[0]) out.push(`How can I improve my ${input.bests[0].name}?`);
  out.push('What should I eat before and after training?');
  out.push('Which supplements are actually worth it?');
  if (!p) out.push('Help me pick a goal');
  return out.slice(0, 4);
}
