import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { BarChart } from '@/components/bar-chart';
import { BodyWeightCard, PlanCard, SetupCard } from '@/components/plan-cards';
import { ExerciseThumb } from '@/components/exercise-preview';
import { Segmented } from '@/components/segmented';
import { Card, Empty, Screen, SectionTitle, StatTile } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { getSetsPerMuscle } from '@/db/stats';
import { getExerciseBests, type ExerciseBest } from '@/db/workouts';
import { useBody } from '@/hooks/use-body';
import { useStats } from '@/hooks/use-stats';
import { addDays, dayKey, setsThisWeek, startOfDay, weeklyCounts } from '@/lib/stats';
import { formatVolume, formatWeight } from '@/lib/workout-math';

const RANGES = [4, 8, 12, 24] as const;
const MUSCLE_DAYS = 30;

// The route types list the settings stack's first page as /settings/index; /settings opens it.
const SETTINGS = '/settings' as Href;

export default function ProfileTab() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const stats = useStats();
  const body = useBody();
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
      title={t('tabs.profile')}
      right={
        <View style={styles.headerIcons}>
          <Pressable
            onPress={() => router.push('/achievements')}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityLabel={t('screens.achievements')}>
            <Ionicons name="trophy" size={22} color={c.accent} />
            {unlocked.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unlocked.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push(SETTINGS)} hitSlop={10} style={styles.iconButton} accessibilityLabel={t('screens.settings')}>
            <Ionicons name="settings-sharp" size={22} color={c.text} />
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.content}>
        {body.loaded && !body.profile && <SetupCard />}
        {body.profile && (
          <>
            <SectionTitle title={t('profile.yourPlan')} />
            <PlanCard body={body} />
            <SectionTitle title={t('screens.bodyWeight')} />
            <BodyWeightCard body={body} />
            <SectionTitle title={t('profile.training')} />
          </>
        )}
        <View style={styles.tiles}>
          <StatTile label={t('profile.workouts')} value={String(stats.workouts.length)} />
          <StatTile label={t('profile.totalSets')} value={String(stats.totals.sets)} />
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('profile.lifted')} value={formatVolume(stats.totals.volume)} />
          <StatTile label={t('profile.bestStreak')} value={t('profile.days', { count: stats.dayStreak.longest })} />
        </View>

        <Pressable onPress={() => router.push('/achievements')}>
          <Card style={styles.achievements}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{t('screens.achievements')}</Text>
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
                    {t('profile.next', { title: t(`achievements.${next.id}.title`) })}{' '}
                    <Text style={styles.muted}>· {t(`achievements.${next.id}.description`)}</Text>
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(next.value / next.target) * 100}%` }]} />
                  </View>
                </View>
              </View>
            )}
          </Card>
        </Pressable>

        <SectionTitle title={t('profile.thisWeek')} />
        <Card>
          <BarChart
            bars={week.map(({ date, sets }) => {
              const key = dayKey(date);
              return {
                key,
                label: date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3),
                value: sets,
                current: key === today,
              };
            })}
            describe={(b) => `${b.label}: ${t('common.setsCount', { count: b.value })}`}
            height={120}
          />
        </Card>

        <SectionTitle
          title={t('profile.weeklyWorkouts')}
          right={<Segmented options={RANGES} value={range} onChange={setRange} format={(r) => t('profile.weeksShort', { count: r })} />}
        />
        <Card>
          <BarChart
            bars={weeks.map((w, i) => ({
              key: String(w.weekStart.getTime()),
              label:
                (weeks.length - 1 - i) % labelEvery === 0
                  ? w.weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' })
                  : '',
              value: w.count,
              current: i === weeks.length - 1,
            }))}
            goal={stats.goal}
            describe={(b) => {
              const w = weeks.find((x) => String(x.weekStart.getTime()) === b.key)!;
              const start = w.weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
              return t('profile.weekOf', { start, count: b.value, goal: stats.goal });
            }}
          />
          <Text style={styles.muted}>
            {t('profile.goalStreak', { count: stats.weekStreak.current, best: stats.weekStreak.longest })}
          </Text>
        </Card>

        <SectionTitle title={t('profile.muscles', { days: MUSCLE_DAYS })} />
        <Card>
          {muscles.length === 0 ? (
            <Text style={styles.muted}>{t('profile.musclesEmpty')}</Text>
          ) : (
            muscles.map((m) => (
              <View key={m.muscle} style={styles.muscleRow}>
                <Text style={styles.muscleName}>{t(`muscles.${m.muscle}`)}</Text>
                <View style={styles.muscleTrack}>
                  <View style={[styles.muscleFill, { width: `${(m.sets / maxMuscle) * 100}%` }]} />
                </View>
                <Text style={styles.muscleValue}>{m.sets}</Text>
              </View>
            ))
          )}
        </Card>

        <SectionTitle title={t('profile.records')} />
        {bests.length === 0 ? (
          <Empty title={t('profile.recordsEmptyTitle')} body={t('profile.recordsEmptyBody')} />
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
                    {t('profile.workoutsCount', { count: b.times })}
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

const useStyles = makeStyles((c) => ({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  headerIcons: { flexDirection: 'row', gap: Spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: c.surface,
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
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: c.accentText, fontSize: 11, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  achievements: { gap: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  muted: { color: c.textSecondary, fontSize: 13 },
  emojiRow: { fontSize: 26, letterSpacing: 2 },
  next: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  nextEmoji: { fontSize: 28, opacity: 0.5 },
  nextTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  muscleName: { color: c.text, fontSize: 14, width: 84 },
  muscleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  muscleFill: { height: '100%', borderRadius: 5, backgroundColor: c.accent },
  muscleValue: { color: c.textSecondary, fontSize: 13, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  record: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  recordName: { color: c.text, fontSize: 16, fontWeight: '700' },
  recordValues: { alignItems: 'flex-end', gap: 2 },
  recordValue: { color: c.text, fontSize: 15, fontWeight: '800' },
}));
