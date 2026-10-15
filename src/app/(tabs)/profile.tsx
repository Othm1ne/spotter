import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { ExerciseThumb } from '@/components/exercise-preview';
import { Segmented } from '@/components/segmented';
import { Card, Empty, Screen, SectionTitle, StatTile } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getSetsPerMuscle } from '@/db/stats';
import { getExerciseBests, type ExerciseBest } from '@/db/workouts';
import { useStats } from '@/hooks/use-stats';
import { addDays, dayKey, setsThisWeek, startOfDay, weeklyCounts } from '@/lib/stats';
import { formatVolume, formatWeight } from '@/lib/workout-math';

const RANGES = [4, 8, 12, 24] as const;
const MUSCLE_DAYS = 30;

export default function ProfileTab() {
  const db = useSQLiteContext();
  const stats = useStats();
  const [range, setRange] = useState<(typeof RANGES)[number]>(8);
  const [bests, setBests] = useState<ExerciseBest[]>([]);
  const [muscles, setMuscles] = useState<{ muscle: string; sets: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      getExerciseBests(db).then(setBests);
      getSetsPerMuscle(db, addDays(startOfDay(new Date()), -MUSCLE_DAYS + 1).getTime()).then(setMuscles);
    }, [db])
  );

  const now = new Date();
  const today = dayKey(now);
  const unlocked = stats.achievements.filter((a) => a.unlocked);
  const next = stats.achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];
  const week = setsThisWeek(stats.days, now);
  const weeks = weeklyCounts(stats.workouts, range, now);
  const labelEvery = range <= 8 ? 1 : range <= 12 ? 2 : 4;
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <Screen
      title="Profile"
      right={
        <View style={styles.headerIcons}>
          <Pressable onPress={() => router.push('/achievements')} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="trophy" size={22} color={Colors.accent} />
            {unlocked.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unlocked.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="settings-sharp" size={22} color={Colors.text} />
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tiles}>
          <StatTile label="Workouts" value={String(stats.workouts.length)} />
          <StatTile label="Total sets" value={String(stats.totals.sets)} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="Lifted" value={formatVolume(stats.totals.volume)} />
          <StatTile label="Best streak" value={`${stats.dayStreak.longest} d`} />
        </View>

        <Pressable onPress={() => router.push('/achievements')}>
          <Card style={styles.achievements}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Achievements</Text>
              <Text style={styles.muted}>
                {unlocked.length}/{stats.achievements.length} ›
              </Text>
            </View>
            {unlocked.length > 0 ? (
              <Text style={styles.emojiRow}>{unlocked.slice(-8).map((a) => a.emoji).join(' ')}</Text>
            ) : null}
            {next && (
              <View style={styles.next}>
                <Text style={styles.nextEmoji}>{next.emoji}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.nextTitle}>
                    Next: {next.title} <Text style={styles.muted}>· {next.description}</Text>
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(next.value / next.target) * 100}%` }]} />
                  </View>
                </View>
              </View>
            )}
          </Card>
        </Pressable>

        <SectionTitle title="This week" />
        <Card>
          <BarChart
            bars={week.map(({ date, sets }) => {
              const key = dayKey(date);
              return {
                key,
                label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
                value: sets,
                current: key === today,
              };
            })}
            describe={(b) => `${b.label}: ${b.value} set${b.value === 1 ? '' : 's'}`}
            height={120}
          />
        </Card>

        <SectionTitle
          title="Weekly workouts"
          right={<Segmented options={RANGES} value={range} onChange={setRange} format={(r) => `${r}w`} />}
        />
        <Card>
          <BarChart
            bars={weeks.map((w, i) => ({
              key: String(w.weekStart.getTime()),
              label:
                (weeks.length - 1 - i) % labelEvery === 0
                  ? w.weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
                  : '',
              value: w.count,
              current: i === weeks.length - 1,
            }))}
            goal={stats.goal}
            describe={(b) => {
              const w = weeks.find((x) => String(x.weekStart.getTime()) === b.key)!;
              const start = w.weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
              return `Week of ${start}: ${b.value} workout${b.value === 1 ? '' : 's'} (goal ${stats.goal})`;
            }}
          />
          <Text style={styles.muted}>
            Goal streak: {stats.weekStreak.current} week{stats.weekStreak.current === 1 ? '' : 's'} · best{' '}
            {stats.weekStreak.longest}. Change the goal in settings.
          </Text>
        </Card>

        <SectionTitle title={`Muscles · last ${MUSCLE_DAYS} days`} />
        <Card>
          {muscles.length === 0 ? (
            <Text style={styles.muted}>Sets per muscle group show up once you log a workout.</Text>
          ) : (
            muscles.map((m) => (
              <View key={m.muscle} style={styles.muscleRow}>
                <Text style={styles.muscleName}>{m.muscle}</Text>
                <View style={styles.muscleTrack}>
                  <View style={[styles.muscleFill, { width: `${(m.sets / maxMuscle) * 100}%` }]} />
                </View>
                <Text style={styles.muscleValue}>{m.sets}</Text>
              </View>
            ))
          )}
        </Card>

        <SectionTitle title="Personal records" />
        {bests.length === 0 ? (
          <Empty title="No records yet" body="Your best lifts and estimated 1RMs appear after your first workout." />
        ) : (
          bests.map((b) => (
            <Pressable
              key={b.exercise_id}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(b.exercise_id) } })}>
              <Card style={styles.record}>
                <ExerciseThumb gif={b.gif} name={b.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordName}>{b.name}</Text>
                  <Text style={styles.muted}>
                    {b.times} workout{b.times === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.recordValues}>
                  <Text style={styles.recordValue}>
                    {formatWeight(b.best_weight)} kg × {b.best_weight_reps}
                  </Text>
                  <Text style={styles.muted}>e1RM {formatWeight(Math.round(b.best_e1rm * 10) / 10)} kg</Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  headerIcons: { flexDirection: 'row', gap: Spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Colors.accentText, fontSize: 11, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  achievements: { gap: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  emojiRow: { fontSize: 26, letterSpacing: 2 },
  next: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  nextEmoji: { fontSize: 28, opacity: 0.5 },
  nextTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.accent },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  muscleName: { color: Colors.text, fontSize: 14, width: 84 },
  muscleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  muscleFill: { height: '100%', borderRadius: 5, backgroundColor: Colors.accent },
  muscleValue: { color: Colors.textSecondary, fontSize: 13, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  record: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  recordName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  recordValues: { alignItems: 'flex-end', gap: 2 },
  recordValue: { color: Colors.text, fontSize: 15, fontWeight: '800' },
});
