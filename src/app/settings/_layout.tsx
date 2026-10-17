import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useT } from '@/i18n';
import { useColors } from '@/theme';

/** Settings has its own stack, so its sub-pages slide in inside the same sheet. */
export default function SettingsLayout() {
  const c = useColors();
  const t = useT();
  return (
    <Stack
      screenOptions={{
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text },
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: t('screens.settings'),
          headerRight: () => (
            <Pressable onPress={() => router.dismiss()} hitSlop={12} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>{t('common.done')}</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="reminders" options={{ title: t('reminders.title') }} />
      <Stack.Screen name="data" options={{ title: t('settings.dataTitle') }} />
    </Stack>
  );
}
