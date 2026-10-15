import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { routineFromWorkout } from '@/db/routines';
import { deleteWorkout, getWorkout, getWorkoutSets, type Workout, type WorkoutSet } from '@/db/workouts';
import { estimateOneRepMax, formatDuration, formatVolume, formatWeight, setVolume } from '@/lib/workout-math';

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  useEffect(() => {
    (async () => {
      setWorkout(await getWorkout(db, Number(id)));
      setSets(await getWorkoutSets(db, Number(id)));
    })();
  }, [db, id]);

  const blocks = useMemo(() => {
    const map = new Map<number, { name: string; sets: WorkoutSet[] }>();
    for (const s of sets) {
      const b = map.get(s.exercise_position) ?? { name: s.exercise_name, sets: [] };
      b.sets.push(s);
      map.set(s.exercise_position, b);
    }
    return [...map.values()];
  }, [sets]);

  if (!workout) return null;

  const volume = sets.reduce((sum, s) => sum + setVolume(s), 0);
  const duration = ((workout.finished_at ?? workout.started_at) - workout.started_at) / 1000;

  async function onSaveAsRoutine() {
    const id = await routineFromWorkout(db, workout!.id, workout!.name);
    router.push({ pathname: '/routine/[id]', params: { id: String(id) } });
  }

  function onDelete() {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workout!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: workout.name }} />
      <Text style={styles.date}>
        {new Date(workout.started_at).toLocaleString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      <View style={styles.stats}>
        <Summary value={formatDuration(duration)} label="Duration" />
        <Summary value={String(sets.length)} label="Sets" />
        <Summary value={formatVolume(volume)} label="Volume" />
      </View>

      {blocks.map((block, i) => {
        const best = Math.max(0, ...block.sets.map((s) => estimateOneRepMax(s.weight, s.reps) ?? 0));
        return (
          <Card key={i}>
            <Text style={styles.exercise}>{block.name}</Text>
            {block.sets.map((s, j) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setIndex}>{j + 1}</Text>
                <Text style={styles.setText}>
                  {formatWeight(s.weight)} kg × {s.reps ?? '-'}
                </Text>
              </View>
            ))}
            {best > 0 && <Text style={styles.e1rm}>Best est. 1RM: {formatWeight(Math.round(best * 10) / 10)} kg</Text>}
          </Card>
        );
      })}

      <Button label="Save as workout plan" variant="secondary" onPress={onSaveAsRoutine} />
      <Button label="Delete workout" variant="danger" onPress={onDelete} />
    </ScrollView>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.date}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  date: { color: Colors.textSecondary, fontSize: 14 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  summary: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  summaryValue: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  exercise: { color: Colors.accent, fontSize: 17, fontWeight: '700' },
  setRow: { flexDirection: 'row', gap: Spacing.md },
  setIndex: { color: Colors.textSecondary, width: 20, fontWeight: '700' },
  setText: { color: Colors.text, fontSize: 15 },
  e1rm: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.xs },
});
