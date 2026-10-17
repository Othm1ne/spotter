import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { ActivityCalendar, ActivityLegend } from '@/components/activity-calendar';
import { ProgramCard } from '@/components/program-card';
import { Button, Card, Screen, SectionTitle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { getProfile } from '@/db/profile';
import { getProgram, type Program } from '@/db/program';
import { listRoutines, type RoutineSummary } from '@/db/routines';
import { getActiveWorkout, listFinishedWorkouts, startWorkout, type Workout, type WorkoutSummary } from '@/db/workouts';
import { useNow } from '@/hooks/use-now';
import { useStartRoutine } from '@/hooks/use-start-routine';
import { useStats } from '@/hooks/use-stats';
import { dayKey, parseDayKey, relativeDay } from '@/lib/stats';
import { formatDuration, formatElapsed, formatVolume, isStaleWorkout } from '@/lib/workout-math';

const RECENT = 5;

/** Everything about training: the workout in progress, program, plans, calendar and history. */
export default function TrainTab() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
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
    <Screen title={t('tabs.train')}>
      <ScrollView contentContainerStyle={styles.content}>
        {active && (
          <Card style={styles.activeCard}>
            <Text style={styles.label}>{t('common.inProgress')}</Text>
            <Text style={styles.cardTitle}>{active.name}</Text>
            {isStaleWorkout(active.started_at, now) ? (
              <Text style={styles.stale}>{t('train.stale', { time: formatElapsed(now - active.started_at) })}</Text>
            ) : (
              <Text style={styles.timer}>{formatDuration((now - active.started_at) / 1000)}</Text>
            )}
            <Button label={t('train.resume')} onPress={() => router.push('/workout')} />
          </Card>
        )}

        {hasProfile && !active && <ProgramCard program={program} now={now} onStart={startRoutine} />}

        <SectionTitle
          title={t('train.myWorkouts')}
          right={
            <Pressable
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}
              hitSlop={8}
              style={styles.newButton}>
              <Ionicons name="add" size={18} color={c.accentText} />
              <Text style={styles.newLabel}>{t('common.new')}</Text>
            </Pressable>
          }
        />
        {routines.length === 0 ? (
          <Pressable onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}>
            <Card style={styles.emptyPlan}>
              <Ionicons name="clipboard-outline" size={28} color={c.accent} />
              <Text style={styles.cardTitle}>{t('train.planOwn')}</Text>
              <Text style={[styles.muted, { textAlign: 'center' }]}>
                {t('train.planOwnBody')}
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
                    {t('train.planLine', { count: r.exercise_count, sets: r.set_count })}
                    {r.last_done ? ` · ${t(`time.done.${relativeDay(r.last_done, now).key}`, { count: relativeDay(r.last_done, now).count })}` : ''}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {r.exercises}
                  </Text>
                </View>
                <Pressable onPress={() => startRoutine(r.id)} hitSlop={6} style={styles.play} accessibilityLabel={t('common.startNamed', { name: r.name })}>
                  <Ionicons name="play" size={22} color={c.accentText} />
                </Pressable>
              </Card>
            </Pressable>
          ))
        )}
        {!active && <Button label={t('train.startEmpty')} variant="secondary" onPress={onStartEmpty} />}

        <Card style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.cardTitle}>{t('train.activity')}</Text>
            <Text style={styles.muted}>
              {t('train.lastYear', { count: yearCount })}
            </Text>
          </View>
          <ActivityCalendar days={stats.days} selected={selected} onSelect={setSelected} />
          <ActivityLegend />

          <View style={styles.dayPanel}>
            <Text style={styles.dayTitle}>
              {isToday ? t('time.today') : parseDayKey(selected).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
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
                    {t('common.setsCount', { count: w.sets })} · {formatVolume(w.volume)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.muted}>{isToday ? t('train.noWorkoutToday') : t('train.restDay')}</Text>
            )}
            <Button
              label={isToday ? t('train.logToday') : t('train.logOnDay')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-workout', params: { date: selected } })}
            />
          </View>
        </Card>

        {recent.length > 0 && (
          <>
            <SectionTitle
              title={t('train.recent')}
              right={
                <Pressable onPress={() => router.push('/history')} hitSlop={8}>
                  <Text style={styles.link}>{t('common.seeAll')}</Text>
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
                      {new Date(w.started_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {t('common.setsCount', { count: w.set_count })} · {formatVolume(w.volume)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  activeCard: { borderWidth: 1, borderColor: c.accent },
  label: { color: c.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  stale: { color: c.warning, fontSize: 14, lineHeight: 20 },
  timer: { color: c.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  muted: { color: c.textSecondary, fontSize: 14 },
  link: { color: c.accent, fontSize: 14, fontWeight: '600' },
  calendarCard: { gap: Spacing.md },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayPanel: {
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: Spacing.md,
  },
  dayTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  dayRowName: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  newLabel: { color: c.accentText, fontWeight: '800' },
  emptyPlan: { alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' },
  routine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  recentName: { color: c.text, fontSize: 16, fontWeight: '700' },
}));
