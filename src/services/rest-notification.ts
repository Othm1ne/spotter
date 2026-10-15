import * as Notifications from 'expo-notifications';

let permissionAsked = false;

/**
 * The running rest timer lives outside React so it survives minimizing the
 * workout screen. Only one rest timer can run at a time.
 */
const rest: { endsAt: number | null; notificationId: string | null } = {
  endsAt: null,
  notificationId: null,
};

export function getRestEndsAt() {
  return rest.endsAt;
}

/** Schedules the "rest is over" alert so it fires even with the phone locked. */
async function scheduleAlert(seconds: number): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    if (!permissionAsked) {
      permissionAsked = true;
      const current = await Notifications.getPermissionsAsync();
      if (!current.granted) {
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        });
      }
    }
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest is over', body: 'Time for your next set 💪', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    // Notifications are a nice-to-have: the on-screen timer still works.
    return null;
  }
}

async function cancelAlert() {
  const id = rest.notificationId;
  rest.notificationId = null;
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function startRest(endsAt: number) {
  await cancelAlert();
  rest.endsAt = endsAt;
  const id = await scheduleAlert(Math.round((endsAt - Date.now()) / 1000));
  // A newer timer may have started while scheduling.
  if (rest.endsAt === endsAt) rest.notificationId = id;
  else if (id) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function stopRest() {
  rest.endsAt = null;
  await cancelAlert();
}

/** Called when the timer has run out on screen; the alert already fired. */
export function clearRest() {
  rest.endsAt = null;
  rest.notificationId = null;
}
