import type { SQLiteDatabase } from 'expo-sqlite';

import type { WeightEntry } from '@/lib/body';

/** All weigh-ins, oldest first. */
export function listWeights(db: SQLiteDatabase) {
  return db.getAllAsync<WeightEntry>('SELECT id, measured_at, weight FROM body_weights ORDER BY measured_at');
}

/** Logs a weigh-in, replacing any earlier one from the same day so each day keeps one value. */
export async function logWeight(db: SQLiteDatabase, weight: number, at: Date) {
  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM body_weights WHERE measured_at >= ? AND measured_at < ?',
      dayStart.getTime(),
      dayEnd
    );
    await db.runAsync('INSERT INTO body_weights (measured_at, weight) VALUES (?, ?)', at.getTime(), weight);
  });
}

export async function deleteWeight(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM body_weights WHERE id = ?', id);
}
