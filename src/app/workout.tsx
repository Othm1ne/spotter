import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseThumb } from '@/components/exercise-preview';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_REST_SECONDS } from '@/db/routines';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getPreviousSets,
  getWorkoutSets,
  removeExercise,
  renameWorkout,
  updateSet,
  type PreviousSet,
  type Workout,
  type WorkoutSet,
} from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { formatDuration, formatWeight, parseNumber } from '@/lib/workout-math';
import * as restTimer from '@/services/rest-notification';


type Draft = { weight: string; reps: string };
type Block = { position: number; exerciseId: number; name: string; muscle: string; gif: string | null; sets: WorkoutSet[] };

function secondsFromNow(seconds: number) {
  return Date.now() + seconds * 1000;
}

function toText(n: number | null) {
  return n === null ? '' : String(n);
}

export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [name, setName] = useState('');
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [previous, setPrevious] = useState<Map<number, PreviousSet[]>>(new Map());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(restTimer.getRestEndsAt);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const now = useNow();

  const load = useCallback(async () => {
    const active = await getActiveWorkout(db);
    if (!active) {
      router.back();
      return;
    }
    const rows = await getWorkoutSets(db, active.id);
    setWorkout(active);
    setName((current) => current || active.name);
    setSets(rows);
    setDrafts((current) => {
      const next: Record<number, Draft> = {};
      for (const s of rows) next[s.id] = current[s.id] ?? { weight: toText(s.weight), reps: toText(s.reps) };
      return next;
    });
    setPrevious(await getPreviousSets(db, [...new Set(rows.map((s) => s.exercise_id))]));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Rest timer reaching zero while the screen is open.
  useEffect(() => {
    if (restEndsAt === null) return;
    const id = setTimeout(() => {
      setRestEndsAt(null);
      restTimer.clearRest();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, Math.max(0, restEndsAt - Date.now()));
    return () => clearTimeout(id);
  }, [restEndsAt]);

  const blocks = useMemo(() => {
    const map = new Map<number, Block>();
    for (const s of sets) {
      const block = map.get(s.exercise_position) ?? {
        position: s.exercise_position,
        exerciseId: s.exercise_id,
        name: s.exercise_name,
        muscle: s.muscle,
        gif: s.gif,
        sets: [],
      };
      block.sets.push(s);
      map.set(s.exercise_position, block);
    }
    return [...map.values()];
  }, [sets]);

  function toggleEditing(position: number) {
    setEditing((current) => {
      const next = new Set(current);
      if (!next.delete(position)) next.add(position);
      return next;
    });
  }

  /** "60 kg × 10" for the next set to do, or the last set once all are done. */
  function summarize(block: Block, prevSets: PreviousSet[]) {
    const next = block.sets.findIndex((s) => s.done !== 1);
    const i = next === -1 ? block.sets.length - 1 : next;
    const set = block.sets[i];
    if (!set) return 'Add a set';
    const draft = drafts[set.id];
    const weight = parseNumber(draft?.weight ?? '') ?? prevSets[i]?.weight ?? null;
    const reps = parseNumber(draft?.reps ?? '') ?? prevSets[i]?.reps ?? null;
    if (weight === null && reps === null) return 'Set kg × reps';
    if (weight === null) return `${reps} reps`;
    return `${formatWeight(weight)} kg × ${reps ?? '–'}`;
  }

  function startRest(endsAt: number) {
    setRestEndsAt(endsAt);
    restTimer.startRest(endsAt);
  }

  async function stopRest() {
    setRestEndsAt(null);
    await restTimer.stopRest();
  }

  function adjustRest(delta: number) {
    if (restEndsAt === null) return;
    const endsAt = Math.max(Date.now() + 1000, restEndsAt + delta * 1000);
    setRestSeconds((s) => Math.max(15, s + delta));
    startRest(endsAt);
  }

  function saveSet(set: WorkoutSet, draft: Draft, done: boolean) {
    const weight = parseNumber(draft.weight);
    const reps = parseNumber(draft.reps);
    setSets((all) => all.map((s) => (s.id === set.id ? { ...s, weight, reps, done: done ? 1 : 0 } : s)));
    updateSet(db, set.id, { weight, reps, done });
  }

  function onChangeField(set: WorkoutSet, field: keyof Draft, text: string) {
    const draft = { ...drafts[set.id], [field]: text };
    setDrafts((d) => ({ ...d, [set.id]: draft }));
    saveSet(set, draft, set.done === 1);
  }

  function fillFromPrevious(set: WorkoutSet, prev: PreviousSet | undefined) {
    if (!prev) return;
    const draft = { weight: toText(prev.weight), reps: toText(prev.reps) };
    setDrafts((d) => ({ ...d, [set.id]: draft }));
    saveSet(set, draft, set.done === 1);
  }

  function toggleDone(set: WorkoutSet, prev: PreviousSet | undefined) {
    const done = set.done !== 1;
    let draft = drafts[set.id];
    if (done && prev && draft.weight === '' && draft.reps === '') {
      draft = { weight: toText(prev.weight), reps: toText(prev.reps) };
      setDrafts((d) => ({ ...d, [set.id]: draft }));
    }
    saveSet(set, draft, done);
    if (done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Sets from a workout plan carry their own rest time; 0 means no timer.
      const rest = set.rest_seconds ?? restSeconds;
      if (rest > 0) startRest(secondsFromNow(rest));
    }
  }

  function onSetLongPress(set: WorkoutSet) {
    Alert.alert('Delete set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(db, set.id);
          load();
        },
      },
    ]);
  }

  function onBlockMenu(block: Block) {
    Alert.alert(block.name, undefined, [
      {
        text: 'Remove exercise',
        style: 'destructive',
        onPress: async () => {
          await removeExercise(db, workout!.id, block.position);
          load();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function onAddSet(block: Block) {
    await addSet(db, workout!.id, block.exerciseId, block.position);
    load();
  }

  function onFinish() {
    if (!workout) return;
    const undone = sets.filter((s) => s.done !== 1).length;
    if (sets.length === undone) {
      Alert.alert('Nothing logged yet', 'Tick at least one set before finishing, or discard the workout.');
      return;
    }
    Alert.alert(
      'Finish workout?',
      undone > 0 ? `${undone} unticked set${undone > 1 ? 's' : ''} will be removed.` : undefined,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            await stopRest();
            await finishWorkout(db, workout.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace({ pathname: '/history/[id]', params: { id: String(workout.id) } });
          },
        },
      ]
    );
  }

  function onDiscard() {
    if (!workout) return;
    Alert.alert('Discard workout?', 'Everything logged in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await stopRest();
          await deleteWorkout(db, workout.id);
          router.back();
        },
      },
    ]);
  }

  if (!workout) return <View style={styles.screen} />;

  const startedAt = workout.started_at;

  const restLeft = restEndsAt === null ? 0 : Math.max(0, (restEndsAt - now) / 1000);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {/* Native header: always laid out below the status bar, so the buttons stay tappable.
          Buttons are plain text because iOS already draws a button background around header items. */}
      <Stack.Screen
        options={{
          headerTitle: () => <Elapsed startedAt={startedAt} />,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
              <Text style={styles.minimize}>Hide</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={onFinish} hitSlop={8} style={styles.headerButton}>
              <Text style={styles.finishLabel}>Finish</Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => name.trim() && renameWorkout(db, workout.id, name.trim())}
            style={styles.name}
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="done"
          />

          {blocks.map((block) => {
            const prevSets = previous.get(block.exerciseId) ?? [];
            return (
              <View key={block.position} style={styles.block}>
                <View style={styles.blockHeader}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(block.exerciseId) } })}
                    style={styles.blockTitle}>
                    <ExerciseThumb gif={block.gif} name={block.name} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{block.name}</Text>
                      <Text style={styles.muscle}>
                        {block.muscle}
                        {block.sets[0]?.rest_seconds ? ` · Rest ${formatDuration(block.sets[0].rest_seconds)}` : ''} · How to ›
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => onBlockMenu(block)} hitSlop={12}>
                    <Text style={styles.menu}>•••</Text>
                  </Pressable>
                </View>

                <Pressable onPress={() => toggleEditing(block.position)} hitSlop={6} style={styles.summary}>
                  <Text style={styles.summaryText}>{summarize(block, prevSets)}</Text>
                  <Ionicons
                    name={editing.has(block.position) ? 'chevron-up' : 'chevron-forward'}
                    size={16}
                    color={Colors.text}
                  />
                </Pressable>

                {/* One circle per set: tap to complete it, hold to delete it. */}
                <View style={styles.circles}>
                  {block.sets.map((set, i) => {
                    const prev = prevSets[i];
                    const done = set.done === 1;
                    const reps = drafts[set.id]?.reps || (prev?.reps != null ? String(prev.reps) : '');
                    return (
                      <Pressable
                        key={set.id}
                        onPress={() => toggleDone(set, prev)}
                        onLongPress={() => onSetLongPress(set)}
                        accessibilityLabel={`Set ${i + 1}${done ? ', done' : ''}`}
                        style={({ pressed }) => [styles.circle, done && styles.circleDone, pressed && { opacity: 0.7 }]}>
                        <Text style={[styles.circleText, done && styles.circleTextDone]}>{reps || '–'}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => onAddSet(block)}
                    accessibilityLabel="Add set"
                    style={({ pressed }) => [styles.circle, styles.circleAdd, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="add" size={24} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                {editing.has(block.position) && (
                  <View style={styles.editor}>
                    <View style={styles.row}>
                      <Text style={[styles.colSet, styles.colHead]}>SET</Text>
                      <Text style={[styles.colPrev, styles.colHead]}>LAST TIME</Text>
                      <Text style={[styles.colInput, styles.colHead]}>KG</Text>
                      <Text style={[styles.colInput, styles.colHead]}>REPS</Text>
                    </View>
                    {block.sets.map((set, i) => {
                      const prev = prevSets[i];
                      const draft = drafts[set.id] ?? { weight: '', reps: '' };
                      return (
                        <View key={set.id} style={styles.row}>
                          <Text style={[styles.colSet, styles.setNumber]}>{i + 1}</Text>
                          <Pressable onPress={() => fillFromPrevious(set, prev)} style={styles.colPrev}>
                            <Text style={styles.prevText}>
                              {prev ? `${formatWeight(prev.weight)} × ${prev.reps ?? '-'}` : '—'}
                            </Text>
                          </Pressable>
                          <TextInput
                            style={[styles.colInput, styles.input]}
                            value={draft.weight}
                            onChangeText={(t) => onChangeField(set, 'weight', t)}
                            keyboardType="decimal-pad"
                            placeholder={prev ? formatWeight(prev.weight) : ''}
                            placeholderTextColor={Colors.textSecondary}
                            selectTextOnFocus
                          />
                          <TextInput
                            style={[styles.colInput, styles.input]}
                            value={draft.reps}
                            onChangeText={(t) => onChangeField(set, 'reps', t)}
                            keyboardType="number-pad"
                            placeholder={prev?.reps != null ? String(prev.reps) : ''}
                            placeholderTextColor={Colors.textSecondary}
                            selectTextOnFocus
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          <Button
            label="+ Add exercise"
            onPress={() => router.push({ pathname: '/add-exercise', params: { workoutId: String(workout.id) } })}
          />
          <Button label="Discard workout" variant="danger" onPress={onDiscard} />
        </ScrollView>
      </KeyboardAvoidingView>

      {restEndsAt !== null && (
        <View style={styles.rest}>
          <Pressable onPress={() => adjustRest(-15)} style={styles.restButton}>
            <Text style={styles.restButtonLabel}>-15</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={styles.restTime}>{formatDuration(restLeft)}</Text>
          </View>
          <Pressable onPress={() => adjustRest(15)} style={styles.restButton}>
            <Text style={styles.restButtonLabel}>+15</Text>
          </Pressable>
          <Pressable onPress={stopRest} style={[styles.restButton, styles.skip]}>
            <Text style={[styles.restButtonLabel, { color: Colors.accentText }]}>Skip</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return <Text style={styles.elapsed}>{formatDuration((now - startedAt) / 1000)}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  minimize: { color: Colors.accent, fontSize: 17, fontWeight: '600' },
  elapsed: { color: Colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  finishLabel: { color: Colors.accent, fontWeight: '800', fontSize: 17 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 140 },
  name: { color: Colors.text, fontSize: 26, fontWeight: '800', padding: 0 },
  block: { gap: Spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center' },
  blockTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  exerciseName: { color: Colors.accent, fontSize: 18, fontWeight: '700' },
  muscle: { color: Colors.textSecondary, fontSize: 13 },
  menu: { color: Colors.textSecondary, fontSize: 18, fontWeight: '800', paddingHorizontal: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colHead: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 32, alignItems: 'center' },
  colPrev: { flex: 1, alignItems: 'center' },
  colInput: { width: 64 },
  setNumber: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  prevText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    borderRadius: Radius.sm,
    height: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: -Spacing.xs },
  summaryText: { color: Colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(198, 244, 50, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: Colors.accent },
  circleAdd: { borderColor: 'transparent', backgroundColor: Colors.surfaceRaised },
  circleText: { color: Colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  circleTextDone: { color: Colors.accentText },
  editor: { gap: Spacing.sm, marginTop: Spacing.xs },
  rest: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  restLabel: { color: Colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  restTime: { color: Colors.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restButton: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  restButtonLabel: { color: Colors.text, fontWeight: '700' },
  skip: { backgroundColor: Colors.accent },
});
