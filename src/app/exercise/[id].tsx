import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExercisePreview } from '@/components/exercise-preview';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getGuide } from '@/db/exercise-guides';
import { getExercise, type ExerciseDetail } from '@/db/workouts';

function parseList(json: string | null): string[] {
  try {
    return json ? (JSON.parse(json) as string[]) : [];
  } catch {
    return [];
  }
}

export default function ExerciseGuideScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);

  useEffect(() => {
    getExercise(db, Number(id)).then(setExercise);
  }, [db, id]);

  if (!exercise) return <View style={styles.screen} />;

  // Starter exercises have hand-written guides; library exercises use their stored steps.
  const guide = getGuide(exercise.name);
  const primary = guide?.muscles.primary ?? [exercise.muscle];
  const secondary = guide?.muscles.secondary ?? parseList(exercise.secondary);
  const steps = guide?.steps ?? parseList(exercise.instructions);
  const tips = guide?.tips ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: exercise.name }} />
      <ExercisePreview gif={exercise.gif} />
      <Text style={styles.meta}>
        {exercise.muscle} · {exercise.equipment}
      </Text>

      <Text style={styles.section}>Muscles worked</Text>
      <View style={styles.chips}>
        {primary.map((m) => (
          <Text key={m} style={[styles.chip, styles.chipPrimary]}>
            {m}
          </Text>
        ))}
        {secondary.map((m) => (
          <Text key={m} style={styles.chip}>
            {m}
          </Text>
        ))}
      </View>

      {steps.length > 0 ? (
        <>
          <Text style={styles.section}>How to</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.body}>{step}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.body}>This is a custom exercise, so there are no instructions for it yet.</Text>
      )}

      {tips.length > 0 && (
        <>
          <Text style={styles.section}>Tips</Text>
          {tips.map((tip, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{tip}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  meta: { color: Colors.textSecondary, fontSize: 15 },
  section: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  chipPrimary: { backgroundColor: Colors.muscle, borderColor: Colors.muscle, color: '#FFFFFF' },
  step: { flexDirection: 'row', gap: Spacing.md },
  stepNumber: { color: Colors.accent, fontSize: 16, fontWeight: '800', width: 18 },
  bullet: { color: Colors.accent, fontSize: 16, fontWeight: '800', width: 18 },
  body: { color: Colors.text, fontSize: 16, lineHeight: 23, flex: 1 },
});
