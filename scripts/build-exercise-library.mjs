/**
 * Builds src/db/exercise-library.json, the full exercise library bundled with the app.
 *
 * Inputs (download them first):
 * 1. ExerciseGymGifsDB exercise list (GIFs, muscle, equipment):
 *    https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/en/exercises.json
 * 2. All exercises from the free ExerciseDB API (better step-by-step instructions), paged with
 *    https://oss.exercisedb.dev/api/v1/exercises?limit=50&after=<nextCursor>, saved as one JSON array.
 *
 * Usage: node scripts/build-exercise-library.mjs <gymgifs.json> <exercisedb.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [gymgifsPath, exercisedbPath] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(gymgifsPath, 'utf8'));
const gymgifs = Array.isArray(raw) ? raw : Object.values(raw).find(Array.isArray);
const exercisedb = JSON.parse(readFileSync(exercisedbPath, 'utf8'));

// Dataset muscle -> app muscle group (see MUSCLES in exercise-seed.ts).
const MUSCLE = {
  pectorals: 'Chest',
  'serratus-anterior': 'Chest',
  lats: 'Back',
  'upper-back': 'Back',
  spine: 'Lower Back',
  traps: 'Traps',
  'levator-scapulae': 'Traps',
  delts: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  abductors: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
  cardio: 'Cardio',
};

const EQUIPMENT = {
  bodyweight: 'Bodyweight',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  barbell: 'Barbell',
  lever: 'Machine',
  machine: 'Machine',
  sled: 'Machine',
  band: 'Band',
  smith: 'Smith Machine',
  kettlebell: 'Kettlebell',
  'ez-bar': 'EZ Bar',
  other: 'Other',
};

const SECONDARY = {
  pectorals: 'Chest',
  delts: 'Shoulders',
  'upper-back': 'Upper back',
  spine: 'Lower back',
  abs: 'Abs',
  quads: 'Quads',
  'serratus-anterior': 'Serratus',
  'levator-scapulae': 'Neck',
};

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(male|female|v\d)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanName = (s) =>
  s
    .replace(/\s+(Male|Female)\b/g, '')
    .replace(/\s+v\d+$/, '')
    .replace(/\s+\d{3,}$/, '')
    .replace(/\bEz\b/g, 'EZ')
    .replace(/\s+/g, ' ')
    .trim();

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

const steps = new Map(exercisedb.map((e) => [norm(e.name), e.instructions.map((i) => i.replace(/^Step:\d+\s*/, ''))]));

const seen = new Set();
const library = [];
for (const e of gymgifs) {
  const name = cleanName(e.name);
  if (seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  const muscle = e.category === 'stretching' ? 'Mobility' : MUSCLE[e.muscle];
  if (!muscle) throw new Error(`Unmapped muscle ${e.muscle} (${e.name})`);
  const equipment = EQUIPMENT[e.equipment] ?? 'Other';
  const secondary = e.secondaryMuscles.map((m) => SECONDARY[m] ?? title(m));
  const instructions = steps.get(norm(e.name)) ?? e.instructions;
  library.push([name, muscle, equipment, e.file.replace(/\.gif$/, ''), secondary, instructions]);
}
library.sort((a, b) => a[0].localeCompare(b[0]));

const out = fileURLToPath(new URL('../src/db/exercise-library.json', import.meta.url));
writeFileSync(out, JSON.stringify(library));
console.log(`${library.length} exercises -> ${out}`);
