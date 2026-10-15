import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_WEEKLY_GOAL, getWeeklyGoal, setWeeklyGoal } from '@/db/settings';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);

  useEffect(() => {
    getWeeklyGoal(db).then(setGoal);
  }, [db]);

  function change(delta: number) {
    const next = Math.min(7, Math.max(1, goal + delta));
    setGoal(next);
    setWeeklyGoal(db, next);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Weekly goal</Text>
        <Text style={styles.body}>
          How many workouts you aim for each week. It sets the goal line on your charts and the goal streak.
        </Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => change(-1)} hitSlop={8} style={styles.button}>
            <Ionicons name="remove" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.value}>
            {goal} <Text style={styles.unit}>per week</Text>
          </Text>
          <Pressable onPress={() => change(1)} hitSlop={8} style={styles.button}>
            <Ionicons name="add" size={24} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>About</Text>
        <Text style={styles.body}>
          Spotter keeps everything on this phone. Exercise animations come from ExerciseGymGifsDB and are loaded
          once, then saved for offline use.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  button: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  unit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
});
