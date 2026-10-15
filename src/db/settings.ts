import type { SQLiteDatabase } from 'expo-sqlite';

export const DEFAULT_WEEKLY_GOAL = 3;

async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

/** Workouts per week the user aims for. */
export async function getWeeklyGoal(db: SQLiteDatabase) {
  const value = Number(await getSetting(db, 'weekly_goal'));
  return value > 0 ? value : DEFAULT_WEEKLY_GOAL;
}

export function setWeeklyGoal(db: SQLiteDatabase, goal: number) {
  return setSetting(db, 'weekly_goal', String(goal));
}
