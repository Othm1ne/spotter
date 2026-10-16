import type { SQLiteDatabase } from 'expo-sqlite';

import type { Profile } from '@/lib/profile';

import { getSetting, setSetting, setWeeklyGoal } from './settings';

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const json = await getSetting(db, 'profile');
  return json ? (JSON.parse(json) as Profile) : null;
}

/** Saves the profile; the weekly workout goal follows the training days chosen. */
export async function saveProfile(db: SQLiteDatabase, profile: Profile) {
  await setSetting(db, 'profile', JSON.stringify(profile));
  await setWeeklyGoal(db, profile.daysPerWeek);
}
