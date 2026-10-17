import type { SQLiteDatabase } from 'expo-sqlite';

export const DEFAULT_WEEKLY_GOAL = 3;

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
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

export const DEFAULT_REST_SECONDS = 90;

/** Rest between sets for exercises that don't set their own. */
export async function getDefaultRest(db: SQLiteDatabase) {
  const value = Number(await getSetting(db, 'default_rest'));
  return value > 0 ? value : DEFAULT_REST_SECONDS;
}

export function setDefaultRest(db: SQLiteDatabase, seconds: number) {
  return setSetting(db, 'default_rest', String(seconds));
}

/** Keep the screen on during a workout (on unless turned off). */
export async function getKeepAwake(db: SQLiteDatabase) {
  return (await getSetting(db, 'keep_awake')) !== '0';
}

export function setKeepAwake(db: SQLiteDatabase, on: boolean) {
  return setSetting(db, 'keep_awake', on ? '1' : '0');
}
