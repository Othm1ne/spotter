import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { hasTranslation, useT } from '@/i18n';
import { ExercisePreview } from '@/components/exercise-preview';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
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
  const t = useT();
  const styles = useStyles();
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
  // Library muscle names ("lats", "upper back"…) show as-is when there is no translation for them.
  const muscleName = (m: string) => (hasTranslation(`muscles.${m}`) ? t(`muscles.${m}`) : m);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: exercise.name }} />
      <ExercisePreview gif={exercise.gif} />
      <Text style={styles.meta}>
        {muscleName(exercise.muscle)} · {t(`equipment.${exercise.equipment}`)}
      </Text>

      <Text style={styles.section}>{t('exercise.musclesWorked')}</Text>
      <View style={styles.chips}>
        {primary.map((m) => (
          <Text key={m} style={[styles.chip, styles.chipPrimary]}>
            {muscleName(m)}
          </Text>
        ))}
        {secondary.map((m) => (
          <Text key={m} style={styles.chip}>
            {muscleName(m)}
          </Text>
        ))}
      </View>

      {steps.length > 0 ? (
        <>
          <Text style={styles.section}>{t('exercise.howToTitle')}</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.body}>{step}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.body}>{t('exercise.custom')}</Text>
      )}

      {tips.length > 0 && (
        <>
          <Text style={styles.section}>{t('exercise.tips')}</Text>
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

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  meta: { color: c.textSecondary, fontSize: 15 },
  section: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  chipPrimary: { backgroundColor: c.muscle, borderColor: c.muscle, color: '#FFFFFF' },
  step: { flexDirection: 'row', gap: Spacing.md },
  stepNumber: { color: c.accent, fontSize: 16, fontWeight: '800', width: 18 },
  bullet: { color: c.accent, fontSize: 16, fontWeight: '800', width: 18 },
  body: { color: c.text, fontSize: 16, lineHeight: 23, flex: 1 },
}));
