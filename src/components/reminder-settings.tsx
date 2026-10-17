import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PickerSheet, range, Wheel } from '@/components/picker-field';
import { Row, Section } from '@/components/settings-rows';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_REMINDERS, formatTime, parseTime, type ReminderSettings } from '@/lib/reminders';
import { ensureNotificationPermission, getReminderSettings, saveReminderSettings } from '@/services/reminders';

type TimeKey = 'breakfast' | 'lunch' | 'dinner' | 'waterStart' | 'waterEnd' | 'weighInTime' | 'workoutTime';
type Toggle = 'meals' | 'water' | 'weighIn' | 'workout';

const TIME_TITLES: Record<TimeKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  waterStart: 'First water reminder',
  waterEnd: 'Last water reminder',
  weighInTime: 'Weigh-in',
  workoutTime: 'Workout',
};

const HOURS = range(0, 23);
const MINUTES = range(0, 55, 5);
const WATER_EVERY = [1, 2, 3];
const pad = (n: number) => String(n).padStart(2, '0');

/** Settings section: meal, water, weigh-in and workout reminders, each with its own times. */
export function ReminderSettingsSection() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [editing, setEditing] = useState<TimeKey | null>(null);
  const [draft, setDraft] = useState({ hour: 8, minute: 0 });

  useFocusEffect(
    useCallback(() => {
      getReminderSettings(db).then(setSettings);
    }, [db])
  );

  function save(next: ReminderSettings) {
    setSettings(next);
    saveReminderSettings(db, next);
  }

  async function toggle(key: Toggle, on: boolean) {
    if (on && !(await ensureNotificationPermission())) {
      Alert.alert('Notifications are off', 'Allow notifications for Expo Go in Settings to get reminders.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    Haptics.selectionAsync();
    save({ ...settings, [key]: on });
  }

  function openTime(key: TimeKey) {
    Haptics.selectionAsync();
    const { hour, minute } = parseTime(settings[key]);
    setDraft({ hour, minute: (Math.round(minute / 5) * 5) % 60 });
    setEditing(key);
  }

  function closeTime() {
    if (editing) save({ ...settings, [editing]: formatTime(draft.hour, draft.minute) });
    setEditing(null);
  }

  const toggleSwitch = (key: Toggle) => (
    <Switch
      value={settings[key]}
      onValueChange={(on) => toggle(key, on)}
      trackColor={{ true: Colors.accent, false: Colors.surfaceRaised }}
      thumbColor={Colors.text}
    />
  );

  const times = (keys: TimeKey[]) => (
    <View style={styles.times}>
      {keys.map((k) => (
        <Pressable key={k} onPress={() => openTime(k)} style={styles.time}>
          <Text style={styles.timeLabel}>{TIME_TITLES[k].replace(' reminder', '')}</Text>
          <Text style={styles.timeValue}>{settings[k]}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Section
      title="Reminders"
      footer="Smart: a reminder is skipped when it's already done, like a meal you logged or your water goal reached.">
      <Row icon="restaurant" title="Meals" subtitle="Remember to log breakfast, lunch and dinner" right={toggleSwitch('meals')} />
      {settings.meals && times(['breakfast', 'lunch', 'dinner'])}

      <Row
        icon="water"
        title="Water"
        subtitle={settings.water ? `Every ${settings.waterEveryHours} h until your goal is reached` : 'A nudge to drink through the day'}
        right={toggleSwitch('water')}
      />
      {settings.water && (
        <>
          {times(['waterStart', 'waterEnd'])}
          <View style={styles.every}>
            <Text style={styles.timeLabel}>Every</Text>
            {WATER_EVERY.map((h) => (
              <Pressable
                key={h}
                onPress={() => save({ ...settings, waterEveryHours: h })}
                style={[styles.chip, settings.waterEveryHours === h && styles.chipOn]}>
                <Text style={[styles.chipText, settings.waterEveryHours === h && styles.chipTextOn]}>{h} h</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Row icon="scale" title="Weigh-in" subtitle="Each morning, skipped once you've logged" right={toggleSwitch('weighIn')} />
      {settings.weighIn && times(['weighInTime'])}

      <Row
        icon="barbell"
        title="Workout"
        subtitle="With your next program day; quiet once you trained or hit your weekly goal"
        right={toggleSwitch('workout')}
      />
      {settings.workout && times(['workoutTime'])}

      <PickerSheet visible={editing !== null} title={editing ? TIME_TITLES[editing] : ''} onClose={closeTime}>
        <Wheel values={HOURS} value={draft.hour} onChange={(hour) => setDraft((d) => ({ ...d, hour }))} format={pad} />
        <Text style={styles.colon}>:</Text>
        <Wheel values={MINUTES} value={draft.minute} onChange={(minute) => setDraft((d) => ({ ...d, minute }))} format={pad} />
      </PickerSheet>
    </Section>
  );
}

const styles = StyleSheet.create({
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md, paddingLeft: 34 },
  time: { backgroundColor: Colors.surfaceRaised, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 92 },
  timeLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  timeValue: { color: Colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  every: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md, paddingLeft: 34 },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: Colors.surfaceRaised },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { color: Colors.text, fontWeight: '700' },
  chipTextOn: { color: Colors.accentText },
  colon: { color: Colors.text, fontSize: 24, fontWeight: '800' },
});
