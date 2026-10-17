import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { NotificationsBridge } from '@/components/notifications-bridge';
import { DATABASE_NAME, migrate } from '@/db/schema';
import { I18nProvider, useT } from '@/i18n';
import { AppThemeProvider, useColors } from '@/theme';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Rest notices are for the lock screen: in the app, the on-screen timer already shows them.
    const rest = String(notification.request.identifier).startsWith('rest-');
    return {
      shouldShowBanner: !rest,
      shouldShowList: true,
      shouldPlaySound: !rest,
      shouldSetBadge: false,
    };
  },
});

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <AppThemeProvider>
        <I18nProvider>
          <ThemedStack />
        </I18nProvider>
      </AppThemeProvider>
    </SQLiteProvider>
  );
}

/** The navigation stack, colored by the current light or dark palette. */
function ThemedStack() {
  const c = useColors();
  const t = useT();
  const base = c.dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: c.background,
      card: c.background,
      primary: c.accent,
      text: c.text,
      border: c.border,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <NotificationsBridge />
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text },
          // Arrow only: the default label would show the previous route's name, e.g. "(tabs)".
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The workout screen sets its own header buttons (minimize, finish). */}
        <Stack.Screen
          name="workout"
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            title: '',
          }}
        />
        <Stack.Screen
          name="add-exercise"
          options={{
            presentation: 'modal',
            title: t('screens.addExercise'),
            headerLeft: () => <HeaderButton label={t('common.close')} />,
          }}
        />
        <Stack.Screen
          name="exercise/[id]"
          options={{
            presentation: 'modal',
            title: '',
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen
          name="log-workout"
          options={{
            presentation: 'modal',
            title: t('screens.logWorkout'),
            headerLeft: () => <HeaderButton label={t('common.cancel')} />,
          }}
        />
        <Stack.Screen
          name="routine/[id]"
          options={{
            presentation: 'modal',
            headerLeft: () => <HeaderButton label={t('common.cancel')} />,
          }}
        />
        <Stack.Screen
          name="achievements"
          options={{
            presentation: 'modal',
            title: t('screens.achievements'),
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        {/* Settings has its own stack (and header) for its sub-pages. */}
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        {/* A card, not fullScreenModal: full-screen modals report zero safe-area insets on iOS,
              which pushed onboarding under the status bar and home indicator. */}
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="weight"
          options={{
            presentation: 'modal',
            title: t('screens.bodyWeight'),
            headerLeft: () => <HeaderButton label={t('common.cancel')} />,
          }}
        />
        <Stack.Screen
          name="coach-history"
          options={{
            presentation: 'modal',
            title: t('screens.chats'),
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen
          name="food/add"
          options={{
            presentation: 'modal',
            title: t('screens.addFood'),
            headerLeft: () => <HeaderButton label={t('common.close')} />,
          }}
        />
        <Stack.Screen name="food/[id]" options={{ presentation: 'modal', title: t('screens.addFood') }} />
        <Stack.Screen
          name="nutrition-review"
          options={{
            presentation: 'modal',
            title: t('screens.coachReview'),
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen
          name="supplements"
          options={{
            presentation: 'modal',
            title: t('screens.supplements'),
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen
          name="supplement/[id]"
          options={{
            presentation: 'modal',
            title: '',
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen
          name="program"
          options={{
            presentation: 'modal',
            title: t('screens.program'),
            headerRight: () => <HeaderButton label={t('common.done')} />,
          }}
        />
        <Stack.Screen name="spotify-auth" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="history/index" options={{ title: t('screens.history') }} />
        <Stack.Screen name="history/[id]" options={{ title: t('screens.workout') }} />
      </Stack>
    </ThemeProvider>
  );
}

function HeaderButton({ label }: { label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingHorizontal: 8 }}>
      <Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
