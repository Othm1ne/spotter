import type { SQLiteDatabase } from 'expo-sqlite';

import { getPreviousSets, type Exercise } from './workouts';

export const DEFAULT_REST_SECONDS = 90;

export type RoutineSummary = {
  id: number;
  name: string;
  exercise_count: number;
  set_count: number;
  exercises: string | null;
  last_done: number | null;
};

export type RoutineSet = { weight: number | null; reps: number | null };

export type RoutineExercise = {
  exercise: Exercise;
  restSeconds: number;
  sets: RoutineSet[];
};

export type Routine = { id: number; name: string; exercises: RoutineExercise[] };

export function listRoutines(db: SQLiteDatabase) {
  return db.getAllAsync<RoutineSummary>(
    `SELECT r.id, r.name,
       (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) AS exercise_count,
       (SELECT COUNT(*) FROM routine_sets rs JOIN routine_exercises re ON re.id = rs.routine_exercise_id
          WHERE re.routine_id = r.id) AS set_count,
       (SELECT GROUP_CONCAT(name, ', ') FROM (
          SELECT e.name FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = r.id ORDER BY re.position
       )) AS exercises,
       (SELECT MAX(w.started_at) FROM workouts w WHERE w.routine_id = r.id AND w.finished_at IS NOT NULL) AS last_done
     FROM routines r
     ORDER BY r.created_at DESC`
  );
}

export async function getRoutine(db: SQLiteDatabase, id: number): Promise<Routine | null> {
  const routine = await db.getFirstAsync<{ id: number; name: string }>('SELECT id, name FROM routines WHERE id = ?', id);
  if (!routine) return null;
  const rows = await db.getAllAsync<
    Exercise & {
      routine_exercise_id: number;
      rest_seconds: number;
      set_index: number | null;
      weight: number | null;
      reps: number | null;
    }
  >(
    `SELECT re.id AS routine_exercise_id, re.rest_seconds, e.id, e.name, e.muscle, e.equipment, e.gif,
       rs.set_index, rs.weight, rs.reps
     FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     LEFT JOIN routine_sets rs ON rs.routine_exercise_id = re.id
     WHERE re.routine_id = ?
     ORDER BY re.position, rs.set_index`,
    id
  );
  const exercises = new Map<number, RoutineExercise>();
  for (const r of rows) {
    let block = exercises.get(r.routine_exercise_id);
    if (!block) {
      block = {
        exercise: { id: r.id, name: r.name, muscle: r.muscle, equipment: r.equipment, gif: r.gif },
        restSeconds: r.rest_seconds,
        sets: [],
      };
      exercises.set(r.routine_exercise_id, block);
    }
    // A set may leave weight and reps blank: "use what I did last time".
    if (r.set_index !== null) block.sets.push({ weight: r.weight, reps: r.reps });
  }
  return { ...routine, exercises: [...exercises.values()] };
}

/** Creates the routine, or replaces the contents of an existing one. Returns its id. */
export async function saveRoutine(
  db: SQLiteDatabase,
  routine: { id: number | null; name: string; exercises: RoutineExercise[] }
): Promise<number> {
  let id = routine.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (routine.id === null) {
      const result = await db.runAsync('INSERT INTO routines (name, created_at) VALUES (?, ?)', routine.name, Date.now());
      id = result.lastInsertRowId;
    } else {
      await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', routine.name, id);
      await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    }
    for (const [position, block] of routine.exercises.entries()) {
      const re = await db.runAsync(
        `INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, rest_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        block.exercise.id,
        position,
        block.sets.length,
        block.restSeconds
      );
      for (const [index, set] of block.sets.entries()) {
        await db.runAsync(
          'INSERT INTO routine_sets (routine_exercise_id, set_index, weight, reps) VALUES (?, ?, ?, ?)',
          re.lastInsertRowId,
          index,
          set.weight,
          set.reps
        );
      }
    }
  });
  return id;
}

export async function deleteRoutine(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM routines WHERE id = ?', id);
}

/**
 * Starts a workout pre-filled from the routine: each set gets the routine's reps, and its weight
 * (or the weight used last time when the routine leaves it blank) and the exercise's rest time.
 */
export async function startRoutine(db: SQLiteDatabase, routineId: number): Promise<number> {
  const routine = await getRoutine(db, routineId);
  if (!routine) throw new Error(`Routine ${routineId} not found`);
  const previous = await getPreviousSets(
    db,
    routine.exercises.map((e) => e.exercise.id)
  );
  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO workouts (name, started_at, routine_id) VALUES (?, ?, ?)',
      routine.name,
      Date.now(),
      routineId
    );
    id = result.lastInsertRowId;
    for (const [position, block] of routine.exercises.entries()) {
      const last = previous.get(block.exercise.id) ?? [];
      for (const [index, set] of block.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets (workout_id, exercise_id, exercise_position, set_index, weight, reps, rest_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          block.exercise.id,
          position,
          index,
          set.weight ?? last[index]?.weight ?? null,
          set.reps ?? last[index]?.reps ?? null,
          block.restSeconds
        );
      }
    }
  });
  return id;
}

/** Turns a finished workout into a plan with the same exercises, sets, kg and reps. Returns its id. */
export async function routineFromWorkout(db: SQLiteDatabase, workoutId: number, name: string) {
  const rows = await db.getAllAsync<
    Exercise & { exercise_position: number; weight: number | null; reps: number | null; rest_seconds: number | null }
  >(
    `SELECT ws.exercise_position, ws.weight, ws.reps, ws.rest_seconds, e.id, e.name, e.muscle, e.equipment, e.gif
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = ? AND ws.done = 1
     ORDER BY ws.exercise_position, ws.set_index`,
    workoutId
  );
  const blocks = new Map<number, RoutineExercise>();
  for (const r of rows) {
    const block = blocks.get(r.exercise_position) ?? {
      exercise: { id: r.id, name: r.name, muscle: r.muscle, equipment: r.equipment, gif: r.gif },
      restSeconds: r.rest_seconds ?? DEFAULT_REST_SECONDS,
      sets: [],
    };
    block.sets.push({ weight: r.weight, reps: r.reps });
    blocks.set(r.exercise_position, block);
  }
  return saveRoutine(db, { id: null, name, exercises: [...blocks.values()] });
}
