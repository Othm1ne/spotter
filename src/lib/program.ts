/**
 * Training programs: which exercises suit the user's equipment and limits, the split for their
 * training days, sets/reps by goal, the AI prompt and its validation, an offline template, and
 * set-to-set progression. Pure: no db, no network.
 */
import { estimateOneRepMax } from './workout-math';
import type { Equipment, Experience, Goal, Profile } from './profile';

export type Candidate = { id: number; name: string; muscle: string; equipment: string };

export type ProgramExercise = { exerciseId: number; sets: number; repMin: number; repMax: number; restSeconds: number };
export type ProgramDay = { name: string; focus: string; exercises: ProgramExercise[] };
export type ProgramDraft = { name: string; summary: string; weeks: number; days: ProgramDay[]; source: 'ai' | 'template' };

// Well-known exercises the AI may pick from, per equipment. Short lists keep the prompt small
// (free plan: 8k tokens a minute) and every one has a GIF and a guide.
const GYM = [
  'Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Chest Fly', 'Cable Crossover',
  'Push-up', 'Dip', 'Deadlift', 'Barbell Row', 'Dumbbell Row', 'Pull-up', 'Chin-up', 'Lat Pulldown', 'Seated Cable Row',
  'T-Bar Row', 'Overhead Press', 'Dumbbell Shoulder Press', 'Lateral Raise', 'Cable Lateral Raise', 'Rear Delt Fly',
  'Face Pull', 'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Triceps Pushdown',
  'Overhead Triceps Extension', 'Skull Crusher', 'Close-Grip Bench Press', 'Back Squat', 'Front Squat', 'Leg Press',
  'Hack Squat', 'Leg Extension', 'Bulgarian Split Squat', 'Walking Lunge', 'Romanian Deadlift', 'Lying Leg Curl',
  'Seated Leg Curl', 'Hip Thrust', 'Glute Kickback', 'Hip Abduction', 'Standing Calf Raise', 'Seated Calf Raise',
  'Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout', 'Dumbbell Goblet Squat', 'Dumbbell Romanian Deadlift',
];

const HOME_DUMBBELLS = [
  'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Push-up', 'Dip', 'Dumbbell Row', 'Dumbbell Incline Row',
  'Pull-up', 'Chin-up', 'Dumbbell Pullover', 'Dumbbell Shoulder Press', 'Dumbbell Arnold Press', 'Lateral Raise',
  'Rear Delt Fly', 'Dumbbell Shrug', 'Dumbbell Curl', 'Hammer Curl', 'Dumbbell Incline Curl', 'Dumbbell Concentration Curl',
  'Dumbbell Lying Triceps Extension', 'Dumbbell Kickback', 'Dumbbell Goblet Squat', 'Bulgarian Split Squat', 'Walking Lunge',
  'Dumbbell Rear Lunge', 'Dumbbell Step Up', 'Dumbbell Romanian Deadlift', 'Low Glute Bridge On Floor',
  'Dumbbell Single Leg Calf Raise', 'Plank', 'Hanging Leg Raise', 'Reverse Crunch', 'Dead Bug', 'Wrist Curl', "Farmer's Carry",
];

const BODYWEIGHT = [
  'Push-up', 'Incline Push Up', 'Decline Push Up', 'Diamond Push Up', 'Dip', 'Bench Dip Knees Bent', 'Pull-up', 'Chin-up',
  'Inverted Row', 'Bodyweight Standing Row With Towel', 'Squat To Overhead Reach', 'Split Squats', 'Forward Lunge',
  'Curtsey Squat', 'Jump Squat', 'One Leg Squat', 'Low Glute Bridge On Floor', 'Glute Bridge March', 'Hyperextension',
  'Bodyweight Standing Calf Raise', 'One Leg Floor Calf Raise', 'Plank', 'Hanging Leg Raise', 'Reverse Crunch', 'Crunch Floor',
  'Dead Bug', 'Mountain Climber', 'Burpee',
];

export function candidateNames(equipment: Equipment): string[] {
  return equipment === 'full_gym' ? GYM : equipment === 'home_dumbbells' ? HOME_DUMBBELLS : BODYWEIGHT;
}

/** Exercises left out for each limitation the user ticked during onboarding. */
const AVOID: Record<string, string[]> = {
  Shoulders: ['Overhead Press', 'Dip', 'Skull Crusher', 'Dumbbell Arnold Press', 'Dumbbell Pullover', 'Decline Push Up'],
  'Lower back': ['Deadlift', 'Barbell Row', 'T-Bar Row', 'Back Squat', 'Romanian Deadlift', 'Hyperextension', 'Dumbbell Romanian Deadlift'],
  Knees: ['Bulgarian Split Squat', 'Walking Lunge', 'Front Squat', 'Hack Squat', 'Leg Extension', 'Jump Squat', 'One Leg Squat', 'Split Squats', 'Forward Lunge', 'Curtsey Squat'],
  Wrists: ['Front Squat', 'Skull Crusher', 'Barbell Curl', 'Ab Wheel Rollout', 'Wrist Curl'],
  Elbows: ['Skull Crusher', 'Close-Grip Bench Press', 'Overhead Triceps Extension', 'Dumbbell Lying Triceps Extension', 'Diamond Push Up'],
  Hips: ['Hip Abduction', 'Curtsey Squat'],
  Neck: ['Dumbbell Shrug'],
};

/** Candidates in list order, without the ones the user's limitations rule out. */
export function filterCandidates(all: Candidate[], profile: Pick<Profile, 'equipment' | 'limitations'>): Candidate[] {
  const avoid = new Set(profile.limitations.flatMap((l) => AVOID[l] ?? []));
  const order = candidateNames(profile.equipment);
  return all
    .filter((c) => order.includes(c.name) && !avoid.has(c.name))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

const COMPOUND = /bench press|squat|deadlift|row|pull-?up|chin-?up|\bdip\b|lunge|hip thrust|leg press|overhead press|shoulder press|arnold press|push-?up|push up|step up/i;

export function isCompound(name: string): boolean {
  return COMPOUND.test(name);
}

export type DayType = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

/** Muscle slots in order of priority; a day takes as many as fit in the session. */
const SLOTS: Record<DayType, string[]> = {
  full: ['Quads', 'Chest', 'Back', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps', 'Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Back', 'Chest', 'Biceps', 'Triceps', 'Shoulders'],
  lower: ['Quads', 'Hamstrings', 'Glutes', 'Quads', 'Calves', 'Core', 'Hamstrings'],
  push: ['Chest', 'Shoulders', 'Chest', 'Triceps', 'Shoulders', 'Triceps', 'Chest'],
  pull: ['Back', 'Back', 'Shoulders', 'Biceps', 'Back', 'Biceps', 'Forearms'],
  legs: ['Quads', 'Hamstrings', 'Quads', 'Glutes', 'Calves', 'Core', 'Hamstrings'],
};

const DAY_TITLES: Record<DayType, { name: string; focus: string }> = {
  full: { name: 'Full Body', focus: 'Whole body' },
  upper: { name: 'Upper', focus: 'Chest, back, shoulders, arms' },
  lower: { name: 'Lower', focus: 'Quads, hamstrings, glutes, calves' },
  push: { name: 'Push', focus: 'Chest, shoulders, triceps' },
  pull: { name: 'Pull', focus: 'Back, rear delts, biceps' },
  legs: { name: 'Legs', focus: 'Quads, hamstrings, glutes, calves' },
};

export type SplitDay = { type: DayType; name: string; focus: string; variant: number; letter: string };

/** The weekly split for a number of training days. */
export function splitFor(daysPerWeek: number, experience: Experience): SplitDay[] {
  const days = Math.min(6, Math.max(1, Math.round(daysPerWeek)));
  const types: DayType[] =
    days <= 2
      ? Array<DayType>(days).fill('full')
      : days === 3
        ? experience === 'beginner'
          ? ['full', 'full', 'full']
          : ['push', 'pull', 'legs']
        : days === 4
          ? ['upper', 'lower', 'upper', 'lower']
          : days === 5
            ? ['upper', 'lower', 'push', 'pull', 'legs']
            : ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
  const total = new Map<DayType, number>();
  for (const t of types) total.set(t, (total.get(t) ?? 0) + 1);
  const seen = new Map<DayType, number>();
  return types.map((type) => {
    const variant = seen.get(type) ?? 0;
    seen.set(type, variant + 1);
    const letter = (total.get(type) ?? 1) > 1 ? String.fromCharCode(65 + variant) : '';
    return { type, variant, letter, name: `${DAY_TITLES[type].name} ${letter}`.trim(), focus: DAY_TITLES[type].focus };
  });
}

/** How many exercises fit in a session, warm-up included. */
export function exercisesPerDay(sessionMinutes: number): number {
  if (sessionMinutes <= 30) return 3;
  if (sessionMinutes <= 45) return 4;
  if (sessionMinutes <= 60) return 5;
  if (sessionMinutes <= 75) return 6;
  return 7;
}

/** Sets, rep range and rest for an exercise, by goal and experience. */
export function repScheme(goal: Goal, experience: Experience, compound: boolean, first: boolean) {
  const sets = (base: number) => Math.max(2, Math.min(5, base + (experience === 'advanced' && first ? 1 : 0)));
  if (goal === 'strength') {
    return compound
      ? { sets: sets(experience === 'beginner' ? 3 : 4), repMin: 3, repMax: 6, restSeconds: 180 }
      : { sets: sets(3), repMin: 8, repMax: 12, restSeconds: 90 };
  }
  if (goal === 'build_muscle' || goal === 'recomp') {
    return compound
      ? { sets: sets(3), repMin: 6, repMax: 10, restSeconds: 120 }
      : { sets: sets(3), repMin: 10, repMax: 15, restSeconds: 75 };
  }
  return compound
    ? { sets: sets(3), repMin: 8, repMax: 12, restSeconds: 90 }
    : { sets: sets(experience === 'beginner' ? 2 : 3), repMin: 12, repMax: 15, restSeconds: 60 };
}

export function programName(goal: Goal, daysPerWeek: number): string {
  const what =
    goal === 'strength' ? 'Strength' : goal === 'build_muscle' ? 'Muscle' : goal === 'lose_fat' ? 'Lean' : goal === 'recomp' ? 'Recomp' : 'Fit';
  return `${what} ${daysPerWeek}-day`;
}

const movement = (name: string) => name.replace(/^Dumbbell /, '').toLowerCase();

/** A program built from the split and fixed rules: used when the AI is unavailable. */
/** Words for a template program, so the app can name it in the user's language. English by default. */
export type TemplateWords = {
  day: (type: DayType, letter: string) => string;
  focus: (type: DayType) => string;
  name: (goal: Goal, days: number) => string;
  summary: (days: number, perDay: number) => string;
};

const ENGLISH: TemplateWords = {
  day: (type, letter) => `${DAY_TITLES[type].name} ${letter}`.trim(),
  focus: (type) => DAY_TITLES[type].focus,
  name: programName,
  summary: (days, perDay) =>
    `${days} days a week, ${perDay} exercises per session. Add weight when you hit the top of the rep range on every set.`,
};

export function templateProgram(profile: Profile, candidates: Candidate[], words: TemplateWords = ENGLISH): ProgramDraft {
  const perDay = exercisesPerDay(profile.sessionMinutes);
  const byMuscle = new Map<string, Candidate[]>();
  for (const c of candidates) {
    // The library files deadlifts under back, but they belong on a lower-body day.
    const muscle = c.name === 'Deadlift' ? 'Hamstrings' : c.muscle;
    byMuscle.set(muscle, [...(byMuscle.get(muscle) ?? []), c]);
  }
  // Compounds first within each muscle so days start with the big lifts.
  for (const list of byMuscle.values()) list.sort((a, b) => Number(isCompound(b.name)) - Number(isCompound(a.name)));

  const days = splitFor(profile.daysPerWeek, profile.experience).map((day) => {
    const used = new Set<number>();
    const movements = new Set<string>();
    const exercises: ProgramExercise[] = [];
    for (const muscle of SLOTS[day.type]) {
      if (exercises.length >= perDay) break;
      // Skip the dumbbell twin of a lift already in the day (Romanian Deadlift, Dumbbell Romanian Deadlift).
      const options = (byMuscle.get(muscle) ?? []).filter((c) => !used.has(c.id) && !movements.has(movement(c.name)));
      if (options.length === 0) continue;
      // Variant B of a day picks different exercises for the same muscles.
      const pick = options[day.variant % options.length];
      used.add(pick.id);
      movements.add(movement(pick.name));
      exercises.push({
        exerciseId: pick.id,
        ...repScheme(profile.goal, profile.experience, isCompound(pick.name), exercises.length === 0),
      });
    }
    return { name: words.day(day.type, day.letter), focus: words.focus(day.type), exercises };
  });

  return {
    name: words.name(profile.goal, profile.daysPerWeek),
    summary: words.summary(days.length, perDay),
    weeks: 8,
    days: days.filter((d) => d.exercises.length > 0),
    source: 'template',
  };
}

export function buildProgramPrompt(profile: Profile, candidates: Candidate[], now: Date, language = 'English'): string {
  const split = splitFor(profile.daysPerWeek, profile.experience);
  const perDay = exercisesPerDay(profile.sessionMinutes);
  const catalog = candidates.map((c) => `${c.id}|${c.name}|${c.muscle}`).join('\n');
  return `Design a training program for this person. Reply with JSON only.

Person: ${profile.sex}, ${now.getFullYear() - profile.birthYear} years, ${profile.heightCm} cm, ${profile.weightKg} kg.
Goal: ${profile.goal}. Experience: ${profile.experience}. ${profile.daysPerWeek} days a week, ${profile.sessionMinutes} minutes per session.
${profile.limitations.length || profile.notes ? `Be careful with: ${[...profile.limitations, profile.notes].filter(Boolean).join(', ')}.` : ''}

Use exactly these ${split.length} days in this order: ${split.map((d) => `${d.name} (${d.focus})`).join('; ')}.
Each day has ${perDay} exercises (${perDay - 1} is fine if the session is tight). Start each day with a compound lift.
Days with the same type but a different letter use different exercises for the same muscles.
Only use exercises from this list (id|name|muscle):
${catalog}

Write "name", "summary" and each day's "name" and "focus" in ${language} (keep the A/B letters). Keep exercise ids as given.

Rules: sets 2-5; reps as "min-max" (strength: 3-6 for main lifts; muscle: 6-12; fat loss/fitness: 8-15); rest in seconds (60-180, longer for heavy compounds). Never repeat an exercise within a day.

JSON shape:
{"name":"short program name","summary":"one or two sentences explaining the plan","weeks":8,"days":[{"name":"Upper A","focus":"Chest, back, shoulders","exercises":[{"id":12,"sets":3,"reps":"6-10","rest":120}]}]}`;
}

function parseReps(value: unknown): [number, number] | null {
  if (typeof value === 'number' && Number.isFinite(value)) return [Math.round(value), Math.round(value)];
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = value.match(/\d+/);
  return single ? [Number(single[0]), Number(single[0])] : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Validates the AI's program against the candidate list; null when it isn't usable. */
export function parseProgram(raw: string, candidates: Candidate[], profile: Profile): ProgramDraft | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.days)) return null;
  const ids = new Set(candidates.map((c) => c.id));
  const split = splitFor(profile.daysPerWeek, profile.experience);
  const days: ProgramDay[] = [];
  for (const [i, d] of obj.days.entries()) {
    if (!d || typeof d !== 'object') continue;
    const day = d as Record<string, unknown>;
    const exercises: ProgramExercise[] = [];
    for (const e of Array.isArray(day.exercises) ? day.exercises : []) {
      if (!e || typeof e !== 'object') continue;
      const ex = e as Record<string, unknown>;
      const id = Number(ex.id);
      if (!ids.has(id) || exercises.some((x) => x.exerciseId === id)) continue;
      const reps = parseReps(ex.reps) ?? [8, 12];
      const repMin = clamp(Math.min(reps[0], reps[1]), 1, 30);
      const repMax = clamp(Math.max(reps[0], reps[1]), repMin, 30);
      exercises.push({
        exerciseId: id,
        sets: clamp(Math.round(Number(ex.sets) || 3), 1, 6),
        repMin,
        repMax,
        restSeconds: clamp(Math.round((Number(ex.rest) || 90) / 15) * 15, 30, 300),
      });
    }
    if (exercises.length < 2) continue;
    days.push({
      name: typeof day.name === 'string' && day.name.trim() ? day.name.trim().slice(0, 40) : (split[i]?.name ?? `Day ${i + 1}`),
      focus: typeof day.focus === 'string' ? day.focus.trim().slice(0, 80) : (split[i]?.focus ?? ''),
      exercises: exercises.slice(0, 8),
    });
  }
  if (days.length !== split.length) return null;
  return {
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 40) : programName(profile.goal, profile.daysPerWeek),
    summary: typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 300) : '',
    weeks: clamp(Math.round(Number(obj.weeks) || 8), 4, 12),
    days,
    source: 'ai',
  };
}

/** Which day of the rotation comes next, given the day index of the last program workout. */
export function nextDayIndex(dayCount: number, lastDayIndex: number | null): number {
  if (dayCount === 0) return 0;
  return lastDayIndex === null ? 0 : (lastDayIndex + 1) % dayCount;
}

/** Week of the program, starting at 1, capped at its length. */
export function programWeek(startedAt: number, weeks: number, now: number): number {
  return Math.min(weeks, Math.floor(Math.max(0, now - startedAt) / (7 * 86_400_000)) + 1);
}

/** Rough session length: sets × (about 40 s of work + rest), plus 5 minutes to warm up. */
export function estimateMinutes(exercises: { sets: number; restSeconds: number }[]): number {
  const seconds = exercises.reduce((s, e) => s + e.sets * (40 + e.restSeconds), 0);
  return Math.round(seconds / 60 + 5);
}

// --- Progression ---

export type SessionSets = { weight: number | null; reps: number | null }[];

export type Suggestion = {
  weight: number | null;
  reps: number;
  kind: 'start' | 'increase' | 'repeat' | 'deload';
  /** Why: a `progress.<key>` translation and its values. */
  hint: { key: string; params: Record<string, string | number> };
};

/** Smallest sensible jump: bigger for leg and hip lifts, smaller for dumbbells. */
export function weightIncrement(name: string, muscle: string, equipment: string): number {
  if (equipment === 'Dumbbell') return 2;
  if (['Quads', 'Hamstrings', 'Glutes'].includes(muscle) && isCompound(name)) return 5;
  return 2.5;
}

const round = (kg: number, step: number) => Math.max(0, Math.round(kg / step) * step);

function best(session: SessionSets): number {
  return Math.max(0, ...session.map((s) => estimateOneRepMax(s.weight, s.reps) ?? 0));
}

/**
 * Double progression: when every set reached the top of the range, add weight and go back to
 * the bottom; otherwise keep the weight and add a rep. Three sessions without a better e1RM is
 * a plateau: drop about 10% and build back up.
 *
 * `history` is the exercise's last sessions, newest first.
 */
export function suggestNext(
  history: SessionSets[],
  repMin: number,
  repMax: number,
  increment: number
): Suggestion {
  const last = history[0]?.filter((s) => s.reps !== null && s.reps > 0) ?? [];
  if (last.length === 0) {
    const range = repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`;
    return {
      weight: null,
      reps: repMin,
      kind: 'start',
      hint: { key: 'start', params: { range } },
    };
  }

  const weights = last.map((s) => s.weight ?? 0);
  const top = Math.max(...weights);
  const atTop = last.filter((s) => (s.weight ?? 0) === top);
  const minReps = Math.min(...atTop.map((s) => s.reps ?? 0));

  // Bodyweight: no load to add, so keep adding reps.
  if (top === 0) {
    const reps = minReps + 1;
    return { weight: null, reps, kind: 'repeat', hint: { key: 'bodyweight', params: { reps } } };
  }

  // Only a stall at the same weight counts, so a deload doesn't trigger another one.
  const topOf = (session: SessionSets) => Math.max(0, ...session.map((s) => s.weight ?? 0));
  if (history.length >= 4 && history.slice(0, 4).every((s) => topOf(s) === top)) {
    const recent = Math.max(...history.slice(0, 3).map(best));
    if (recent > 0 && recent <= best(history[3])) {
      const weight = round(top * 0.9, increment / 2);
      return {
        weight,
        reps: repMax,
        kind: 'deload',
        hint: { key: 'deload', params: { weight } },
      };
    }
  }

  if (minReps >= repMax) {
    const weight = top + increment;
    return { weight, reps: repMin, kind: 'increase', hint: { key: 'increase', params: { reps: repMax, increment } } };
  }
  const reps = Math.min(repMax, Math.max(repMin, minReps + 1));
  return { weight: top, reps, kind: 'repeat', hint: { key: 'repeat', params: { reps } } };
}
