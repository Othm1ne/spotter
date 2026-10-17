import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';

import { useT } from '@/i18n';
import { ExercisePickerModal, SetsEditor, type DraftSet } from '@/components/sets-editor';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { deleteRoutine, getRoutine, saveRoutine } from '@/db/routines';
import { getDefaultRest } from '@/db/settings';
import { getPreviousSets, type Exercise } from '@/db/workouts';
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

  function updateBlock(key: number, change: (b: Block) => Block) {
    setBlocks((all) => all.map((b) => (b.key === key ? change(b) : b)));
  }

  async function onSave() {
    if (saving) return;
    if (blocks.length === 0) {
      Alert.alert(t('routine.needExerciseTitle'), t('routine.needExerciseBody'));
      return;
    }
    setSaving(true);
    await saveRoutine(db, {
      id: routineId,
      name: name.trim() || t('routine.defaultName'),
      exercises: blocks.map((b) => ({
        exercise: b.exercise,
        restSeconds: b.restSeconds,
        repMin: b.repMin,
        repMax: b.repMax,
        sets: b.sets.map((s) => ({ weight: parseNumber(s.weight), reps: parseNumber(s.reps) })),
      })),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
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

        {blocks.map((b) => (
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
