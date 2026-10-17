import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { PickerSheet, range, Wheel } from '@/components/picker-field';
import { Row, Section } from '@/components/settings-rows';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { DEFAULT_REMINDERS, formatTime, parseTime, type ReminderSettings } from '@/lib/reminders';
import { ensureNotificationPermission, getReminderSettings, saveReminderSettings } from '@/services/reminders';

type TimeKey = 'breakfast' | 'lunch' | 'dinner' | 'waterStart' | 'waterEnd' | 'weighInTime' | 'workoutTime';
type Toggle = 'meals' | 'water' | 'weighIn' | 'workout';

const HOURS = range(0, 23);
const MINUTES = range(0, 55, 5);
const WATER_EVERY = [1, 2, 3];
const pad = (n: number) => String(n).padStart(2, '0');

/** Settings section: meal, water, weigh-in and workout reminders, each with its own times. */
export function ReminderSettingsSection() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
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
      Alert.alert(t('reminders.offTitle'), t('reminders.offBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.openSettings'), onPress: () => Linking.openSettings() },
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
      trackColor={{ true: c.accent, false: c.surfaceRaised }}
      thumbColor="#FFFFFF"
    />
  );

  const times = (keys: TimeKey[]) => (
    <View style={styles.times}>
      {keys.map((k) => (
        <Pressable key={k} onPress={() => openTime(k)} style={styles.time}>
          <Text style={styles.timeLabel}>{t(`reminders.time.${k}`)}</Text>
          <Text style={styles.timeValue}>{settings[k]}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Section title={t('reminders.title')} footer={t('reminders.footer')}>
      <Row icon="restaurant" title={t('reminders.meals')} subtitle={t('reminders.mealsSub')} right={toggleSwitch('meals')} />
      {settings.meals && times(['breakfast', 'lunch', 'dinner'])}

      <Row
        icon="water"
        title={t('reminders.water')}
        subtitle={settings.water ? t('reminders.waterOn', { hours: settings.waterEveryHours }) : t('reminders.waterOff')}
        right={toggleSwitch('water')}
      />
      {settings.water && (
        <>
          {times(['waterStart', 'waterEnd'])}
          <View style={styles.every}>
            <Text style={styles.timeLabel}>{t('reminders.every')}</Text>
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

      <Row icon="scale" title={t('reminders.weighIn')} subtitle={t('reminders.weighInSub')} right={toggleSwitch('weighIn')} />
      {settings.weighIn && times(['weighInTime'])}

      <Row
        icon="barbell"
        title={t('reminders.workout')}
        subtitle={t('reminders.workoutSub')}
        right={toggleSwitch('workout')}
      />
      {settings.workout && times(['workoutTime'])}

      <PickerSheet visible={editing !== null} title={editing ? t(`reminders.timeTitle.${editing}`) : ''} onClose={closeTime}>
        <Wheel values={HOURS} value={draft.hour} onChange={(hour) => setDraft((d) => ({ ...d, hour }))} format={pad} />
        <Text style={styles.colon}>:</Text>
        <Wheel values={MINUTES} value={draft.minute} onChange={(minute) => setDraft((d) => ({ ...d, minute }))} format={pad} />
      </PickerSheet>
    </Section>
  );
}

const useStyles = makeStyles((c) => ({
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md, paddingLeft: 34 },
  time: { backgroundColor: c.surfaceRaised, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 92 },
  timeLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  timeValue: { color: c.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  every: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md, paddingLeft: 34 },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: c.surfaceRaised },
  chipOn: { backgroundColor: c.accent },
  chipText: { color: c.text, fontWeight: '700' },
  chipTextOn: { color: c.accentText },
  colon: { color: c.text, fontSize: 24, fontWeight: '800' },
}));
