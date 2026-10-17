import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { routineFromWorkout } from '@/db/routines';
import {
  deleteWorkout,
  getWorkout,
  getWorkoutSets,
  setWorkoutDuration,
  type Workout,
  type WorkoutSet,
} from '@/db/workouts';
import { estimateOneRepMax, formatDuration, formatVolume, formatWeight, setVolume } from '@/lib/workout-math';

export default function WorkoutDetailScreen() {
  const { locale } = useI18n();
  const t = useT();
  const styles = useStyles();
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

  function onEditDuration() {
    const options = [30, 45, 60, 75, 90, 120];
    Alert.alert(t('history.durationTitle'), t('history.durationBody'), [
      ...options.map((minutes) => ({
        text: formatDuration(minutes * 60),
        onPress: async () => {
          await setWorkoutDuration(db, workout!.id, minutes);
          setWorkout(await getWorkout(db, workout!.id));
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  function onDelete() {
    Alert.alert(t('history.deleteTitle'), t('settings.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
        {new Date(workout.started_at).toLocaleString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      <View style={styles.stats}>
        <Summary value={formatDuration(duration)} label={t('history.durationEdit')} onPress={onEditDuration} />
        <Summary value={String(sets.length)} label={t('history.sets')} />
        <Summary value={formatVolume(volume)} label={t('history.volume')} />
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
            {best > 0 && <Text style={styles.e1rm}>{t('history.bestE1rm', { kg: formatWeight(Math.round(best * 10) / 10) })}</Text>}
          </Card>
        );
      })}

      <Button label={t('history.saveAsPlan')} variant="secondary" onPress={onSaveAsRoutine} />
      <Button label={t('routine.delete')} variant="danger" onPress={onDelete} />
    </ScrollView>
  );
}

function Summary({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1 }}>
      <Card style={styles.summary}>
        <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.date}>{label}</Text>
      </Card>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  date: { color: c.textSecondary, fontSize: 14 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  summary: { alignItems: 'center', paddingHorizontal: Spacing.sm },
  summaryValue: { color: c.text, fontSize: 20, fontWeight: '800' },
  exercise: { color: c.accent, fontSize: 17, fontWeight: '700' },
  setRow: { flexDirection: 'row', gap: Spacing.md },
  setIndex: { color: c.textSecondary, width: 20, fontWeight: '700' },
  setText: { color: c.text, fontSize: 15 },
  e1rm: { color: c.textSecondary, fontSize: 13, marginTop: Spacing.xs },
}));
