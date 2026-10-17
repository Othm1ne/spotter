import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { MusicRow } from '@/components/music-settings';
import { Row, Section, Stepper } from '@/components/settings-rows';
import { Radius, Spacing } from '@/constants/theme';
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
import { LANGUAGES, useI18n, useT, type LanguageChoice } from '@/i18n';
import type { Profile } from '@/lib/profile';
import { formatDuration } from '@/lib/workout-math';
import { aiChat, aiConfigured, aiErrorMessage } from '@/services/ai';
import { getReminderSettings } from '@/services/reminders';
import { makeStyles, useColors, useTheme, type Appearance } from '@/theme';

const REST_STEP = 15;
const APPEARANCES: Appearance[] = ['system', 'light', 'dark'];

/** Settings home: short groups; long lists (reminders, backups) live on their own pages. */
export default function SettingsScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const { appearance, setAppearance } = useTheme();
  const { choice: languageChoice, setLanguage } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [rest, setRest] = useState(DEFAULT_REST_SECONDS);
  const [awake, setAwake] = useState(true);
  const [remindersOn, setRemindersOn] = useState(0);
  const [testing, setTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setProfile(await getProfile(db));
        setGoal(await getWeeklyGoal(db));
        setRest(await getDefaultRest(db));
        setAwake(await getKeepAwake(db));
        const r = await getReminderSettings(db);
        setRemindersOn([r.meals, r.water, r.weighIn, r.workout].filter(Boolean).length);
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

  const languageName = (code: LanguageChoice) =>
    code === 'system' ? t('settings.languageAuto') : LANGUAGES.find((l) => l.code === code)!.name;

  function pickLanguage() {
    Alert.alert(t('settings.language'), undefined, [
      ...(['system', ...LANGUAGES.map((l) => l.code)] as LanguageChoice[]).map((code) => ({
        text: `${languageName(code)}${languageChoice === code ? ' ✓' : ''}`,
        onPress: () => setLanguage(code),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  function pickAppearance() {
    Alert.alert(t('settings.appearance'), undefined, [
      ...APPEARANCES.map((a) => ({
        text: `${t(`settings.theme.${a}`)}${appearance === a ? ' ✓' : ''}`,
        onPress: () => setAppearance(a),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  async function testCoach() {
    setTesting(true);
    setAiStatus(null);
    try {
      await aiChat([{ role: 'user', content: 'Reply with one short sentence of training motivation.' }], { maxTokens: 60 });
      setAiStatus(t('settings.coachConnected'));
    } catch (e) {
      setAiStatus(aiErrorMessage(e));
    } finally {
      setTesting(false);
    }
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const initial = profile?.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.push('/onboarding')} style={({ pressed }) => [styles.profile, pressed && { opacity: 0.85 }]}>
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.profileName}>{profile ? profile.name || t('settings.yourProfile') : t('settings.setUpProfile')}</Text>
          <Text style={styles.profileSub} numberOfLines={2}>
            {profile
              ? t('settings.profileLine', {
                  goal: t(`goals.${profile.goal}.title`),
                  days: profile.daysPerWeek,
                  minutes: profile.sessionMinutes,
                })
              : t('settings.profileEmpty')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
      </Pressable>

      <Section title={t('settings.general')}>
        <Row icon="language" title={t('settings.language')} value={languageName(languageChoice)} onPress={pickLanguage} />
        <Row
          icon="contrast"
          title={t('settings.appearance')}
          value={t(`settings.theme.${appearance}`)}
          onPress={pickAppearance}
        />
      </Section>

      <Section title={t('profile.training')}>
        <Row icon="barbell" title={t('settings.program')} onPress={() => router.push('/program')} />
        <Row icon="scale" title={t('screens.bodyWeight')} onPress={() => router.push('/weight')} />
        <Stepper
          icon="calendar"
          title={t('settings.weeklyGoal')}
          subtitle={t('settings.weeklyGoalSub')}
          value={`${goal}`}
          onMinus={() => changeGoal(-1)}
          onPlus={() => changeGoal(1)}
        />
        <Stepper
          icon="timer"
          title={t('settings.defaultRest')}
          subtitle={t('settings.defaultRestSub')}
          value={formatDuration(rest)}
          onMinus={() => changeRest(-REST_STEP)}
          onPlus={() => changeRest(REST_STEP)}
        />
        <Row
          icon="phone-portrait"
          title={t('settings.keepAwake')}
          subtitle={t('settings.keepAwakeSub')}
          right={
            <Switch value={awake} onValueChange={toggleAwake} trackColor={{ true: c.accent, false: c.surfaceRaised }} thumbColor="#FFFFFF" />
          }
        />
      </Section>

      <Section title={t('settings.notifications')}>
        <Row
          icon="notifications"
          title={t('reminders.title')}
          value={remindersOn ? t('settings.remindersOn', { count: remindersOn }) : t('common.off')}
          onPress={() => router.push('/settings/reminders')}
        />
      </Section>

      <Section title={t('settings.connections')}>
        <MusicRow />
        <Row
          icon="sparkles"
          title={t('settings.aiCoach')}
          subtitle={aiStatus ?? (aiConfigured ? t('settings.coachOn') : t('settings.coachOff'))}
          right={
            testing ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Pressable onPress={testCoach} hitSlop={8} disabled={!aiConfigured}>
                <Text style={[styles.action, !aiConfigured && { opacity: 0.4 }]}>{t('settings.test')}</Text>
              </Pressable>
            )
          }
        />
      </Section>

      <Section title={t('settings.data')} footer={t('settings.dataFooter')}>
        <Row
          icon="cloud-upload"
          title={t('settings.dataTitle')}
          subtitle={t('settings.dataSub')}
          onPress={() => router.push('/settings/data')}
        />
      </Section>

      <Section title={t('settings.about')} footer={t('settings.credits')}>
        <Row icon="information-circle" title="Spotter" value={t('settings.version', { version })} />
      </Section>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 60 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.onHero, fontSize: 24, fontWeight: '800' },
  profileName: { color: c.text, fontSize: 19, fontWeight: '800' },
  profileSub: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  action: { color: c.accent, fontSize: 15, fontWeight: '700' },
}));
