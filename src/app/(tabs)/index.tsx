import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityCalendar, ActivityLegend } from '@/components/activity-calendar';
import { SetupCard } from '@/components/plan-cards';
import { Button, Card, Screen, SectionTitle, StatTile } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { listRoutines, startRoutine, type RoutineSummary } from '@/db/routines';
import { getActiveWorkout, listFinishedWorkouts, startWorkout, type Workout, type WorkoutSummary } from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { useBody } from '@/hooks/use-body';
import { useStats } from '@/hooks/use-stats';
import { dayKey, parseDayKey, startOfDay, weeklyCounts } from '@/lib/stats';
import { formatDuration, formatElapsed, formatVolume, isStaleWorkout } from '@/lib/workout-math';

export default function HomeTab() {
  const db = useSQLiteContext();
  const stats = useStats();
  const body = useBody();
  const [active, setActive] = useState<Workout | null>(null);
  const [last, setLast] = useState<WorkoutSummary | null>(null);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const now = useNow(active !== null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setActive(await getActiveWorkout(db));
        setLast((await listFinishedWorkouts(db, 1))[0] ?? null);
        setRoutines(await listRoutines(db));
      })();
    }, [db])
  );

  async function onStart() {
    await startWorkout(db);
    router.push('/workout');
  }

  async function onStartRoutine(routine: RoutineSummary) {
    if (active) {
      Alert.alert('Workout in progress', `Finish or discard "${active.name}" before starting another one.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume', onPress: () => router.push('/workout') },
      ]);
      return;
    }
    await startRoutine(db, routine.id);
    router.push('/workout');
  }

  const thisWeek = weeklyCounts(stats.workouts, 1, new Date())[0].count;
  const yearCount = stats.workouts.filter((w) => w.started_at > now - 365 * 24 * 3600 * 1000).length;
  const day = stats.days.get(selected);
  const isToday = selected === dayKey(new Date());

  return (
    <Screen title="Spotter" right={<StreakPill days={stats.dayStreak.current} />}>
      <ScrollView contentContainerStyle={styles.content}>
        {body.loaded && !body.profile && <SetupCard />}
        {body.profile && body.targets && (
          <View style={styles.today}>
            <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.todayTargets, pressed && { opacity: 0.7 }]}>
              <Text style={styles.todayLabel}>{greeting(now, body.profile.name)}</Text>
              <Text style={styles.todayValue}>
                {body.targets.calories.toLocaleString()} kcal · {body.targets.protein} g protein
              </Text>
            </Pressable>
            {!body.loggedToday && (
              <Pressable onPress={() => router.push('/weight')} style={styles.weighIn}>
                <Ionicons name="scale-outline" size={18} color={Colors.accentText} />
                <Text style={styles.weighInText}>Weigh in</Text>
              </Pressable>
            )}
          </View>
        )}
        {active ? (
          <Card style={styles.activeCard}>
            <Text style={styles.label}>IN PROGRESS</Text>
            <Text style={styles.cardTitle}>{active.name}</Text>
            {isStaleWorkout(active.started_at, now) ? (
              <Text style={styles.stale}>
                Open for {formatElapsed(now - active.started_at)}. Forgot to finish? Resume it and tap Finish, and
                Spotter will end it at your last set.
              </Text>
            ) : (
              <Text style={styles.timer}>{formatDuration((now - active.started_at) / 1000)}</Text>
            )}
            <Button label="Resume workout" onPress={() => router.push('/workout')} />
          </Card>
        ) : null}

        <SectionTitle
          title="My workouts"
          right={
            <Pressable
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}
              hitSlop={8}
              style={styles.newButton}>
              <Ionicons name="add" size={18} color={Colors.accentText} />
              <Text style={styles.newLabel}>New</Text>
            </Pressable>
          }
        />
        {routines.length === 0 ? (
          <Pressable onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}>
            <Card style={styles.emptyPlan}>
              <Ionicons name="clipboard-outline" size={28} color={Colors.accent} />
              <Text style={styles.cardTitle}>Plan your first workout</Text>
              <Text style={[styles.muted, { textAlign: 'center' }]}>
                Build a chest day, leg day or anything else: pick the exercises, sets, reps and rest once, then
                start it in one tap.
              </Text>
            </Card>
          </Pressable>
        ) : (
          routines.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}
              style={({ pressed }) => pressed && { opacity: 0.8 }}>
              <Card style={styles.routine}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.muted}>
                    {r.exercise_count} exercise{r.exercise_count === 1 ? '' : 's'} · {r.set_count} sets
                    {r.last_done ? ` · ${daysAgo(r.last_done, now)}` : ''}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {r.exercises}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onStartRoutine(r)}
                  hitSlop={6}
                  style={styles.play}
                  accessibilityLabel={`Start ${r.name}`}>
                  <Ionicons name="play" size={22} color={Colors.accentText} />
                </Pressable>
              </Card>
            </Pressable>
          ))
        )}
        {!active && <Button label="Start empty workout" variant="secondary" onPress={onStart} />}

        <View style={styles.stats}>
          <StatTile label="Streak" value={`${stats.dayStreak.current} ${stats.dayStreak.current === 1 ? 'day' : 'days'}`} />
          <StatTile label="This week" value={`${thisWeek}/${stats.goal}`} />
          <StatTile label="Goal streak" value={`${stats.weekStreak.current} wk`} />
        </View>

        <Card style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.cardTitle}>Activity</Text>
            <Text style={styles.muted}>
              {yearCount} workout{yearCount === 1 ? '' : 's'} in the last year
            </Text>
          </View>
          <ActivityCalendar days={stats.days} selected={selected} onSelect={setSelected} />
          <ActivityLegend />

          <View style={styles.dayPanel}>
            <Text style={styles.dayTitle}>
              {isToday
                ? 'Today'
                : parseDayKey(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {day ? (
              day.workouts.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(w.id) } })}
                  style={({ pressed }) => [styles.dayRow, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.dayRowName} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={styles.muted}>
                    {w.sets} sets · {formatVolume(w.volume)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.muted}>{isToday ? 'No workout yet today.' : 'Rest day.'}</Text>
            )}
            <Button
              label={isToday ? '+ Log a completed workout' : '+ Log a workout on this day'}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-workout', params: { date: selected } })}
            />
          </View>
        </Card>

        {last && (
          <>
            <Text style={styles.section}>Last workout</Text>
            <Pressable onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(last.id) } })}>
              <Card>
                <Text style={styles.cardTitle}>{last.name}</Text>
                <Text style={styles.muted}>
                  {new Date(last.started_at).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · {last.set_count} sets · {formatVolume(last.volume)}
                </Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {last.exercises}
                </Text>
              </Card>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function greeting(now: number, name: string) {
  const h = new Date(now).getHours();
  const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

function daysAgo(time: number, now: number) {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(time).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return 'done today';
  if (days === 1) return 'done yesterday';
  return `done ${days} days ago`;
}

function StreakPill({ days }: { days: number }) {
  const lit = days > 0;
  return (
    <View style={[styles.pill, lit && styles.pillLit]}>
      <Ionicons name="flame" size={18} color={lit ? '#FF8A3D' : Colors.textSecondary} />
      <Text style={[styles.pillText, lit && { color: Colors.text }]}>{days}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  activeCard: { borderWidth: 1, borderColor: Colors.accent },
  label: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  stale: { color: '#FFB547', fontSize: 14, lineHeight: 20 },
  timer: { color: Colors.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  section: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.sm },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  muted: { color: Colors.textSecondary, fontSize: 14 },
  calendarCard: { gap: Spacing.md },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayPanel: {
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  dayTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  dayRowName: { color: Colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  today: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  todayTargets: { flex: 1, gap: 2 },
  todayLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  todayValue: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  weighIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  weighInText: { color: Colors.accentText, fontWeight: '800' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  newLabel: { color: Colors.accentText, fontWeight: '800' },
  emptyPlan: { alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  routine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  pillLit: { backgroundColor: 'rgba(255, 138, 61, 0.15)' },
  pillText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '800' },
});
