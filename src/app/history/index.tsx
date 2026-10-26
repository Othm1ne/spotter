import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { Card, Empty } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { deleteWorkout, listFinishedWorkouts, type WorkoutSummary } from '@/db/workouts';
import { formatDuration, formatVolume } from '@/lib/workout-math';

/** Every finished workout, newest first. */
export default function HistoryScreen() {
  const { locale } = useI18n();
  const t = useT();
  const styles = useStyles();
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);

  async function remove(id: number) {
    await deleteWorkout(db, id);
    setWorkouts((all) => all.filter((w) => w.id !== id));
  }

  useFocusEffect(
    useCallback(() => {
      listFinishedWorkouts(db).then(setWorkouts);
    }, [db])
  );

  return (
    <FlatList
      style={styles.screen}
      data={workouts}
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Empty title={t('history.emptyTitle')} body={t('history.emptyBody')} />}
      renderItem={({ item }) => (
        <SwipeToDelete
          onDelete={() => remove(item.id)}
          confirm={{ title: t('history.deleteTitle'), message: t('settings.cannotUndo') }}>
          <Pressable
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(item.id) } })}
            style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.date}>
                {new Date(item.started_at).toLocaleDateString(locale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.stats}>
                <Text style={styles.stat}>
                  ⏱ {formatDuration(((item.finished_at ?? item.started_at) - item.started_at) / 1000)}
                </Text>
                <Text style={styles.stat}>{t('common.setsCount', { count: item.set_count })}</Text>
                <Text style={styles.stat}>{formatVolume(item.volume)}</Text>
              </View>
              <Text style={styles.exercises} numberOfLines={2}>
                {item.exercises}
              </Text>
            </Card>
          </Pressable>
        </SwipeToDelete>
      )}
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  name: { color: c.text, fontSize: 18, fontWeight: '700' },
  date: { color: c.textSecondary, fontSize: 14 },
  stats: { flexDirection: 'row', gap: Spacing.lg },
  stat: { color: c.text, fontSize: 14, fontWeight: '600' },
  exercises: { color: c.textSecondary, fontSize: 14 },
}));
