import type { SQLiteDatabase } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';

import { listWeights } from '@/db/body';
import { getWater } from '@/db/food';
import { getProfile } from '@/db/profile';
import { getProgram } from '@/db/program';
import { getSetting, getWeeklyGoal, setSetting } from '@/db/settings';
import { computeTargets } from '@/lib/nutrition';
import { DEFAULT_REMINDERS, planReminders, type ReminderSettings } from '@/lib/reminders';
import { t } from '@/i18n';
import { dayKey, startOfWeek } from '@/lib/stats';

const PREFIX = 'reminder-';

/** Asks for notification permission once; true when notifications can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

export async function getReminderSettings(db: SQLiteDatabase): Promise<ReminderSettings> {
  const json = await getSetting(db, 'reminders');
  return { ...DEFAULT_REMINDERS, ...(json ? (JSON.parse(json) as Partial<ReminderSettings>) : {}) };
}

export async function saveReminderSettings(db: SQLiteDatabase, settings: ReminderSettings) {
  await setSetting(db, 'reminders', JSON.stringify(settings));
  await syncReminders(db);
}

async function gatherState(db: SQLiteDatabase, now: Date) {
  const today = dayKey(now);
  const [profile, weights, meals, waterMl, goal, program, week] = await Promise.all([
    getProfile(db),
    listWeights(db),
    db.getAllAsync<{ meal: string }>('SELECT DISTINCT meal FROM food_entries WHERE day = ?', today),
    getWater(db, today),
    getWeeklyGoal(db),
    getProgram(db),
    db.getAllAsync<{ started_at: number }>(
      'SELECT started_at FROM workouts WHERE finished_at IS NOT NULL AND started_at >= ?',
      startOfWeek(now).getTime()
    ),
  ]);
  const latest = weights.at(-1) ?? null;
  const weight = latest?.weight ?? profile?.weightKg ?? null;
  return {
    mealsLogged: meals.map((m) => m.meal),
    waterMl,
    waterTarget: profile && weight ? computeTargets(profile, weight, now).waterMl : null,
    weighedToday: latest !== null && dayKey(latest.measured_at) === today,
    trainedToday: week.some((w) => dayKey(w.started_at) === today),
    workoutsThisWeek: week.length,
    weeklyGoal: goal,
    nextWorkout: program?.days[program.next]?.name ?? null,
  };
}

let running: Promise<void> = Promise.resolve();

/**
 * Re-plans the reminders for today and tomorrow from the current data. Called when the app opens
 * and after logging, so reminders for things already done disappear.
 */
export function syncReminders(db: SQLiteDatabase) {
  running = running.then(() => sync(db)).catch(() => {});
  return running;
}

async function sync(db: SQLiteDatabase) {
  const settings = await getReminderSettings(db);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const anyOn = settings.meals || settings.water || settings.weighIn || settings.workout;
  if (!anyOn) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const now = new Date();
  const reminders = planReminders(settings, await gatherState(db, now), now);
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + r.id,
      content: {
        title: t(`notify.${r.title}`, r.params),
        body: t(`notify.${r.body}`, { ...r.params, count: r.params?.left ?? 0 }),
        sound: true,
        data: { url: r.url },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
}
