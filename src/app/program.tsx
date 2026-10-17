import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { ExerciseThumb } from '@/components/exercise-preview';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { deleteProgram, getCandidates, getProgram, saveProgram, type Program } from '@/db/program';
import { getProfile } from '@/db/profile';
import { useStartRoutine } from '@/hooks/use-start-routine';
import { candidateNames, estimateMinutes, filterCandidates, programWeek, type Candidate, type ProgramDraft } from '@/lib/program';
import type { Profile } from '@/lib/profile';
import { relativeDay } from '@/lib/stats';
import { formatDuration } from '@/lib/workout-math';
import { aiErrorMessage } from '@/services/ai';
import { generateProgram } from '@/services/program';

type ExerciseInfo = Candidate & { gif: string | null };

/** The training program: build it with AI, preview it, then follow it day by day. */
export default function ProgramScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const start = useStartRoutine();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Map<number, ExerciseInfo>>(new Map());
  const [building, setBuilding] = useState(false);
  const [now, setNow] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setProfile(await getProfile(db));
        setProgram(await getProgram(db));
        setNow(Date.now());
        setLoaded(true);
      })();
    }, [db])
  );

  async function build() {
    if (!profile || building) return;
    setBuilding(true);
    setFallback(null);
    const all = await getCandidates(db, candidateNames(profile.equipment));
    const candidates = filterCandidates(all, profile);
    setExercises(new Map(all.map((e) => [e.id, e])));
    const result = await generateProgram(profile, candidates, new Date());
    setDraft(result.draft);
    if (result.fallbackReason !== null) {
      setFallback(
        result.fallbackReason === 'invalid'
          ? t('programScreen.invalid')
          : `${aiErrorMessage(result.fallbackReason)} ${t('programScreen.templateInstead')}`
      );
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBuilding(false);
  }

  async function save() {
    if (!draft) return;
    await saveProgram(db, draft);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraft(null);
    setProgram(await getProgram(db));
  }

  function confirmSave() {
    if (!program) return save();
    Alert.alert(t('programScreen.replaceTitle'), t('programScreen.replaceBody', { name: program.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('programScreen.replace'), style: 'destructive', onPress: save },
    ]);
  }

  function onDelete() {
    Alert.alert(t('programScreen.deleteTitle'), t('programScreen.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteProgram(db);
          setProgram(null);
        },
      },
    ]);
  }

  if (!loaded) return <View style={styles.screen} />;

  if (!profile) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="flag-outline" size={40} color={c.accent} />
        <Text style={styles.title}>{t('programScreen.goalFirst')}</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {t('programScreen.goalFirstBody')}
        </Text>
        <Button label={t('plan.setTitle')} onPress={() => router.push('/onboarding')} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {building ? (
        <Card style={styles.building}>
          <ActivityIndicator color={c.accent} size="large" />
          <Text style={styles.cardTitle}>{t('programScreen.designing')}</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {t('programScreen.choosing', { days: profile.daysPerWeek, minutes: profile.sessionMinutes })}
          </Text>
        </Card>
      ) : draft ? (
        <DraftView
          draft={draft}
          exercises={exercises}
          fallback={fallback}
          onSave={confirmSave}
          onRetry={build}
          onCancel={() => setDraft(null)}
        />
      ) : program ? (
        <ProgramView program={program} now={now} onStart={start} onRebuild={build} onDelete={onDelete} />
      ) : (
        <Intro profile={profile} onBuild={build} />
      )}
    </ScrollView>
  );
}

function Intro({ profile, onBuild }: { profile: Profile; onBuild: () => void }) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const chips = [
    t(`goals.${profile.goal}.title`),
    t('programScreen.daysPerWeek', { count: profile.daysPerWeek }),
    t('common.minutes', { count: profile.sessionMinutes }),
    t(`equipments.${profile.equipment}.title`),
    ...profile.limitations.map((l) => t('programScreen.careful', { part: t(`limitations.${l}`) })),
  ];
  return (
    <>
      <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="sparkles" size={30} color={c.accentText} />
        <Text style={styles.heroTitle}>{t('programScreen.heroTitle')}</Text>
        <Text style={styles.heroBody}>
          {t('programScreen.heroBody')}
        </Text>
      </LinearGradient>
      <Text style={styles.label}>{t('programScreen.fromProfile')}</Text>
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText}>{c}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
        <Text style={styles.link}>{t('programScreen.changeGoal')}</Text>
      </Pressable>
      <Button label={t('programScreen.build')} onPress={onBuild} />
    </>
  );
}

function DraftView({
  draft,
  exercises,
  fallback,
  onSave,
  onRetry,
  onCancel,
}: {
  draft: ProgramDraft;
  exercises: Map<number, ExerciseInfo>;
  fallback: string | null;
  onSave: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  return (
    <>
      <View style={{ gap: Spacing.xs }}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name={draft.source === 'ai' ? 'sparkles' : 'library'} size={12} color={c.accent} />
            <Text style={styles.badgeText}>{draft.source === 'ai' ? t('programScreen.byAi') : t('programScreen.template')}</Text>
          </View>
          <Text style={styles.muted}>
            {t('programScreen.daysPerWeek', { count: draft.days.length })} · {t('programScreen.weeks', { count: draft.weeks })}
          </Text>
        </View>
        <Text style={styles.title}>{draft.name}</Text>
        {draft.summary ? <Text style={styles.body}>{draft.summary}</Text> : null}
      </View>
      {fallback && (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={c.warning} />
          <Text style={[styles.muted, { flex: 1 }]}>{fallback}</Text>
        </View>
      )}

      {draft.days.map((day, i) => (
        <Animated.View key={day.name + i} entering={FadeInDown.delay(i * 60)}>
          <Card style={styles.day}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{day.name}</Text>
                <Text style={styles.muted}>{day.focus}</Text>
              </View>
              <Text style={styles.minutes}>~{estimateMinutes(day.exercises)} min</Text>
            </View>
            {day.exercises.map((ex) => {
              const info = exercises.get(ex.exerciseId);
              return (
                <View key={ex.exerciseId} style={styles.exercise}>
                  <ExerciseThumb gif={info?.gif ?? null} name={info?.name ?? ''} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{info?.name}</Text>
                    <Text style={styles.muted}>
                      {ex.sets} × {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`} · {t('programScreen.rest', { time: formatDuration(ex.restSeconds) })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </Animated.View>
      ))}

      <Button label={t('programScreen.save')} onPress={onSave} />
      <Button label={t('programScreen.another')} variant="secondary" onPress={onRetry} />
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </>
  );
}

function ProgramView({
  program,
  now,
  onStart,
  onRebuild,
  onDelete,
}: {
  program: Program;
  now: number;
  onStart: (routineId: number) => void;
  onRebuild: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const week = programWeek(program.started_at, program.weeks, now);
  const finished = now - program.started_at > program.weeks * 7 * 86_400_000;
  return (
    <>
      <View style={{ gap: Spacing.xs }}>
        <Text style={styles.label}>{t('programScreen.week', { week, weeks: program.weeks })}</Text>
        <Text style={styles.title}>{program.name}</Text>
        {program.summary ? <Text style={styles.body}>{program.summary}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(week / program.weeks) * 100}%` }]} />
        </View>
      </View>
      {finished && (
        <View style={styles.notice}>
          <Ionicons name="trophy" size={18} color={c.accent} />
          <Text style={[styles.muted, { flex: 1 }]}>
            {t('programScreen.finished')}
          </Text>
        </View>
      )}

      {program.days.map((day, i) => {
        const next = i === program.next;
        return (
          <Pressable
            key={day.routine_id}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(day.routine_id) } })}
            style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <Card style={[styles.day, next && styles.nextDay]}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  {next && <Text style={styles.nextLabel}>{t('programScreen.nextUp')}</Text>}
                  <Text style={styles.cardTitle}>{day.name}</Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {t('program.dayLine', { count: day.exercise_count, minutes: day.minutes, exercises: day.exercises ?? '' })}
                  </Text>
                  <Text style={styles.small}>
                    {day.last_done ? t(`time.lastDone.${relativeDay(day.last_done, now).key}`, { count: relativeDay(day.last_done, now).count }) : t('programScreen.notDone')} ·{' '}
                    {t('programScreen.tapToEdit')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onStart(day.routine_id)}
                  hitSlop={8}
                  style={[styles.play, !next && styles.playQuiet]}
                  accessibilityLabel={t('common.startNamed', { name: day.name })}>
                  <Ionicons name="play" size={20} color={next ? c.accentText : c.accent} />
                </Pressable>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Text style={styles.small}>
        {t('programScreen.progressionNote')}
      </Text>
      <Button label={t('programScreen.rebuild')} variant="secondary" onPress={onRebuild} />
      <Button label={t('programScreen.delete')} variant="danger" onPress={onDelete} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  heroTitle: { color: c.accentText, fontSize: 26, fontWeight: '800' },
  heroBody: { color: c.accentText, fontSize: 15, lineHeight: 21, opacity: 0.85 },
  label: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: c.surface, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipText: { color: c.text, fontSize: 14, fontWeight: '600' },
  link: { color: c.accent, fontSize: 14, fontWeight: '600' },
  title: { color: c.text, fontSize: 26, fontWeight: '800' },
  body: { color: c.text, fontSize: 15, lineHeight: 21, opacity: 0.85 },
  muted: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  small: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  building: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  day: { gap: Spacing.md },
  nextDay: { borderWidth: 1, borderColor: c.accent },
  nextLabel: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  minutes: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  exerciseName: { color: c.text, fontSize: 15, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, marginTop: Spacing.sm, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playQuiet: { backgroundColor: c.surfaceRaised },
}));
