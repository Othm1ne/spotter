import * as Notifications from 'expo-notifications';

import { currentLanguage, t } from '@/i18n';

import { ensureNotificationPermission } from './reminders';

/** The "resting until…" notice shown right away, and the alert when rest is over. */
const STATUS_ID = 'rest-status';
const END_ID = 'rest-end';

/**
 * The running rest timer lives outside React so it survives minimizing the
 * workout screen. Only one rest timer can run at a time.
 */
const rest: { endsAt: number | null; next: string | null } = { endsAt: null, next: null };

export function getRestEndsAt() {
  return rest.endsAt;
}

const clock = (time: number) => new Date(time).toLocaleTimeString(currentLanguage(), { hour: '2-digit', minute: '2-digit' });

/** Shows "resting until" now (on the lock screen, no banner in the app) and schedules the end alert. */
async function notify(endsAt: number, next: string | null) {
  const seconds = Math.round((endsAt - Date.now()) / 1000);
  if (seconds <= 0 || !(await ensureNotificationPermission())) return;
  const nextLine = next ? t('notify.restNext', { next }) : t('notify.restReady');
  await Notifications.scheduleNotificationAsync({
    identifier: STATUS_ID,
    content: { title: t('notify.restUntil', { time: clock(endsAt) }), body: nextLine, sound: false, data: { url: '/workout', kind: 'rest-status' } },
    trigger: null,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: END_ID,
    content: { title: t('notify.restOver'), body: nextLine, sound: true, data: { url: '/workout' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

async function cancel() {
  try {
    await Notifications.cancelScheduledNotificationAsync(END_ID);
    await Notifications.dismissNotificationAsync(STATUS_ID);
    await Notifications.dismissNotificationAsync(END_ID);
  } catch {}
}

/**
 * `next` describes the coming set, e.g. "Bench Press · set 3 · 60 kg × 8". Leave it out when only
 * changing the time (±15 s) to keep the current one.
 */
export async function startRest(endsAt: number, next?: string | null) {
  rest.endsAt = endsAt;
  if (next !== undefined) rest.next = next;
  try {
    await cancel();
    // A newer timer may have started meanwhile; only the latest one notifies.
    if (rest.endsAt === endsAt) await notify(endsAt, rest.next);
  } catch {
    // Notifications are a nice-to-have: the on-screen timer still works.
  }
}

export async function stopRest() {
  rest.endsAt = null;
  await cancel();
}

/** Called when the timer has run out on screen: clear the lock screen notices. */
export function clearRest() {
  rest.endsAt = null;
  Notifications.dismissNotificationAsync(STATUS_ID).catch(() => {});
  Notifications.dismissNotificationAsync(END_ID).catch(() => {});
}
