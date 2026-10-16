import type { SQLiteDatabase } from 'expo-sqlite';

import { listWeights } from './body';
import { getProfile } from './profile';
import { getWeeklyGoal } from './settings';
import { getExerciseBests, listFinishedWorkouts } from './workouts';

export type CoachMessage = { id: number; role: 'user' | 'assistant'; content: string; created_at: number };

const HISTORY_LIMIT = 200;

export function listCoachMessages(db: SQLiteDatabase) {
  return db.getAllAsync<CoachMessage>(
    `SELECT * FROM (SELECT * FROM coach_messages ORDER BY id DESC LIMIT ?) ORDER BY id`,
    HISTORY_LIMIT
  );
}

export async function addCoachMessage(db: SQLiteDatabase, role: CoachMessage['role'], content: string) {
  const result = await db.runAsync(
    'INSERT INTO coach_messages (role, content, created_at) VALUES (?, ?, ?)',
    role,
    content,
    Date.now()
  );
  return result.lastInsertRowId;
}

export async function clearCoachMessages(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM coach_messages');
}

/** Everything the coach should know about the user, gathered for the system prompt. */
export async function gatherCoachData(db: SQLiteDatabase) {
  const [profile, weights, goal, recent, bests] = await Promise.all([
    getProfile(db),
    listWeights(db),
    getWeeklyGoal(db),
    listFinishedWorkouts(db, 8),
    getExerciseBests(db),
  ]);
  const topSets = await getTopSets(db, recent.map((w) => w.id));
  return {
    profile,
    weights,
    weeklyGoal: goal,
    recent: recent.map((w) => ({ ...w, top: topSets.get(w.id) ?? [] })),
    bests: bests.slice(0, 12),
  };
}

/** Per workout and exercise: completed set count and the heaviest set, in exercise order. */
async function getTopSets(db: SQLiteDatabase, workoutIds: number[]) {
  const result = new Map<number, { exercise: string; sets: number; weight: number | null; reps: number | null }[]>();
  if (workoutIds.length === 0) return result;
  const rows = await db.getAllAsync<{
    workout_id: number;
    exercise: string;
    sets: number;
    weight: number | null;
    reps: number | null;
  }>(
    `SELECT ws.workout_id, e.name AS exercise, COUNT(*) AS sets,
       MAX(COALESCE(ws.weight, 0)) AS weight,
       (SELECT s2.reps FROM workout_sets s2
          WHERE s2.workout_id = ws.workout_id AND s2.exercise_position = ws.exercise_position AND s2.done = 1
          ORDER BY COALESCE(s2.weight, 0) DESC, s2.reps DESC LIMIT 1) AS reps
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.done = 1 AND ws.workout_id IN (${workoutIds.map(() => '?').join(',')})
     GROUP BY ws.workout_id, ws.exercise_position
     ORDER BY ws.workout_id, ws.exercise_position`,
    ...workoutIds
  );
  for (const r of rows) {
    const list = result.get(r.workout_id) ?? [];
    list.push({ exercise: r.exercise, sets: r.sets, weight: r.weight, reps: r.reps });
    result.set(r.workout_id, list);
  }
  return result;
}

export type CoachData = Awaited<ReturnType<typeof gatherCoachData>>;
