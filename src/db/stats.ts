import type { SQLiteDatabase } from 'expo-sqlite';

import type { WorkoutStat } from '@/lib/stats';

/** Every finished workout with its completed-set count and volume, oldest first. */
export function listWorkoutStats(db: SQLiteDatabase) {
  return db.getAllAsync<WorkoutStat>(
    `SELECT w.id, w.name, w.started_at, w.finished_at,
       COUNT(ws.id) AS sets,
       COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) AS volume
     FROM workouts w LEFT JOIN workout_sets ws ON ws.workout_id = w.id AND ws.done = 1
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id
     ORDER BY w.started_at`
  );
}

export async function getLiftStats(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ heaviest: number | null; exercises: number }>(
    `SELECT MAX(ws.weight) AS heaviest, COUNT(DISTINCT ws.exercise_id) AS exercises
     FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.done = 1 AND w.finished_at IS NOT NULL`
  );
  return { heaviestWeight: row?.heaviest ?? 0, exercisesTried: row?.exercises ?? 0 };
}

/** Completed sets per muscle group since `since`, most trained first. */
export function getSetsPerMuscle(db: SQLiteDatabase, since: number) {
  return db.getAllAsync<{ muscle: string; sets: number }>(
    `SELECT e.muscle, COUNT(*) AS sets
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.done = 1 AND w.finished_at IS NOT NULL AND w.started_at >= ?
     GROUP BY e.muscle
     ORDER BY sets DESC`,
    since
  );
}
