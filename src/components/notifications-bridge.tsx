import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from '@/services/reminders';

/**
 * Keeps reminders in step with the data (on launch and whenever the app comes back) and opens the
 * right screen when a notification is tapped. Renders nothing.
 */
export function NotificationsBridge() {
  const db = useSQLiteContext();

  useEffect(() => {
    syncReminders(db);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders(db);
      // Leaving the app: plan with the latest log (e.g. water just added).
      if (state === 'background') syncReminders(db);
    });
    const tap = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Href);
    });
    return () => {
      appState.remove();
      tap.remove();
    };
  }, [db]);

  return null;
}
