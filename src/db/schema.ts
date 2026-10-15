import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_GUIDES } from './exercise-guides';
import LIBRARY from './exercise-library.json';
import { EXERCISE_SEED } from './exercise-seed';

/** [name, muscle, equipment, gif, secondary muscles, instructions], built by scripts/build-exercise-library.mjs */
type LibraryExercise = [string, string, string, string, string[], string[]];

export const DATABASE_NAME = 'spotter.db';

/** Each entry upgrades the db by one version. Append only; never edit a shipped migration. */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        muscle TEXT NOT NULL,
        equipment TEXT NOT NULL,
        custom INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE routine_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        position INTEGER NOT NULL,
        target_sets INTEGER NOT NULL DEFAULT 3
      );
      CREATE TABLE workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        notes TEXT
      );
      CREATE TABLE workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        exercise_position INTEGER NOT NULL,
        set_index INTEGER NOT NULL,
        weight REAL,
        reps INTEGER,
        done INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX workout_sets_workout ON workout_sets(workout_id);
      CREATE INDEX workout_sets_exercise ON workout_sets(exercise_id);
    `);
    for (const [name, muscle, equipment] of EXERCISE_SEED) {
      await db.runAsync(
        'INSERT INTO exercises (name, muscle, equipment) VALUES (?, ?, ?)',
        name,
        muscle,
        equipment
      );
    }
  },
  async (db) => {
    await db.execAsync(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
  // Full exercise library with GIFs, saved workout plans with per-set targets, rest per exercise.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN gif TEXT;
      ALTER TABLE exercises ADD COLUMN secondary TEXT;
      ALTER TABLE exercises ADD COLUMN instructions TEXT;
      ALTER TABLE routine_exercises ADD COLUMN rest_seconds INTEGER NOT NULL DEFAULT 90;
      CREATE TABLE routine_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_exercise_id INTEGER NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
        set_index INTEGER NOT NULL,
        weight REAL,
        reps INTEGER
      );
      CREATE INDEX routine_exercises_routine ON routine_exercises(routine_id);
      CREATE INDEX routine_sets_exercise ON routine_sets(routine_exercise_id);
      ALTER TABLE workouts ADD COLUMN routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL;
      ALTER TABLE workout_sets ADD COLUMN rest_seconds INTEGER;
    `);
    for (const [name, guide] of Object.entries(EXERCISE_GUIDES)) {
      await db.runAsync('UPDATE exercises SET gif = ? WHERE name = ? AND custom = 0', guide.gif, name);
    }
    // Library entries whose GIF a starter exercise already uses are duplicates of it.
    const seeded = new Set(Object.values(EXERCISE_GUIDES).map((g) => g.gif));
    const insert = await db.prepareAsync(
      `INSERT OR IGNORE INTO exercises (name, muscle, equipment, gif, secondary, instructions)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const [name, muscle, equipment, gif, secondary, instructions] of LIBRARY as LibraryExercise[]) {
        if (seeded.has(gif)) continue;
        await insert.executeAsync(name, muscle, equipment, gif, JSON.stringify(secondary), JSON.stringify(instructions));
      }
    } finally {
      await insert.finalizeAsync();
    }
  },
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(() => MIGRATIONS[version](db));
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
