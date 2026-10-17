import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BackupError, createBackup, validateBackup, type Backup } from '@/db/backup';
import { dayKey } from '@/lib/stats';

/** Writes a backup file and opens the share sheet, so it can go to Files, iCloud Drive, AirDrop or a message. */
export async function shareBackup(db: SQLiteDatabase) {
  const backup = await createBackup(db);
  const file = new File(Paths.cache, `spotter-backup-${dayKey(new Date())}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your Spotter backup' });
}

/** Lets the user pick a backup file; null when they cancel. Throws BackupError for a wrong file. */
export async function pickBackup(db: SQLiteDatabase): Promise<Backup | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'] });
  if (picked.canceled) return null;
  let data: unknown;
  try {
    data = JSON.parse(await picked.result.text());
  } catch {
    throw new BackupError("This file isn't a Spotter backup.");
  }
  return validateBackup(db, data);
}
