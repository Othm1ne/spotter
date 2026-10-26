import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';

import { useT } from '@/i18n';
import { PlanReviewCard } from '@/components/plan-review';
import { ExercisePickerModal, SetsEditor, type DraftSet } from '@/components/sets-editor';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { deleteRoutine, getRoutine, saveRoutine } from '@/db/routines';
import { getDefaultRest } from '@/db/settings';
import { getPreviousSets, type Exercise } from '@/db/workouts';
import type { PlanSuggestion } from '@/lib/plan-review';
import { formatWeight, parseNumber } from '@/lib/workout-math';

// Program days carry a rep range for progression; keep it through edits.
type Block = { key: number; exercise: Exercise; restSeconds: number; sets: DraftSet[]; repMin?: number | null; repMax?: number | null };

const DEFAULT_SETS = 3;
const DEFAULT_REPS = '10';

const toText = (n: number | null) => (n === null ? '' : formatWeight(n));

/** Create or edit a workout plan: exercises, kg × reps per set, and rest time. `id` is "new" or a routine id. */
export default function RoutineEditorScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string }>();
  const routineId = params.id === 'new' ? null : Number(params.id);
  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [lastTime, setLastTime] = useState<Map<number, DraftSet[]>>(new Map());
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (routineId === null) return;
    (async () => {
      const routine = await getRoutine(db, routineId);
      if (!routine) return;
      setName(routine.name);
      setBlocks(
        routine.exercises.map((e, i) => ({
          key: i,
          exercise: e.exercise,
          restSeconds: e.restSeconds,
          repMin: e.repMin,
          repMax: e.repMax,
          sets: e.sets.map((s) => ({ weight: toText(s.weight), reps: toText(s.reps) })),
        }))
      );
      const previous = await getPreviousSets(db, routine.exercises.map((e) => e.exercise.id));
      setLastTime(
        new Map([...previous].map(([id, sets]) => [id, sets.map((s) => ({ weight: toText(s.weight), reps: toText(s.reps) }))]))
      );
    })();
  }, [db, routineId]);

  async function addExercise(exercise: Exercise) {
    setPicking(false);
    const previous = (await getPreviousSets(db, [exercise.id])).get(exercise.id) ?? [];
    const last = previous.map((s) => ({ weight: toText(s.weight), reps: toText(s.reps) }));
    setLastTime((m) => new Map(m).set(exercise.id, last));
    const sets = last.length > 0 ? last : Array.from({ length: DEFAULT_SETS }, () => ({ weight: '', reps: DEFAULT_REPS }));
    const restSeconds = await getDefaultRest(db);
    setBlocks((all) => [...all, { key: Date.now(), exercise, restSeconds, sets }]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    Haptics.selectionAsync();
    setBlocks((all) => {
      const next = [...all];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  function updateBlock(key: number, change: (b: Block) => Block) {
    setBlocks((all) => all.map((b) => (b.key === key ? change(b) : b)));
  }

  function persist(toSave: Block[]) {
    return saveRoutine(db, {
      id: routineId,
      name: name.trim() || t('routine.defaultName'),
      exercises: toSave.map((b) => ({
        exercise: b.exercise,
        restSeconds: b.restSeconds,
        repMin: b.repMin,
        repMax: b.repMax,
        sets: b.sets.map((s) => ({ weight: parseNumber(s.weight), reps: parseNumber(s.reps) })),
      })),
    });
  }

  async function onSave() {
    if (saving) return;
    if (blocks.length === 0) {
      Alert.alert(t('routine.needExerciseTitle'), t('routine.needExerciseBody'));
      return;
    }
    setSaving(true);
    await persist(blocks);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  /** Applies one AI suggestion to the plan and saves it right away. */
  function applySuggestion(suggestion: PlanSuggestion, exercises: Map<number, Exercise>) {
    const reps = (repMin: number) => String(repMin);
    let next = blocks;
    switch (suggestion.type) {
      case 'swap': {
        const exercise = exercises.get(suggestion.newExerciseId);
        if (!exercise) return;
        next = blocks.map((b) => (b.exercise.id === suggestion.exerciseId ? { ...b, exercise } : b));
        break;
      }
      case 'sets':
        next = blocks.map((b) => {
          if (b.exercise.id !== suggestion.exerciseId) return b;
          const template = b.sets.at(-1) ?? { weight: '', reps: DEFAULT_REPS };
          const sets = Array.from({ length: suggestion.sets }, (_, i) => b.sets[i] ?? { ...template });
          return { ...b, sets };
        });
        break;
      case 'reps':
        next = blocks.map((b) =>
          b.exercise.id === suggestion.exerciseId
            ? {
                ...b,
                repMin: suggestion.repMin,
                repMax: suggestion.repMax,
                sets: b.sets.map((s) => ({ ...s, reps: reps(suggestion.repMin) })),
              }
            : b
        );
        break;
      case 'rest':
        next = blocks.map((b) => (b.exercise.id === suggestion.exerciseId ? { ...b, restSeconds: suggestion.restSeconds } : b));
        break;
      case 'remove':
        next = blocks.filter((b) => b.exercise.id !== suggestion.exerciseId);
        break;
      case 'add': {
        const exercise = exercises.get(suggestion.newExerciseId);
        if (!exercise) return;
        next = [
          ...blocks,
          {
            key: Date.now(),
            exercise,
            restSeconds: suggestion.restSeconds,
            repMin: suggestion.repMin,
            repMax: suggestion.repMax,
            sets: Array.from({ length: suggestion.sets }, () => ({ weight: '', reps: reps(suggestion.repMin) })),
          },
        ];
        break;
      }
    }
    setBlocks(next);
    persist(next);
  }

  function onDelete() {
    if (routineId === null) return;
    Alert.alert(t('routine.deleteTitle'), t('routine.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteRoutine(db, routineId);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: routineId === null ? t('routine.newTitle') : t('routine.editTitle'),
          headerRight: () => (
            <Pressable onPress={onSave} hitSlop={8} style={styles.save}>
              <Text style={styles.saveLabel}>{t('common.save')}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('routine.namePlaceholder')}
          placeholderTextColor={c.textSecondary}
          style={styles.name}
          returnKeyType="done"
          autoFocus={routineId === null}
        />
        <Text style={styles.hint}>
          {t('routine.hint')}
        </Text>

        {routineId !== null && (
          <PlanReviewCard
            planName={name}
            blocks={blocks.map((b) => ({
              exercise: b.exercise,
              sets: b.sets.length,
              reps: b.repMin && b.repMax ? `${b.repMin}-${b.repMax}` : (b.sets[0]?.reps ?? '?'),
              restSeconds: b.restSeconds,
            }))}
            onApply={applySuggestion}
          />
        )}

        {blocks.map((b, i) => (
          <SetsEditor
            key={b.key}
            exercise={b.exercise}
            sets={b.sets}
            placeholders={lastTime.get(b.exercise.id)}
            restSeconds={b.restSeconds}
            onRestChange={(restSeconds) => updateBlock(b.key, (x) => ({ ...x, restSeconds }))}
            onChangeSet={(i, field, text) =>
              updateBlock(b.key, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, [field]: text } : s)) }))
            }
            onAddSet={() =>
              updateBlock(b.key, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets.at(-1) ?? { weight: '', reps: DEFAULT_REPS }) }] }))
            }
            onRemoveSet={(i) => updateBlock(b.key, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}
            onRemove={() => setBlocks((all) => all.filter((x) => x.key !== b.key))}
            onMoveUp={i > 0 ? () => moveBlock(i, -1) : undefined}
            onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, 1) : undefined}
            onInfo={() => router.push({ pathname: '/exercise/[id]', params: { id: String(b.exercise.id) } })}
          />
        ))}

        <Button label={t('workout.addExercise')} onPress={() => setPicking(true)} />
        {blocks.length > 0 && <Button label={t('common.saveWorkout')} variant="secondary" onPress={onSave} />}
        {routineId !== null && <Button label={t('routine.delete')} variant="danger" onPress={onDelete} />}
      </ScrollView>

      <ExercisePickerModal visible={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 80 },
  save: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  saveLabel: { color: c.accent, fontSize: 17, fontWeight: '700' },
  name: { color: c.text, fontSize: 26, fontWeight: '800', padding: 0 },
  hint: { color: c.textSecondary, fontSize: 13, marginTop: -Spacing.sm },
}));
