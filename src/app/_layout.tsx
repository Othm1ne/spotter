import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { DATABASE_NAME, migrate } from '@/db/schema';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.background,
    primary: Colors.accent,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerTintColor: Colors.accent,
            headerTitleStyle: { color: Colors.text },
            // Arrow only: the default label would show the previous route's name, e.g. "(tabs)".
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* The workout screen sets its own header buttons (minimize, finish). */}
          <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', gestureEnabled: false, title: '' }} />
          <Stack.Screen
            name="add-exercise"
            options={{ presentation: 'modal', title: 'Add exercise', headerLeft: () => <HeaderButton label="Close" /> }}
          />
          <Stack.Screen
            name="exercise/[id]"
            options={{ presentation: 'modal', title: '', headerRight: () => <HeaderButton label="Done" /> }}
          />
          <Stack.Screen
            name="log-workout"
            options={{ presentation: 'modal', title: 'Log workout', headerLeft: () => <HeaderButton label="Cancel" /> }}
          />
          <Stack.Screen
            name="routine/[id]"
            options={{ presentation: 'modal', headerLeft: () => <HeaderButton label="Cancel" /> }}
          />
          <Stack.Screen
            name="achievements"
            options={{ presentation: 'modal', title: 'Achievements', headerRight: () => <HeaderButton label="Done" /> }}
          />
          <Stack.Screen
            name="settings"
            options={{ presentation: 'modal', title: 'Settings', headerRight: () => <HeaderButton label="Done" /> }}
          />
          {/* A card, not fullScreenModal: full-screen modals report zero safe-area insets on iOS,
              which pushed onboarding under the status bar and home indicator. */}
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen
            name="weight"
            options={{ presentation: 'modal', title: 'Body weight', headerLeft: () => <HeaderButton label="Cancel" /> }}
          />
          <Stack.Screen name="history/[id]" options={{ title: 'Workout' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}

function HeaderButton({ label }: { label: string }) {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingHorizontal: 8 }}>
      <Text style={{ color: Colors.accent, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
