/** The user's body, goal and training setup, entered during onboarding. Pure types and math, no db. */

export type Sex = 'male' | 'female';
export type Goal = 'lose_fat' | 'build_muscle' | 'strength' | 'recomp' | 'maintain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'full_gym' | 'home_dumbbells' | 'bodyweight';

export type Profile = {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Weight at onboarding; the body weight log takes over once it has entries. */
  weightKg: number;
  goal: Goal;
  activity: Activity;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: Equipment;
  limitations: string[];
  notes: string;
  /** kcal added to (or removed from) the computed target after a weight-trend check-in. */
  calorieAdjustment: number;
};

export const GOALS: { value: Goal; title: string; subtitle: string; icon: string }[] = [
  { value: 'lose_fat', title: 'Lose fat', subtitle: 'Get leaner while keeping your muscle', icon: 'flame' },
  { value: 'build_muscle', title: 'Build muscle', subtitle: 'Add size with a small calorie surplus', icon: 'barbell' },
  { value: 'strength', title: 'Get stronger', subtitle: 'Lift heavier on the big lifts', icon: 'trophy' },
  { value: 'recomp', title: 'Recomposition', subtitle: 'Lose fat and build muscle slowly', icon: 'swap-vertical' },
  { value: 'maintain', title: 'Stay fit', subtitle: 'Keep your weight and stay healthy', icon: 'heart' },
];

export const ACTIVITIES: { value: Activity; title: string; subtitle: string; factor: number }[] = [
  { value: 'sedentary', title: 'Mostly sitting', subtitle: 'Desk job, little walking', factor: 1.2 },
  { value: 'light', title: 'Lightly active', subtitle: 'Some walking, 1–3 workouts a week', factor: 1.375 },
  { value: 'moderate', title: 'Active', subtitle: 'On your feet often, 3–5 workouts a week', factor: 1.55 },
  { value: 'active', title: 'Very active', subtitle: 'Physical job or 6–7 workouts a week', factor: 1.725 },
  { value: 'very_active', title: 'Athlete', subtitle: 'Hard training twice a day', factor: 1.9 },
];

export const EXPERIENCES: { value: Experience; title: string; subtitle: string }[] = [
  { value: 'beginner', title: 'Beginner', subtitle: 'Less than a year of regular training' },
  { value: 'intermediate', title: 'Intermediate', subtitle: '1–3 years, comfortable with the main lifts' },
  { value: 'advanced', title: 'Advanced', subtitle: '3+ years, progress comes slowly' },
];

export const EQUIPMENTS: { value: Equipment; title: string; subtitle: string; icon: string }[] = [
  { value: 'full_gym', title: 'Full gym', subtitle: 'Barbells, machines, cables', icon: 'business' },
  { value: 'home_dumbbells', title: 'Home with dumbbells', subtitle: 'Dumbbells, bench, maybe a bar', icon: 'home' },
  { value: 'bodyweight', title: 'Bodyweight only', subtitle: 'No equipment', icon: 'body' },
];

export const LIMITATIONS = ['Shoulders', 'Lower back', 'Knees', 'Wrists', 'Elbows', 'Hips', 'Neck'] as const;

export function age(profile: Pick<Profile, 'birthYear'>, now: Date): number {
  return now.getFullYear() - profile.birthYear;
}

export function goalTitle(goal: Goal): string {
  return GOALS.find((g) => g.value === goal)?.title ?? goal;
}
