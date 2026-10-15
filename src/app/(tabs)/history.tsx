import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Empty, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { listFinishedWorkouts, type WorkoutSummary } from '@/db/workouts';
import { formatDuration, formatVolume } from '@/lib/workout-math';

export default function HistoryTab() {
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      listFinishedWorkouts(db).then(setWorkouts);
    }, [db])
  );

  return (
    <Screen title="History">
      <FlatList
        data={workouts}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty title="No workouts yet" body="Finished workouts show up here." />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(item.id) } })}
            style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.date}>
                {new Date(item.started_at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.stats}>
                <Text style={styles.stat}>⏱ {formatDuration(((item.finished_at ?? item.started_at) - item.started_at) / 1000)}</Text>
                <Text style={styles.stat}>{item.set_count} sets</Text>
                <Text style={styles.stat}>{formatVolume(item.volume)}</Text>
              </View>
              <Text style={styles.exercises} numberOfLines={2}>
                {item.exercises}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  name: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  date: { color: Colors.textSecondary, fontSize: 14 },
  stats: { flexDirection: 'row', gap: Spacing.lg },
  stat: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  exercises: { color: Colors.textSecondary, fontSize: 14 },
});
