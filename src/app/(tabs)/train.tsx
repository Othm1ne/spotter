import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityCalendar, ActivityLegend } from '@/components/activity-calendar';
import { ProgramCard } from '@/components/program-card';
import { Button, Card, Screen, SectionTitle } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getProfile } from '@/db/profile';
import { getProgram, type Program } from '@/db/program';
import { listRoutines, type RoutineSummary } from '@/db/routines';
import { getActiveWorkout, listFinishedWorkouts, startWorkout, type Workout, type WorkoutSummary } from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { useStartRoutine } from '@/hooks/use-start-routine';
import { useStats } from '@/hooks/use-stats';
import { dayKey, parseDayKey, startOfDay } from '@/lib/stats';
import { formatDuration, formatElapsed, formatVolume, isStaleWorkout } from '@/lib/workout-math';

const RECENT = 5;

/** Everything about training: the workout in progress, program, plans, calendar and history. */
export default function TrainTab() {
  const db = useSQLiteContext();
  const stats = useStats();
  const startRoutine = useStartRoutine();
  const [active, setActive] = useState<Workout | null>(null);
  const [recent, setRecent] = useState<WorkoutSummary[]>([]);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const now = useNow(active !== null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setActive(await getActiveWorkout(db));
        setRecent(await listFinishedWorkouts(db, RECENT));
        setRoutines(await listRoutines(db));
        setProgram(await getProgram(db));
        setHasProfile((await getProfile(db)) !== null);
      })();
    }, [db])
  );

  async function onStartEmpty() {
    await startWorkout(db);
    router.push('/workout');
  }

  const yearCount = stats.workouts.filter((w) => w.started_at > now - 365 * 24 * 3600 * 1000).length;
  const day = stats.days.get(selected);
  const isToday = selected === dayKey(new Date());

  return (
    <Screen title="Train">
      <ScrollView contentContainerStyle={styles.content}>
        {active && (
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
        )}

        {hasProfile && !active && <ProgramCard program={program} now={now} onStart={startRoutine} />}

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
              <Text style={styles.cardTitle}>Plan your own workout</Text>
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
                <Pressable onPress={() => startRoutine(r.id)} hitSlop={6} style={styles.play} accessibilityLabel={`Start ${r.name}`}>
                  <Ionicons name="play" size={22} color={Colors.accentText} />
                </Pressable>
              </Card>
            </Pressable>
          ))
        )}
        {!active && <Button label="Start empty workout" variant="secondary" onPress={onStartEmpty} />}

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

        {recent.length > 0 && (
          <>
            <SectionTitle
              title="Recent workouts"
              right={
                <Pressable onPress={() => router.push('/history')} hitSlop={8}>
                  <Text style={styles.link}>See all ›</Text>
                </Pressable>
              }
            />
            {recent.map((w) => (
              <Pressable
                key={w.id}
                onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(w.id) } })}
                style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <Card style={styles.recent}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {new Date(w.started_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {w.set_count} sets · {formatVolume(w.volume)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function daysAgo(time: number, now: number) {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(time).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return 'done today';
  if (days === 1) return 'done yesterday';
  return `done ${days} days ago`;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  activeCard: { borderWidth: 1, borderColor: Colors.accent },
  label: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  stale: { color: Colors.warning, fontSize: 14, lineHeight: 20 },
  timer: { color: Colors.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  muted: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
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
  recent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  recentName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
