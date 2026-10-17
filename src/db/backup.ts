import type { SQLiteDatabase } from 'expo-sqlite';

/** Tables in the backup, parents before children so rows can be inserted in this order. */
const TABLES = [
  'programs',
  'routines',
  'routine_exercises',
  'routine_sets',
  'workouts',
  'workout_sets',
  'body_weights',
  'coach_conversations',
  'coach_messages',
  'foods',
  'food_entries',
  'water',
  'settings',
] as const;

type Row = Record<string, string | number | null>;
type BackupExercise = { id: number; name: string; muscle: string; equipment: string; gif: string | null };

export type Backup = {
  app: 'spotter';
  version: number;
  exportedAt: number;
  /** Exercises the backup refers to. The library itself isn't saved: the app rebuilds it. */
  exercises: BackupExercise[];
  tables: Record<string, Row[]>;
};

async function schemaVersion(db: SQLiteDatabase) {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

export async function createBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables: Record<string, Row[]> = {};
  for (const table of TABLES) tables[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  const exercises = await db.getAllAsync<BackupExercise>(
    `SELECT id, name, muscle, equipment, gif FROM exercises
     WHERE id IN (SELECT exercise_id FROM workout_sets UNION SELECT exercise_id FROM routine_exercises)`
  );
  return { app: 'spotter', version: await schemaVersion(db), exportedAt: Date.now(), exercises, tables };
}

export class BackupError extends Error {}

/** Checks a parsed file is a Spotter backup this version of the app can restore. */
export async function validateBackup(db: SQLiteDatabase, data: unknown): Promise<Backup> {
  const backup = data as Partial<Backup> | null;
  if (!backup || backup.app !== 'spotter' || typeof backup.tables !== 'object' || !Array.isArray(backup.exercises)) {
    throw new BackupError("This file isn't a Spotter backup.");
  }
  if (backup.version !== (await schemaVersion(db))) {
    throw new BackupError('This backup was made with a different version of Spotter. Update both phones to the same version first.');
  }
  return backup as Backup;
}

/** Replaces everything on this phone with the backup, in one transaction. */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup) {
  await db.withTransactionAsync(async () => {
    // Exercise ids can differ between installs: match them by name, add any that are missing.
    const ids = new Map<number, number>();
    for (const e of backup.exercises) {
      const found = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', e.name);
      const id =
        found?.id ??
        (
          await db.runAsync(
            'INSERT INTO exercises (name, muscle, equipment, gif, custom) VALUES (?, ?, ?, ?, 1)',
            e.name,
            e.muscle,
            e.equipment,
            e.gif
          )
        ).lastInsertRowId;
      ids.set(e.id, id);
    }

    for (const table of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${table}`);
    for (const table of TABLES) {
      for (const row of backup.tables[table] ?? []) {
        const values = { ...row };
        if (typeof values.exercise_id === 'number') values.exercise_id = ids.get(values.exercise_id) ?? values.exercise_id;
        const columns = Object.keys(values);
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          ...columns.map((c) => values[c])
        );
      }
    }
  });
}

/** Deletes the user's data (workouts, plans, food, weight, chats, settings), keeping the exercise library. */
export async function deleteAllData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const table of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${table}`);
    await db.runAsync('DELETE FROM exercises WHERE custom = 1');
  });
}

export async function deleteAllChats(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM coach_messages');
    await db.runAsync('DELETE FROM coach_conversations');
  });
}
