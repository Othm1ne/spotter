export type Muscle =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Core'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Adductors'
  | 'Calves'
  | 'Traps'
  | 'Lower Back'
  | 'Cardio'
  | 'Mobility';

/** Order of the muscle filter chips. */
export const MUSCLES: Muscle[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Adductors',
  'Calves',
  'Traps',
  'Lower Back',
  'Cardio',
  'Mobility',
];

type SeedExercise = [name: string, muscle: Muscle, equipment: string];

export const EXERCISE_SEED: SeedExercise[] = [
  ['Bench Press', 'Chest', 'Barbell'],
  ['Incline Bench Press', 'Chest', 'Barbell'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell'],
  ['Chest Fly', 'Chest', 'Machine'],
  ['Cable Crossover', 'Chest', 'Cable'],
  ['Push-up', 'Chest', 'Bodyweight'],
  ['Dip', 'Chest', 'Bodyweight'],
  ['Deadlift', 'Back', 'Barbell'],
  ['Barbell Row', 'Back', 'Barbell'],
  ['Dumbbell Row', 'Back', 'Dumbbell'],
  ['Pull-up', 'Back', 'Bodyweight'],
  ['Chin-up', 'Back', 'Bodyweight'],
  ['Lat Pulldown', 'Back', 'Cable'],
  ['Seated Cable Row', 'Back', 'Cable'],
  ['T-Bar Row', 'Back', 'Machine'],
  ['Overhead Press', 'Shoulders', 'Barbell'],
  ['Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell'],
  ['Lateral Raise', 'Shoulders', 'Dumbbell'],
  ['Cable Lateral Raise', 'Shoulders', 'Cable'],
  ['Rear Delt Fly', 'Shoulders', 'Dumbbell'],
  ['Face Pull', 'Shoulders', 'Cable'],
  ['Barbell Curl', 'Biceps', 'Barbell'],
  ['Dumbbell Curl', 'Biceps', 'Dumbbell'],
  ['Hammer Curl', 'Biceps', 'Dumbbell'],
  ['Preacher Curl', 'Biceps', 'Machine'],
  ['Cable Curl', 'Biceps', 'Cable'],
  ['Triceps Pushdown', 'Triceps', 'Cable'],
  ['Overhead Triceps Extension', 'Triceps', 'Cable'],
  ['Skull Crusher', 'Triceps', 'Barbell'],
  ['Close-Grip Bench Press', 'Triceps', 'Barbell'],
  ['Back Squat', 'Quads', 'Barbell'],
  ['Front Squat', 'Quads', 'Barbell'],
  ['Leg Press', 'Quads', 'Machine'],
  ['Hack Squat', 'Quads', 'Machine'],
  ['Leg Extension', 'Quads', 'Machine'],
  ['Bulgarian Split Squat', 'Quads', 'Dumbbell'],
  ['Walking Lunge', 'Quads', 'Dumbbell'],
  ['Romanian Deadlift', 'Hamstrings', 'Barbell'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine'],
  ['Seated Leg Curl', 'Hamstrings', 'Machine'],
  ['Hip Thrust', 'Glutes', 'Barbell'],
  ['Glute Kickback', 'Glutes', 'Cable'],
  ['Hip Abduction', 'Glutes', 'Machine'],
  ['Standing Calf Raise', 'Calves', 'Machine'],
  ['Seated Calf Raise', 'Calves', 'Machine'],
  ['Plank', 'Core', 'Bodyweight'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight'],
  ['Cable Crunch', 'Core', 'Cable'],
  ['Ab Wheel Rollout', 'Core', 'Other'],
  ['Wrist Curl', 'Forearms', 'Dumbbell'],
  ["Farmer's Carry", 'Forearms', 'Dumbbell'],
];
