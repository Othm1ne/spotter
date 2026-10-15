import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExercisePickerModal, SetsEditor, type DraftSet } from '@/components/sets-editor';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getPreviousSets, saveCompletedWorkout, type Exercise } from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { addDays, dayKey, parseDayKey } from '@/lib/stats';
import { defaultWorkoutName, formatWeight, parseNumber } from '@/lib/workout-math';

type DraftExercise = { key: number; exercise: Exercise; sets: DraftSet[] };

const DEFAULT_MINUTES = 60;
const EVENING_HOUR = 18;

/** Log a workout after the fact: pick the day, the exercises, and each set's kg × reps. */
export default function LogWorkoutScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string }>();
  const now = useNow(true, 60_000);
  const today = dayKey(now);
  const [date, setDate] = useState(params.date && params.date <= today ? params.date : today);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  /** For today the workout ends now; past days are logged as an evening session. */
  function startTime(now: number) {
    if (date === today) return now - minutes * 60 * 1000;
    const d = parseDayKey(date);
    d.setHours(EVENING_HOUR);
    return d.getTime();
  }

  async function addExercise(exercise: Exercise) {
    setPicking(false);
    const previous = (await getPreviousSets(db, [exercise.id])).get(exercise.id);
    const sets = previous?.length
      ? previous.map((p) => ({ weight: p.weight === null ? '' : formatWeight(p.weight), reps: p.reps === null ? '' : String(p.reps) }))
      : [{ weight: '', reps: '' }];
    setExercises((all) => [...all, { key: Date.now(), exercise, sets }]);
  }

  function updateSet(key: number, index: number, field: keyof DraftSet, text: string) {
    setExercises((all) =>
      all.map((e) =>
        e.key === key ? { ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: text } : s)) } : e
      )
    );
  }

  function addSet(key: number) {
    setExercises((all) =>
      all.map((e) => (e.key === key ? { ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { weight: '', reps: '' }) }] } : e))
    );
  }

  function removeSet(key: number, index: number) {
    setExercises((all) =>
      all
        .map((e) => (e.key === key ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e))
        .filter((e) => e.sets.length > 0)
    );
  }

  async function onSave() {
    if (saving) return;
    const logged = exercises
      .map((e) => ({
        exerciseId: e.exercise.id,
        sets: e.sets
          .map((s) => ({ weight: parseNumber(s.weight), reps: parseNumber(s.reps) }))
          .filter((s) => s.reps !== null && s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0);
    if (logged.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one exercise with the reps you did.');
      return;
    }
    setSaving(true);
    const startedAt = startTime(Date.now());
    const id = await saveCompletedWorkout(db, {
      name: name.trim() || defaultWorkoutName(new Date(startedAt)),
      startedAt,
      finishedAt: startedAt + minutes * 60 * 1000,
      exercises: logged,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/history/[id]', params: { id: String(id) } });
  }

  const dateLabel =
    date === today
      ? 'Today'
      : date === dayKey(addDays(new Date(now), -1))
        ? 'Yesterday'
        : parseDayKey(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={onSave} hitSlop={8} style={styles.save}>
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={defaultWorkoutName(new Date(startTime(now)))}
          placeholderTextColor={Colors.textSecondary}
          style={styles.name}
          returnKeyType="done"
        />

        <View style={styles.row}>
          <Stepper
            label="Day"
            value={dateLabel}
            onMinus={() => setDate(dayKey(addDays(parseDayKey(date), -1)))}
            onPlus={() => setDate(dayKey(addDays(parseDayKey(date), 1)))}
            plusDisabled={date >= today}
          />
          <Stepper
            label="Duration"
            value={`${minutes} min`}
            onMinus={() => setMinutes((m) => Math.max(5, m - 5))}
            onPlus={() => setMinutes((m) => Math.min(300, m + 5))}
          />
        </View>

        {exercises.map((e) => (
          <SetsEditor
            key={e.key}
            exercise={e.exercise}
            sets={e.sets}
            onChangeSet={(i, field, text) => updateSet(e.key, i, field, text)}
            onAddSet={() => addSet(e.key)}
            onRemoveSet={(i) => removeSet(e.key, i)}
            onRemove={() => setExercises((all) => all.filter((x) => x.key !== e.key))}
            onInfo={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.exercise.id) } })}
          />
        ))}

        <Button label="+ Add exercise" onPress={() => setPicking(true)} />
        {exercises.length > 0 && <Button label="Save workout" variant="secondary" onPress={onSave} />}
      </ScrollView>

      <ExercisePickerModal visible={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </KeyboardAvoidingView>
  );
}

function Stepper(props: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  plusDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{props.label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={props.onMinus} hitSlop={8} style={styles.stepperButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.stepperValue} numberOfLines={1} adjustsFontSizeToFit>
          {props.value}
        </Text>
        <Pressable
          onPress={props.onPlus}
          disabled={props.plusDisabled}
          hitSlop={8}
          style={[styles.stepperButton, props.plusDisabled && { opacity: 0.3 }]}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 80 },
  save: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  saveLabel: { color: Colors.accent, fontSize: 17, fontWeight: '700' },
  name: { color: Colors.text, fontSize: 24, fontWeight: '800', padding: 0 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  stepper: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  stepperLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { color: Colors.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
});
