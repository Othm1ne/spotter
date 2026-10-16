import type { SQLiteDatabase } from 'expo-sqlite';

import { defaultWorkoutName, estimateOneRepMax } from '@/lib/workout-math';

export type Exercise = { id: number; name: string; muscle: string; equipment: string; gif: string | null };

/** Library exercises store secondary muscles and steps as JSON arrays. */
export type ExerciseDetail = Exercise & { secondary: string | null; instructions: string | null };

export type Workout = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number | null;
  notes: string | null;
};

export type WorkoutSet = {
  id: number;
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  muscle: string;
  gif: string | null;
  exercise_position: number;
  set_index: number;
  weight: number | null;
  reps: number | null;
  done: number;
  rest_seconds: number | null;
  /** Progression advice for the exercise, on its first set. */
  hint: string | null;
};

export type PreviousSet = { weight: number | null; reps: number | null };

export type WorkoutSummary = Workout & {
  set_count: number;
  volume: number;
  exercises: string | null;
};

export type ExerciseBest = {
  exercise_id: number;
  name: string;
  muscle: string;
  gif: string | null;
  times: number;
  last_done: number;
  best_weight: number;
  best_weight_reps: number;
  best_e1rm: number;
};

const DEFAULT_SET_COUNT = 3;

export function listExercises(db: SQLiteDatabase) {
  return db.getAllAsync<Exercise>('SELECT id, name, muscle, equipment, gif FROM exercises ORDER BY name');
}

export function getExercise(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ExerciseDetail>(
    'SELECT id, name, muscle, equipment, gif, secondary, instructions FROM exercises WHERE id = ?',
    id
  );
}

export function getActiveWorkout(db: SQLiteDatabase) {
  return db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1'
  );
}

/** Returns the workout in progress, or starts a new empty one. */
export async function startWorkout(db: SQLiteDatabase): Promise<number> {
  const active = await getActiveWorkout(db);
  if (active) return active.id;
  const now = new Date();
  const result = await db.runAsync(
    'INSERT INTO workouts (name, started_at) VALUES (?, ?)',
    defaultWorkoutName(now),
    now.getTime()
  );
  return result.lastInsertRowId;
}

export function getWorkout(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
}

export function getWorkoutSets(db: SQLiteDatabase, workoutId: number) {
  return db.getAllAsync<WorkoutSet>(
    `SELECT ws.*, e.name AS exercise_name, e.muscle, e.gif
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = ?
     ORDER BY ws.exercise_position, ws.set_index`,
    workoutId
  );
}

export async function renameWorkout(db: SQLiteDatabase, id: number, name: string) {
  await db.runAsync('UPDATE workouts SET name = ? WHERE id = ?', name, id);
}

/**
 * Completed sets from the most recent finished workout that included each exercise,
 * keyed by exercise id, in set order.
 */
export async function getPreviousSets(
  db: SQLiteDatabase,
  exerciseIds: number[]
): Promise<Map<number, PreviousSet[]>> {
  const result = new Map<number, PreviousSet[]>();
  if (exerciseIds.length === 0) return result;
  const placeholders = exerciseIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<PreviousSet & { exercise_id: number }>(
    `SELECT ws.exercise_id, ws.weight, ws.reps
     FROM workout_sets ws
     WHERE ws.exercise_id IN (${placeholders}) AND ws.done = 1
       AND ws.workout_id = (
         SELECT w.id FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
         WHERE s.exercise_id = ws.exercise_id AND s.done = 1 AND w.finished_at IS NOT NULL
         ORDER BY w.started_at DESC LIMIT 1
       )
     ORDER BY ws.exercise_id, ws.exercise_position, ws.set_index`,
    ...exerciseIds
  );
  for (const { exercise_id, weight, reps } of rows) {
    const list = result.get(exercise_id) ?? [];
    list.push({ weight, reps });
    result.set(exercise_id, list);
  }
  return result;
}

/**
 * Each exercise's completed sets from its last `sessions` finished workouts, newest first:
 * the history that progression suggestions are based on.
 */
export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseIds: number[],
  sessions = 4
): Promise<Map<number, PreviousSet[][]>> {
  const result = new Map<number, PreviousSet[][]>();
  if (exerciseIds.length === 0) return result;
  const placeholders = exerciseIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<PreviousSet & { exercise_id: number; workout_id: number }>(
    `SELECT ws.exercise_id, ws.workout_id, ws.weight, ws.reps
     FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.exercise_id IN (${placeholders}) AND ws.done = 1 AND w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC, ws.exercise_position, ws.set_index`,
    ...exerciseIds
  );
  const lastWorkout = new Map<number, number>();
  for (const { exercise_id, workout_id, weight, reps } of rows) {
    const list = result.get(exercise_id) ?? [];
    if (lastWorkout.get(exercise_id) !== workout_id) {
      if (list.length >= sessions) continue;
      list.push([]);
      lastWorkout.set(exercise_id, workout_id);
    }
    list[list.length - 1].push({ weight, reps });
    result.set(exercise_id, list);
  }
  return result;
}

/** Appends an exercise with as many empty sets as last time (or 3). */
export async function addExerciseToWorkout(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number
) {
  const pos = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(exercise_position), -1) + 1 AS next FROM workout_sets WHERE workout_id = ?',
    workoutId
  );
  const previous = (await getPreviousSets(db, [exerciseId])).get(exerciseId);
  const count = previous?.length || DEFAULT_SET_COUNT;
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < count; i++) {
      await db.runAsync(
        `INSERT INTO workout_sets (workout_id, exercise_id, exercise_position, set_index)
         VALUES (?, ?, ?, ?)`,
        workoutId,
        exerciseId,
        pos?.next ?? 0,
        i
      );
    }
  });
}

/** Adds a set to an exercise block, copying the values of the block's last set. */
export async function addSet(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
  exercisePosition: number
) {
  const last = await db.getFirstAsync<{
    set_index: number;
    weight: number | null;
    reps: number | null;
    rest_seconds: number | null;
  }>(
    `SELECT set_index, weight, reps, rest_seconds FROM workout_sets
     WHERE workout_id = ? AND exercise_position = ? ORDER BY set_index DESC LIMIT 1`,
    workoutId,
    exercisePosition
  );
  await db.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, exercise_position, set_index, weight, reps, rest_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    workoutId,
    exerciseId,
    exercisePosition,
    (last?.set_index ?? -1) + 1,
    last?.weight ?? null,
    last?.reps ?? null,
    last?.rest_seconds ?? null
  );
}

export async function updateSet(
  db: SQLiteDatabase,
  setId: number,
  values: { weight: number | null; reps: number | null; done: boolean }
) {
  await db.runAsync(
    `UPDATE workout_sets
     SET weight = ?, reps = ?, done = ?,
       completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE NULL END
     WHERE id = ?`,
    values.weight,
    values.reps,
    values.done ? 1 : 0,
    values.done ? 1 : 0,
    Date.now(),
    setId
  );
}

export async function deleteSet(db: SQLiteDatabase, setId: number) {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
}

export async function removeExercise(db: SQLiteDatabase, workoutId: number, exercisePosition: number) {
  await db.runAsync(
    'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_position = ?',
    workoutId,
    exercisePosition
  );
}

/**
 * Drops sets that weren't ticked and marks the workout finished.
 * Returns false (and deletes the workout) if nothing was completed.
 */
/** When the last set of a workout was ticked, or null if none was (or it predates tracking). */
export async function getLastSetTime(db: SQLiteDatabase, workoutId: number) {
  const row = await db.getFirstAsync<{ last: number | null }>(
    'SELECT MAX(completed_at) AS last FROM workout_sets WHERE workout_id = ? AND done = 1',
    workoutId
  );
  return row?.last ?? null;
}

export async function setWorkoutDuration(db: SQLiteDatabase, workoutId: number, minutes: number) {
  await db.runAsync('UPDATE workouts SET finished_at = started_at + ? WHERE id = ?', minutes * 60 * 1000, workoutId);
}

export async function finishWorkout(
  db: SQLiteDatabase,
  workoutId: number,
  finishedAt = Date.now()
): Promise<boolean> {
  let kept = false;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ? AND done = 0', workoutId);
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM workout_sets WHERE workout_id = ?',
      workoutId
    );
    kept = (row?.n ?? 0) > 0;
    if (kept) {
      await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', finishedAt, workoutId);
    } else {
      await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    }
  });
  return kept;
}

export type LoggedExercise = {
  exerciseId: number;
  sets: { weight: number | null; reps: number | null }[];
};

/** Saves a workout that already happened, with all its sets marked done. Returns its id. */
export async function saveCompletedWorkout(
  db: SQLiteDatabase,
  workout: { name: string; startedAt: number; finishedAt: number; exercises: LoggedExercise[] }
): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)',
      workout.name,
      workout.startedAt,
      workout.finishedAt
    );
    id = result.lastInsertRowId;
    for (const [position, exercise] of workout.exercises.entries()) {
      for (const [index, set] of exercise.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets (workout_id, exercise_id, exercise_position, set_index, weight, reps, done)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          id,
          exercise.exerciseId,
          position,
          index,
          set.weight,
          set.reps
        );
      }
    }
  });
  return id;
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: number) {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export function listFinishedWorkouts(db: SQLiteDatabase, limit = 200) {
  return db.getAllAsync<WorkoutSummary>(
    `SELECT w.*,
       COUNT(ws.id) AS set_count,
       COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) AS volume,
       (SELECT GROUP_CONCAT(name, ', ') FROM (
          SELECT e.name FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
          WHERE s.workout_id = w.id GROUP BY s.exercise_position ORDER BY s.exercise_position
       )) AS exercises
     FROM workouts w LEFT JOIN workout_sets ws ON ws.workout_id = w.id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id
     ORDER BY w.started_at DESC
     LIMIT ?`,
    limit
  );
}

/** Best set and estimated 1RM per exercise, most recently trained first. */
export async function getExerciseBests(db: SQLiteDatabase): Promise<ExerciseBest[]> {
  const rows = await db.getAllAsync<{
    exercise_id: number;
    name: string;
    muscle: string;
    gif: string | null;
    workout_id: number;
    started_at: number;
    weight: number | null;
    reps: number | null;
  }>(
    `SELECT ws.exercise_id, e.name, e.muscle, e.gif, ws.workout_id, w.started_at, ws.weight, ws.reps
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.done = 1 AND w.finished_at IS NOT NULL`
  );
  const bests = new Map<number, ExerciseBest & { workouts: Set<number> }>();
  for (const r of rows) {
    let b = bests.get(r.exercise_id);
    if (!b) {
      b = {
        exercise_id: r.exercise_id,
        name: r.name,
        muscle: r.muscle,
        gif: r.gif,
        times: 0,
        last_done: 0,
        best_weight: 0,
        best_weight_reps: 0,
        best_e1rm: 0,
        workouts: new Set(),
      };
      bests.set(r.exercise_id, b);
    }
    b.workouts.add(r.workout_id);
    b.last_done = Math.max(b.last_done, r.started_at);
    const w = r.weight ?? 0;
    const reps = r.reps ?? 0;
    if (w > b.best_weight || (w === b.best_weight && reps > b.best_weight_reps)) {
      b.best_weight = w;
      b.best_weight_reps = reps;
    }
    b.best_e1rm = Math.max(b.best_e1rm, estimateOneRepMax(r.weight, r.reps) ?? 0);
  }
  return [...bests.values()]
    .map(({ workouts, ...b }) => ({ ...b, times: workouts.size }))
    .sort((a, b) => b.last_done - a.last_done);
}
