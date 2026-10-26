import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n, useT, type Params } from '@/i18n';
import { ExerciseThumb } from '@/components/exercise-preview';
import { MusicCard } from '@/components/music-card';
import { Segmented } from '@/components/segmented';
import { WorkoutFocus, type Draft, type WorkoutBlock } from '@/components/workout-focus';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { DEFAULT_REST_SECONDS, getDefaultRest, getKeepAwake, getSetting, setSetting } from '@/db/settings';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getLastSetTime,
  getPreviousSets,
  getWorkoutSets,
  moveExercise,
  removeExercise,
  renameWorkout,
  updateSet,
  type PreviousSet,
  type Workout,
  type WorkoutSet,
} from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { formatDuration, formatElapsed, formatWeight, isStaleWorkout, parseNumber } from '@/lib/workout-math';
import * as restTimer from '@/services/rest-notification';

type Block = WorkoutBlock;
type ViewMode = 'focus' | 'list';

const KEEP_AWAKE_TAG = 'workout';

function secondsFromNow(seconds: number) {
  return Date.now() + seconds * 1000;
}

function toText(n: number | null) {
  return n === null ? '' : String(n);
}

export default function WorkoutScreen() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [name, setName] = useState('');
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [previous, setPrevious] = useState<Map<number, PreviousSet[]>>(new Map());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(restTimer.getRestEndsAt);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [view, setView] = useState<ViewMode>('focus');
  // Exercise shown in focus mode; null until the user moves, then the first one with sets left.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
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

  // Settings: the default rest time, and keeping the screen on so the timer stays visible.
  useEffect(() => {
    let awake = false;
    (async () => {
      setRestSeconds(await getDefaultRest(db));
      const savedView = await getSetting(db, 'workout_view');
      if (savedView === 'list' || savedView === 'focus') setView(savedView);
      if (await getKeepAwake(db)) {
        awake = true;
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      }
    })();
    return () => {
      if (awake) deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [db]);

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
        hint: s.hint,
        gif: s.gif,
        sets: [],
      };
      block.sets.push(s);
      map.set(s.exercise_position, block);
    }
    return [...map.values()];
  }, [sets]);

  const openIndex = blocks.findIndex((b) => b.sets.some((s) => s.done !== 1));
  const currentIndex = Math.min(focusIndex ?? Math.max(0, openIndex), Math.max(0, blocks.length - 1));

  function changeView(next: ViewMode) {
    setView(next);
    setSetting(db, 'workout_view', next);
  }

  /** Last time's numbers for a set, matched by its place in the exercise. */
  function previousFor(set: WorkoutSet) {
    const block = blocks.find((b) => b.position === set.exercise_position);
    const i = block ? block.sets.findIndex((s) => s.id === set.id) : -1;
    return previous.get(set.exercise_id)?.[i];
  }

  function setValues(set: WorkoutSet, draft: Draft) {
    setDrafts((d) => ({ ...d, [set.id]: draft }));
    saveSet(set, draft, set.done === 1);
  }

  async function onMove(block: Block, direction: -1 | 1) {
    if (!workout) return;
    await moveExercise(db, workout.id, block.position, direction);
    // Keep the moved exercise on screen in focus mode.
    const i = blocks.findIndex((b) => b.position === block.position);
    if (i !== -1) setFocusIndex(i + direction);
    load();
  }

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
    if (!set) return t('workout.addASet');
    const draft = drafts[set.id];
    const weight = parseNumber(draft?.weight ?? '') ?? prevSets[i]?.weight ?? null;
    const reps = parseNumber(draft?.reps ?? '') ?? prevSets[i]?.reps ?? null;
    if (weight === null && reps === null) return t('workout.setKgReps');
    if (weight === null) return t('workout.reps', { count: reps ?? 0 });
    return `${formatWeight(weight)} kg × ${reps ?? '–'}`;
  }

  /** Progression hints are saved as `{ key, params }` JSON (see lib/program) and translated here. */
  function hintText(hint: string) {
    try {
      const { key, params } = JSON.parse(hint) as { key: string; params: Params };
      return t(`progress.${key}`, params);
    } catch {
      return hint;
    }
  }

  function startRest(endsAt: number, next?: string | null) {
    setRestEndsAt(endsAt);
    restTimer.startRest(endsAt, next);
  }

  /** The first set still to do after `after`, for the lock screen: "Bench Press · set 3 · 60 kg × 8". */
  function nextSetLabel(after: WorkoutSet): string | null {
    const i = sets.findIndex((s) => s.id === after.id);
    const next = sets.slice(i + 1).find((s) => s.done !== 1) ?? sets.slice(0, i).find((s) => s.done !== 1);
    if (!next) return null;
    const weight = parseNumber(drafts[next.id]?.weight ?? '');
    const reps = parseNumber(drafts[next.id]?.reps ?? '');
    const target =
      weight !== null ? ` · ${formatWeight(weight)} kg × ${reps ?? '–'}` : reps !== null ? ` · ${t('workout.reps', { count: reps })}` : '';
    return `${next.exercise_name} · ${t('workout.setNumber', { n: next.set_index + 1 })}${target}`;
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
      if (rest > 0) startRest(secondsFromNow(rest), nextSetLabel(set));
    }
  }

  function onSetLongPress(set: WorkoutSet) {
    Alert.alert(t('workout.deleteSet'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteSet(db, set.id);
          load();
        },
      },
    ]);
  }

  function onBlockMenu(block: Block) {
    const i = blocks.findIndex((b) => b.position === block.position);
    Alert.alert(block.name, undefined, [
      ...(i > 0 ? [{ text: t('common.moveUp'), onPress: () => onMove(block, -1) }] : []),
      ...(i < blocks.length - 1 ? [{ text: t('common.moveDown'), onPress: () => onMove(block, 1) }] : []),
      {
        text: t('workout.removeExercise'),
        style: 'destructive',
        onPress: async () => {
          if (!workout) return;
          await removeExercise(db, workout.id, block.position);
          load();
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  async function onAddSet(block: Block) {
    if (!workout) return;
    await addSet(db, workout.id, block.exerciseId, block.position);
    load();
  }

  async function finish(finishedAt: number) {
    if (!workout) return;
    await stopRest();
    await finishWorkout(db, workout.id, finishedAt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/history/[id]', params: { id: String(workout.id) } });
  }

  async function onFinish() {
    if (!workout) return;
    const undone = sets.filter((s) => s.done !== 1).length;
    if (sets.length === undone) {
      Alert.alert(t('workout.nothingTitle'), t('workout.nothingBody'));
      return;
    }
    const removal = undone > 0 ? t('workout.unticked', { count: undone }) : undefined;
    const finishedAt = Date.now();

    // Forgotten workout: offer to end it when the last set was ticked instead of now.
    if (isStaleWorkout(workout.started_at, finishedAt)) {
      const lastSet = await getLastSetTime(db, workout.id);
      const fallback = workout.started_at + 60 * 60 * 1000;
      const endAt = lastSet ?? fallback;
      const time = new Date(endAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      Alert.alert(
        t('workout.forgotTitle'),
        t('workout.forgotBody', { time: formatElapsed(finishedAt - workout.started_at) }) + (removal ? ` ${removal}` : ''),
        [
          { text: lastSet ? t('workout.endAtLast', { time }) : t('workout.countHour'), onPress: () => finish(endAt) },
          { text: t('workout.endNow'), onPress: () => finish(finishedAt) },
          { text: t('workout.keepGoing'), style: 'cancel' },
        ]
      );
      return;
    }

    Alert.alert(t('workout.finishTitle'), removal, [
      { text: t('workout.keepGoing'), style: 'cancel' },
      { text: t('workout.finish'), onPress: () => finish(finishedAt) },
    ]);
  }

  function onDiscard() {
    if (!workout) return;
    Alert.alert(t('workout.discardTitle'), t('workout.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.discard'),
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
              <Text style={styles.minimize}>{t('workout.hide')}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={onFinish} hitSlop={8} style={styles.headerButton}>
              <Text style={styles.finishLabel}>{t('workout.finish')}</Text>
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
            placeholderTextColor={c.textSecondary}
            returnKeyType="done"
          />

          <Segmented
            options={['focus', 'list'] as ViewMode[]}
            value={view}
            onChange={changeView}
            format={(v) => t(`focus.view.${v}`)}
          />

          <MusicCard />

          {view === 'focus' && blocks.length > 0 && (
            <WorkoutFocus
              blocks={blocks}
              index={currentIndex}
              onIndex={setFocusIndex}
              drafts={drafts}
              previous={previous}
              onValues={setValues}
              onToggleDone={(set) => toggleDone(set, previousFor(set))}
              onAddSet={onAddSet}
              onDeleteSet={onSetLongPress}
              onMenu={onBlockMenu}
              onFinish={onFinish}
              hintText={hintText}
            />
          )}

          {view === 'list' && blocks.map((block) => {
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
                        {t(`muscles.${block.muscle}`)}
                        {block.sets[0]?.rest_seconds ? ` · ${t('workout.restTime', { time: formatDuration(block.sets[0].rest_seconds) })}` : ''} ·{' '}
                        {t('exercise.howTo')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => onBlockMenu(block)} hitSlop={12}>
                    <Text style={styles.menu}>•••</Text>
                  </Pressable>
                </View>

                {block.hint && (
                  <View style={styles.hint}>
                    <Ionicons name="bulb-outline" size={14} color={c.accent} />
                    <Text style={styles.hintText}>{hintText(block.hint)}</Text>
                  </View>
                )}

                <Pressable onPress={() => toggleEditing(block.position)} hitSlop={6} style={styles.summary}>
                  <Text style={styles.summaryText}>{summarize(block, prevSets)}</Text>
                  <Ionicons
                    name={editing.has(block.position) ? 'chevron-up' : 'chevron-forward'}
                    size={16}
                    color={c.text}
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
                        accessibilityLabel={t(done ? 'workout.setDone' : 'workout.setNumber', { n: i + 1 })}
                        style={({ pressed }) => [styles.circle, done && styles.circleDone, pressed && { opacity: 0.7 }]}>
                        <Text style={[styles.circleText, done && styles.circleTextDone]}>{reps || '–'}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => onAddSet(block)}
                    accessibilityLabel={t('workout.addSetLabel')}
                    style={({ pressed }) => [styles.circle, styles.circleAdd, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="add" size={24} color={c.textSecondary} />
                  </Pressable>
                </View>

                {editing.has(block.position) && (
                  <View style={styles.editor}>
                    <View style={styles.row}>
                      <Text style={[styles.colSet, styles.colHead]}>{t('workout.colSet')}</Text>
                      <Text style={[styles.colPrev, styles.colHead]}>{t('workout.colLast')}</Text>
                      <Text style={[styles.colInput, styles.colHead]}>{t('workout.colKg')}</Text>
                      <Text style={[styles.colInput, styles.colHead]}>{t('workout.colReps')}</Text>
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
                            onChangeText={(text) => onChangeField(set, 'weight', text)}
                            keyboardType="decimal-pad"
                            placeholder={prev ? formatWeight(prev.weight) : ''}
                            placeholderTextColor={c.textSecondary}
                            selectTextOnFocus
                          />
                          <TextInput
                            style={[styles.colInput, styles.input]}
                            value={draft.reps}
                            onChangeText={(text) => onChangeField(set, 'reps', text)}
                            keyboardType="number-pad"
                            placeholder={prev?.reps != null ? String(prev.reps) : ''}
                            placeholderTextColor={c.textSecondary}
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
            label={t('workout.addExercise')}
            onPress={() => router.push({ pathname: '/add-exercise', params: { workoutId: String(workout.id) } })}
          />
          <Button label={t('workout.discardButton')} variant="danger" onPress={onDiscard} />
        </ScrollView>
      </KeyboardAvoidingView>

      {restEndsAt !== null && (
        <View style={styles.rest}>
          <Pressable onPress={() => adjustRest(-15)} style={styles.restButton}>
            <Text style={styles.restButtonLabel}>-15</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.restLabel}>{t('workout.restLabel')}</Text>
            <Text style={styles.restTime}>{formatDuration(restLeft)}</Text>
          </View>
          <Pressable onPress={() => adjustRest(15)} style={styles.restButton}>
            <Text style={styles.restButtonLabel}>+15</Text>
          </Pressable>
          <Pressable onPress={stopRest} style={[styles.restButton, styles.skip]}>
            <Text style={[styles.restButtonLabel, { color: c.accentText }]}>{t('workout.skip')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const styles = useStyles();
  const now = useNow();
  return <Text style={styles.elapsed}>{formatDuration((now - startedAt) / 1000)}</Text>;
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  headerButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  minimize: { color: c.accent, fontSize: 17, fontWeight: '600' },
  elapsed: { color: c.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  finishLabel: { color: c.accent, fontWeight: '800', fontSize: 17 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 140 },
  name: { color: c.text, fontSize: 26, fontWeight: '800', padding: 0 },
  block: { gap: Spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center' },
  blockTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  exerciseName: { color: c.accent, fontSize: 18, fontWeight: '700' },
  muscle: { color: c.textSecondary, fontSize: 13 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  hintText: { color: c.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  menu: { color: c.textSecondary, fontSize: 18, fontWeight: '800', paddingHorizontal: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colHead: { color: c.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 32, alignItems: 'center' },
  colPrev: { flex: 1, alignItems: 'center' },
  colInput: { width: 64 },
  setNumber: { color: c.text, fontWeight: '700', fontSize: 15 },
  prevText: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: c.surfaceRaised,
    color: c.text,
    borderRadius: Radius.sm,
    height: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: -Spacing.xs },
  summaryText: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: c.accent,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: c.accent },
  circleAdd: { borderColor: 'transparent', backgroundColor: c.surfaceRaised },
  circleText: { color: c.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  circleTextDone: { color: c.accentText },
  editor: { gap: Spacing.sm, marginTop: Spacing.xs },
  rest: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderColor: c.accent,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  restLabel: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  restTime: { color: c.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restButton: {
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  restButtonLabel: { color: c.text, fontWeight: '700' },
  skip: { backgroundColor: c.accent },
}));
