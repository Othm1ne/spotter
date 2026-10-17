import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n, useT, type Params } from '@/i18n';
import type { IconName } from '@/components/icon';
import { MusicCard } from '@/components/music-card';
import { SetupCard } from '@/components/plan-cards';
import { ProgramCard } from '@/components/program-card';
import { ProgressRing } from '@/components/progress-ring';
import { Button, Card, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { addWater, getWater, listEntries } from '@/db/food';
import { getProgram, type Program } from '@/db/program';
import { getActiveWorkout, type Workout } from '@/db/workouts';
import { useAskCoach } from '@/hooks/use-ask-coach';
import { useBody } from '@/hooks/use-body';
import { useNow } from '@/hooks/use-now';
import { useStartRoutine } from '@/hooks/use-start-routine';
import { useStats } from '@/hooks/use-stats';
import { mealForTime, sum, ZERO, type Nutrients } from '@/lib/food';
import { addDays, dayKey, startOfWeek } from '@/lib/stats';
import { dayOfYear, pickTip } from '@/lib/tips';
import { formatDuration, formatElapsed, formatWeight, isStaleWorkout, signed } from '@/lib/workout-math';

const GLASS_ML = 250;

/** Daily dashboard: today's workout, food and water, a coach tip and the week at a glance. */
export default function HomeTab() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const stats = useStats();
  const body = useBody();
  const startRoutine = useStartRoutine();
  const askCoach = useAskCoach();
  const [active, setActive] = useState<Workout | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [eaten, setEaten] = useState<Nutrients>(ZERO);
  const [foods, setFoods] = useState(0);
  const [water, setWater] = useState(0);
  const now = useNow(true, active ? 1000 : 60_000);

  const load = useCallback(async () => {
    const today = dayKey(new Date());
    const [a, p, entries, w] = await Promise.all([getActiveWorkout(db), getProgram(db), listEntries(db, today), getWater(db, today)]);
    setActive(a);
    setProgram(p);
    setEaten(sum(entries));
    setFoods(entries.length);
    setWater(w);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function drink() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addWater(db, dayKey(new Date()), GLASS_ML);
    setWater(await getWater(db, dayKey(new Date())));
  }


  const date = new Date(now);
  const todayKey = dayKey(date);
  const { profile, targets } = body;
  const trainedToday = stats.days.has(todayKey);
  const lastWorkout = stats.workouts.reduce((m, w) => Math.max(m, w.started_at), 0);
  const daysSinceWorkout = lastWorkout ? Math.floor((date.getTime() - lastWorkout) / 86_400_000) : null;
  const weekStart = dayKey(startOfWeek(date));
  const thisWeek = stats.workouts.filter((w) => dayKey(w.started_at) >= weekStart).length;
  const kcalLeft = targets ? targets.calories - eaten.kcal : null;
  const proteinLeft = targets ? targets.protein - eaten.protein : null;

  const tip = pickTip({
    hour: date.getHours(),
    dayOfYear: dayOfYear(date),
    hasProfile: profile !== null,
    kcalLeft,
    proteinLeft,
    waterMl: water,
    waterTarget: targets?.waterMl ?? null,
    foodsToday: foods,
    trainedToday,
    daysSinceWorkout,
    nextWorkout: program?.days[program.next]?.name ?? null,
    weighedToday: body.loggedToday,
    streak: stats.dayStreak.current,
  });

  const weight = body.average ?? body.latest?.weight ?? null;

  return (
    <Screen title="Spotter" right={<StreakPill days={stats.dayStreak.current} />}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting(date, profile?.name ?? '', t)}</Text>
            <Text style={styles.muted}>{date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          {profile && !body.loggedToday && (
            <Pressable onPress={() => router.push('/weight')} style={styles.weighIn}>
              <Ionicons name="scale-outline" size={18} color={c.accentText} />
              <Text style={styles.weighInText}>{t('home.weighIn')}</Text>
            </Pressable>
          )}
        </View>

        {body.loaded && !profile && <SetupCard />}

        {active && (
          <Pressable onPress={() => router.push('/workout')}>
            <Card style={styles.activeCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>{t('common.inProgress')}</Text>
                <Text style={styles.cardTitle}>{active.name}</Text>
                {isStaleWorkout(active.started_at, now) ? (
                  <Text style={styles.stale}>{t('home.forgot', { time: formatElapsed(now - active.started_at) })}</Text>
                ) : (
                  <Text style={styles.timer}>{formatDuration((now - active.started_at) / 1000)}</Text>
                )}
              </View>
              <View style={styles.play}>
                <Ionicons name="arrow-forward" size={24} color={c.accentText} />
              </View>
            </Card>
          </Pressable>
        )}

        {profile && !active && <ProgramCard program={program} now={now} onStart={startRoutine} />}

        <MusicCard />

        {targets && kcalLeft !== null && (
          <Animated.View entering={FadeInDown.delay(50)}>
            <Pressable onPress={() => router.navigate('/nutrition')} style={({ pressed }) => pressed && { opacity: 0.9 }}>
              <Card style={styles.food}>
                <ProgressRing
                  size={104}
                  stroke={10}
                  progress={eaten.kcal / targets.calories}
                  color={kcalLeft < 0 ? c.warning : c.accent}>
                  <Text style={styles.ringValue}>{Math.abs(Math.round(kcalLeft)).toLocaleString()}</Text>
                  <Text style={styles.ringLabel}>{kcalLeft < 0 ? t('home.kcalOver') : t('home.kcalLeft')}</Text>
                </ProgressRing>
                <View style={styles.bars}>
                  <Bar
                    label={t('macros.protein')}
                    value={`${Math.round(eaten.protein)} / ${targets.protein} g`}
                    progress={eaten.protein / targets.protein}
                    color={c.macros.protein}
                  />
                  <View style={styles.waterRow}>
                    <View style={{ flex: 1 }}>
                      <Bar
                        label={t('home.water')}
                        value={`${(water / 1000).toFixed(1)} / ${(targets.waterMl / 1000).toFixed(1)} L`}
                        progress={water / targets.waterMl}
                        color={c.macros.protein}
                      />
                    </View>
                    <Pressable onPress={drink} hitSlop={8} style={styles.drink} accessibilityLabel={t('home.addGlass')}>
                      <Ionicons name="add" size={18} color={c.text} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: '/food/add', params: { day: todayKey, meal: mealForTime(date) } })}
                    hitSlop={6}
                    style={styles.addFood}>
                    <Ionicons name="add" size={18} color={c.accent} />
                    <Text style={styles.addFoodText}>{t('home.logFood')}</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100)}>
          <Pressable onPress={() => askCoach(t(`tips.${tip.id}.question`, tip.params))} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <Card style={styles.tip}>
              <View style={styles.tipIcon}>
                <Ionicons name={tip.icon as IconName} size={20} color={c.accent} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.tipLabel}>{t('home.coachTip')}</Text>
                <Text style={styles.tipTitle}>{t(`tips.${tip.id}.title`, tip.params)}</Text>
                <Text style={styles.tipBody}>{t(`tips.${tip.id}.body`, tip.params)}</Text>
                <Text style={styles.tipAsk}>{t('home.askCoach')}</Text>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <View style={styles.tiles}>
          <Tile icon="flame" value={`${stats.dayStreak.current}`} label={t('home.dayStreak')} />
          <Tile icon="calendar" value={`${thisWeek}/${stats.goal}`} label={t('home.thisWeek')} onPress={() => router.navigate('/train')} />
          <Tile
            icon="scale"
            value={weight !== null ? formatWeight(Math.round(weight * 10) / 10) : '–'}
            label={body.rate ? t('home.weightTrend', { kg: signed(body.rate.kgPerWeek.toFixed(1)) }) : t('common.kg')}
            onPress={() => router.push('/weight')}
          />
        </View>

        <WeekStrip trained={stats.days} today={date} />

        {body.loaded && !profile && <Button label={t('home.startWorkout')} variant="secondary" onPress={() => router.navigate('/train')} />}
      </ScrollView>
    </Screen>
  );
}

function greeting(date: Date, name: string, t: (key: string, params?: Params) => string) {
  const h = date.getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return name ? t(`home.greetNamed.${part}`, { name }) : t(`home.greet.${part}`);
}

function Bar({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.barText}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Tile({ icon, value, label, onPress }: { icon: IconName; value: string; label: string; onPress?: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={16} color={c.textSecondary} />
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Monday to Sunday of this week: ticked days had a workout. */
function WeekStrip({ trained, today }: { trained: Map<string, unknown>; today: Date }) {
  const { locale } = useI18n();
  const c = useColors();
  const styles = useStyles();
  const monday = startOfWeek(today);
  const todayKey = dayKey(today);
  return (
    <Pressable onPress={() => router.navigate('/train')}>
      <Card style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(monday, i);
          const key = dayKey(d);
          const done = trained.has(key);
          const isToday = key === todayKey;
          return (
            <View key={key} style={styles.weekDay}>
              <Text style={[styles.weekLabel, isToday && { color: c.text }]}>
                {d.toLocaleDateString(locale, { weekday: 'narrow' })}
              </Text>
              <View style={[styles.weekDot, done && styles.weekDone, isToday && !done && styles.weekToday]}>
                {done && <Ionicons name="checkmark" size={16} color={c.accentText} />}
              </View>
            </View>
          );
        })}
      </Card>
    </Pressable>
  );
}

function StreakPill({ days }: { days: number }) {
  const c = useColors();
  const styles = useStyles();
  const lit = days > 0;
  return (
    <View style={[styles.pill, lit && styles.pillLit]}>
      <Ionicons name="flame" size={18} color={lit ? '#FF8A3D' : c.textSecondary} />
      <Text style={[styles.pillText, lit && { color: c.text }]}>{days}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  greeting: { color: c.text, fontSize: 20, fontWeight: '800' },
  muted: { color: c.textSecondary, fontSize: 14 },
  weighIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  weighInText: { color: c.accentText, fontWeight: '800' },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: c.accent },
  label: { color: c.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  stale: { color: c.warning, fontSize: 14 },
  timer: { color: c.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  food: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ringValue: { color: c.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  bars: { flex: 1, gap: Spacing.md },
  barText: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: c.text, fontSize: 13, fontWeight: '700' },
  barValue: { color: c.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  waterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  drink: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  addFoodText: { color: c.accent, fontWeight: '700', fontSize: 14 },
  tip: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tipTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
  tipBody: { color: c.text, fontSize: 14, lineHeight: 20, opacity: 0.85 },
  tipAsk: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 2 },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1, backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: 2 },
  tileValue: { color: c.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  tileLabel: { color: c.textSecondary, fontSize: 12 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6 },
  weekLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDone: { backgroundColor: c.accent },
  weekToday: { borderWidth: 2, borderColor: c.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  pillLit: { backgroundColor: 'rgba(255, 138, 61, 0.15)' },
  pillText: { color: c.textSecondary, fontSize: 16, fontWeight: '800' },
}));
