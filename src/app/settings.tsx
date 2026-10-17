import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text } from 'react-native';

import { ReminderSettingsSection } from '@/components/reminder-settings';
import { Row, Section, Stepper } from '@/components/settings-rows';
import { Colors, Spacing } from '@/constants/theme';
import { BackupError, deleteAllChats, deleteAllData, restoreBackup } from '@/db/backup';
import { getProfile } from '@/db/profile';
import {
  DEFAULT_REST_SECONDS,
  DEFAULT_WEEKLY_GOAL,
  getDefaultRest,
  getKeepAwake,
  getWeeklyGoal,
  setDefaultRest,
  setKeepAwake,
  setWeeklyGoal,
} from '@/db/settings';
import { goalTitle, type Profile } from '@/lib/profile';
import { formatDuration } from '@/lib/workout-math';
import { aiChat, aiConfigured, aiErrorMessage } from '@/services/ai';
import { pickBackup, shareBackup } from '@/services/backup';

const REST_STEP = 15;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [rest, setRest] = useState(DEFAULT_REST_SECONDS);
  const [awake, setAwake] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setProfile(await getProfile(db));
        setGoal(await getWeeklyGoal(db));
        setRest(await getDefaultRest(db));
        setAwake(await getKeepAwake(db));
      })();
    }, [db])
  );

  function changeGoal(delta: number) {
    const next = Math.min(7, Math.max(1, goal + delta));
    Haptics.selectionAsync();
    setGoal(next);
    setWeeklyGoal(db, next);
  }

  function changeRest(delta: number) {
    const next = Math.min(300, Math.max(30, rest + delta));
    Haptics.selectionAsync();
    setRest(next);
    setDefaultRest(db, next);
  }

  function toggleAwake(on: boolean) {
    setAwake(on);
    setKeepAwake(db, on);
  }

  async function testCoach() {
    setBusy('ai');
    setAiStatus(null);
    try {
      await aiChat([{ role: 'user', content: 'Reply with one short sentence of training motivation.' }], { maxTokens: 60 });
      setAiStatus('Connected: the coach is working.');
    } catch (e) {
      setAiStatus(aiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onExport() {
    setBusy('export');
    try {
      await shareBackup(db);
    } catch {
      Alert.alert('Backup failed', 'The backup file could not be created. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    try {
      const backup = await pickBackup(db);
      if (!backup) return;
      const workouts = backup.tables.workouts?.length ?? 0;
      const foods = backup.tables.food_entries?.length ?? 0;
      Alert.alert(
        'Restore this backup?',
        `From ${new Date(backup.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}: ${workouts} workouts and ${foods} food entries. Everything currently on this phone will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy('restore');
              try {
                await restoreBackup(db, backup);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Restored', 'Your data is back.', [{ text: 'OK', onPress: () => router.dismissAll() }]);
              } catch {
                Alert.alert('Restore failed', 'Nothing was changed. The backup file may be damaged.');
              } finally {
                setBusy(null);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Can’t restore', e instanceof BackupError ? e.message : 'The file could not be read.');
    }
  }

  function onDeleteChats() {
    Alert.alert('Delete all coach chats?', 'Your workouts, food and plans stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAllChats(db);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }

  function onDeleteAll() {
    Alert.alert(
      'Delete all your data?',
      'Workouts, plans, program, food log, body weight, chats and your profile will be erased from this phone. Export a backup first if you might want them back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteAllData(db);
                  router.dismissAll();
                },
              },
            ]),
        },
      ]
    );
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="You">
        <Row
          icon="person-circle"
          title={profile ? profile.name || 'Your profile' : 'Set up your profile'}
          subtitle={
            profile
              ? `${goalTitle(profile.goal)} · ${profile.daysPerWeek} days a week · ${profile.sessionMinutes} min`
              : 'Goal, body, schedule and equipment'
          }
          onPress={() => router.push('/onboarding')}
        />
        <Row icon="barbell" title="Training program" subtitle="Build, view or change your program" onPress={() => router.push('/program')} />
        <Row icon="scale" title="Body weight" subtitle="Log and see your trend" onPress={() => router.push('/weight')} />
      </Section>

      <Section title="Training">
        <Stepper
          icon="calendar"
          title="Weekly goal"
          subtitle="Workouts per week for your goal streak"
          value={`${goal}`}
          onMinus={() => changeGoal(-1)}
          onPlus={() => changeGoal(1)}
        />
        <Stepper
          icon="timer"
          title="Default rest"
          subtitle="For exercises without their own rest time"
          value={formatDuration(rest)}
          onMinus={() => changeRest(-REST_STEP)}
          onPlus={() => changeRest(REST_STEP)}
        />
        <Row
          icon="phone-portrait"
          title="Keep screen on"
          subtitle="During workouts, so the timer stays visible"
          right={
            <Switch
              value={awake}
              onValueChange={toggleAwake}
              trackColor={{ true: Colors.accent, false: Colors.surfaceRaised }}
              thumbColor={Colors.text}
            />
          }
        />
      </Section>

      <ReminderSettingsSection />

      <Section title="AI coach">
        <Row
          icon="sparkles"
          title={aiConfigured ? 'Coach is set up' : 'Coach is not set up'}
          subtitle={aiStatus ?? 'Free AI (Groq) through Spotter’s private relay. Only fitness topics.'}
          right={
            busy === 'ai' ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Pressable onPress={testCoach} hitSlop={8} disabled={!aiConfigured}>
                <Text style={[styles.action, !aiConfigured && { opacity: 0.4 }]}>Test</Text>
              </Pressable>
            )
          }
        />
        <Row icon="chatbubbles" title="Delete all chats" danger onPress={onDeleteChats} />
      </Section>

      <Section title="Your data" footer="Everything stays on this phone. Export a backup to keep it safe or move it to a new phone.">
        <Row
          icon="share-outline"
          title="Export backup"
          subtitle="Save a file to Files, iCloud Drive or AirDrop"
          onPress={onExport}
          right={busy === 'export' ? <ActivityIndicator color={Colors.accent} /> : undefined}
        />
        <Row
          icon="download-outline"
          title="Restore from backup"
          subtitle="Replace this phone’s data with a backup file"
          onPress={onRestore}
          right={busy === 'restore' ? <ActivityIndicator color={Colors.accent} /> : undefined}
        />
        <Row icon="trash" title="Delete all data" danger onPress={onDeleteAll} />
      </Section>

      <Section title="About">
        <Row icon="information-circle" title="Spotter" subtitle={`Version ${version}`} />
        <Text style={styles.credits}>
          Exercise animations: ExerciseGymGifsDB. Exercise steps: ExerciseDB. Food data: Open Food Facts (ODbL). AI by
          Groq. Spotter gives general fitness guidance, not medical advice.
        </Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 60 },
  action: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  credits: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, paddingBottom: Spacing.md },
});
