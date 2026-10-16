import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ExerciseThumb } from '@/components/exercise-preview';
import { Button, Card } from '@/components/ui';
import { Colors, HeroGradient, Radius, Spacing } from '@/constants/theme';
import { deleteProgram, getCandidates, getProgram, saveProgram, type Program } from '@/db/program';
import { getProfile } from '@/db/profile';
import { useStartRoutine } from '@/hooks/use-start-routine';
import { candidateNames, estimateMinutes, filterCandidates, programWeek, type Candidate, type ProgramDraft } from '@/lib/program';
import { EQUIPMENTS, goalTitle, type Profile } from '@/lib/profile';
import { formatDuration } from '@/lib/workout-math';
import { aiErrorMessage } from '@/services/ai';
import { generateProgram } from '@/services/program';

type ExerciseInfo = Candidate & { gif: string | null };

/** The training program: build it with AI, preview it, then follow it day by day. */
export default function ProgramScreen() {
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
          ? "The AI's plan didn't check out, so this one was built from a proven template. You can try again."
          : `${aiErrorMessage(result.fallbackReason)} This program was built from a proven template instead.`
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
    Alert.alert('Replace your program?', `"${program.name}" and its workout plans will be replaced. Your workout history stays.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: save },
    ]);
  }

  function onDelete() {
    Alert.alert('Delete your program?', 'Its workout plans are removed. Your workout history stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
        <Ionicons name="flag-outline" size={40} color={Colors.accent} />
        <Text style={styles.title}>Set your goal first</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          Your program is built from your goal, schedule and equipment. It takes 2 minutes.
        </Text>
        <Button label="Set your goal" onPress={() => router.push('/onboarding')} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {building ? (
        <Card style={styles.building}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.cardTitle}>Designing your program…</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Choosing exercises for {profile.daysPerWeek} days a week, {profile.sessionMinutes} minutes each.
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
  const chips = [
    goalTitle(profile.goal),
    `${profile.daysPerWeek} days / week`,
    `${profile.sessionMinutes} min`,
    EQUIPMENTS.find((e) => e.value === profile.equipment)?.title ?? '',
    ...profile.limitations.map((l) => `Careful: ${l}`),
  ];
  return (
    <>
      <LinearGradient colors={HeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="sparkles" size={30} color={Colors.accentText} />
        <Text style={styles.heroTitle}>Your training program</Text>
        <Text style={styles.heroBody}>
          The AI coach picks exercises, sets, reps and rest for your goal. Each workout then suggests the weight to lift,
          based on how your last sessions went.
        </Text>
      </LinearGradient>
      <Text style={styles.label}>BUILT FROM YOUR PROFILE</Text>
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText}>{c}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
        <Text style={styles.link}>Change your goal or schedule ›</Text>
      </Pressable>
      <Button label="Build my program" onPress={onBuild} />
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
  return (
    <>
      <View style={{ gap: Spacing.xs }}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name={draft.source === 'ai' ? 'sparkles' : 'library'} size={12} color={Colors.accent} />
            <Text style={styles.badgeText}>{draft.source === 'ai' ? 'Built by AI' : 'Template'}</Text>
          </View>
          <Text style={styles.muted}>
            {draft.days.length} days / week · {draft.weeks} weeks
          </Text>
        </View>
        <Text style={styles.title}>{draft.name}</Text>
        {draft.summary ? <Text style={styles.body}>{draft.summary}</Text> : null}
      </View>
      {fallback && (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={Colors.warning} />
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
                      {ex.sets} × {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`} · rest {formatDuration(ex.restSeconds)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </Animated.View>
      ))}

      <Button label="Save program" onPress={onSave} />
      <Button label="Build another one" variant="secondary" onPress={onRetry} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
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
  const week = programWeek(program.started_at, program.weeks, now);
  const finished = now - program.started_at > program.weeks * 7 * 86_400_000;
  return (
    <>
      <View style={{ gap: Spacing.xs }}>
        <Text style={styles.label}>
          WEEK {week} OF {program.weeks}
        </Text>
        <Text style={styles.title}>{program.name}</Text>
        {program.summary ? <Text style={styles.body}>{program.summary}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(week / program.weeks) * 100}%` }]} />
        </View>
      </View>
      {finished && (
        <View style={styles.notice}>
          <Ionicons name="trophy" size={18} color={Colors.accent} />
          <Text style={[styles.muted, { flex: 1 }]}>
            You finished this program. Build a new one to keep progressing with fresh exercises.
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
                  {next && <Text style={styles.nextLabel}>NEXT UP</Text>}
                  <Text style={styles.cardTitle}>{day.name}</Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {day.exercise_count} exercises · ~{day.minutes} min · {day.exercises}
                  </Text>
                  <Text style={styles.small}>{day.last_done ? `Last done ${ago(day.last_done, now)}` : 'Not done yet'} · tap to edit</Text>
                </View>
                <Pressable
                  onPress={() => onStart(day.routine_id)}
                  hitSlop={8}
                  style={[styles.play, !next && styles.playQuiet]}
                  accessibilityLabel={`Start ${day.name}`}>
                  <Ionicons name="play" size={20} color={next ? Colors.accentText : Colors.accent} />
                </Pressable>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Text style={styles.small}>
        Weights are suggested each workout: hit the top of the rep range on every set and the next session adds weight.
      </Text>
      <Button label="Build a new program" variant="secondary" onPress={onRebuild} />
      <Button label="Delete program" variant="danger" onPress={onDelete} />
    </>
  );
}

function ago(time: number, now: number): string {
  const days = Math.floor((now - time) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  heroTitle: { color: Colors.accentText, fontSize: 26, fontWeight: '800' },
  heroBody: { color: Colors.accentText, fontSize: 15, lineHeight: 21, opacity: 0.85 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  body: { color: Colors.text, fontSize: 15, lineHeight: 21, opacity: 0.85 },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  small: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  building: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  day: { gap: Spacing.md },
  nextDay: { borderWidth: 1, borderColor: Colors.accent },
  nextLabel: { color: Colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  minutes: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  exerciseName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceRaised, marginTop: Spacing.sm, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playQuiet: { backgroundColor: Colors.surfaceRaised },
});
