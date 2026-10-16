import type { SQLiteDatabase } from 'expo-sqlite';

import { estimateMinutes, nextDayIndex, type Candidate, type ProgramDraft } from '@/lib/program';

export type ProgramDayRow = {
  routine_id: number;
  name: string;
  focus: string | null;
  program_day: number;
  exercises: string | null;
  exercise_count: number;
  minutes: number;
  last_done: number | null;
};

export type Program = {
  id: number;
  name: string;
  summary: string;
  weeks: number;
  source: 'ai' | 'template';
  started_at: number;
  days: ProgramDayRow[];
  /** Index into `days` of the next workout in the rotation. */
  next: number;
  /** When a program workout was last finished. */
  lastDoneAt: number | null;
};

/** The library exercises matching these names (missing ones are skipped). */
export function getCandidates(db: SQLiteDatabase, names: string[]) {
  return db.getAllAsync<Candidate & { gif: string | null }>(
    `SELECT id, name, muscle, equipment, gif FROM exercises WHERE name IN (${names.map(() => '?').join(',')})`,
    ...names
  );
}

/** Saves the program and its days as workout plans, replacing any previous program. Returns its id. */
export async function saveProgram(db: SQLiteDatabase, draft: ProgramDraft): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    // One program at a time; deleting it removes its plans (workouts keep their history).
    await db.runAsync('DELETE FROM programs');
    const now = Date.now();
    const program = await db.runAsync(
      'INSERT INTO programs (name, summary, weeks, source, started_at) VALUES (?, ?, ?, ?, ?)',
      draft.name,
      draft.summary,
      draft.weeks,
      draft.source,
      now
    );
    id = program.lastInsertRowId;
    for (const [dayIndex, day] of draft.days.entries()) {
      const routine = await db.runAsync(
        'INSERT INTO routines (name, created_at, program_id, program_day, focus) VALUES (?, ?, ?, ?, ?)',
        day.name,
        now,
        id,
        dayIndex,
        day.focus
      );
      for (const [position, ex] of day.exercises.entries()) {
        const re = await db.runAsync(
          `INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, rest_seconds, rep_min, rep_max)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          routine.lastInsertRowId,
          ex.exerciseId,
          position,
          ex.sets,
          ex.restSeconds,
          ex.repMin,
          ex.repMax
        );
        for (let i = 0; i < ex.sets; i++) {
          await db.runAsync(
            'INSERT INTO routine_sets (routine_exercise_id, set_index, weight, reps) VALUES (?, ?, NULL, ?)',
            re.lastInsertRowId,
            i,
            ex.repMin
          );
        }
      }
    }
  });
  return id;
}

export async function deleteProgram(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM programs');
}

export async function getProgram(db: SQLiteDatabase): Promise<Program | null> {
  const program = await db.getFirstAsync<Omit<Program, 'days' | 'next' | 'lastDoneAt'>>(
    'SELECT * FROM programs ORDER BY id DESC LIMIT 1'
  );
  if (!program) return null;
  const days = await db.getAllAsync<Omit<ProgramDayRow, 'minutes'> & { sets: number; rest: number }>(
    `SELECT r.id AS routine_id, r.name, r.focus, r.program_day,
       (SELECT GROUP_CONCAT(name, ', ') FROM (
          SELECT e.name FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = r.id ORDER BY re.position
       )) AS exercises,
       (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) AS exercise_count,
       (SELECT COUNT(*) FROM routine_sets rs JOIN routine_exercises re ON re.id = rs.routine_exercise_id
          WHERE re.routine_id = r.id) AS sets,
       (SELECT COALESCE(SUM(re.rest_seconds * (SELECT COUNT(*) FROM routine_sets rs WHERE rs.routine_exercise_id = re.id)), 0)
          FROM routine_exercises re WHERE re.routine_id = r.id) AS rest,
       (SELECT MAX(w.started_at) FROM workouts w WHERE w.routine_id = r.id AND w.finished_at IS NOT NULL) AS last_done
     FROM routines r
     WHERE r.program_id = ?
     ORDER BY r.program_day`,
    program.id
  );
  const last = await db.getFirstAsync<{ program_day: number; started_at: number }>(
    `SELECT r.program_day, w.started_at FROM workouts w JOIN routines r ON r.id = w.routine_id
     WHERE r.program_id = ? AND w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC LIMIT 1`,
    program.id
  );
  const lastIndex = last ? days.findIndex((d) => d.program_day === last.program_day) : -1;
  return {
    ...program,
    days: days.map(({ sets, rest, ...d }) => ({
      ...d,
      // Same estimate as the plan preview: per set about 40 s of work plus its rest.
      minutes: estimateMinutes([{ sets, restSeconds: sets > 0 ? rest / sets : 0 }]),
    })),
    next: nextDayIndex(days.length, lastIndex === -1 ? null : lastIndex),
    lastDoneAt: last?.started_at ?? null,
  };
}
