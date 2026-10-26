import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { ProgressRing } from '@/components/progress-ring';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { Card, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { addWater, copyMeal, deleteEntry, getWater, intakeByDay, listEntries, type FoodEntry } from '@/db/food';
import { useBody } from '@/hooks/use-body';
import { MEALS, sum, type Meal } from '@/lib/food';
import { quickInsight, weekStats, type DayIntake } from '@/lib/nutrition-review';
import { addDays, dayKey, parseDayKey } from '@/lib/stats';
import { syncReminders } from '@/services/reminders';

const GLASS_ML = 250;

export default function NutritionTab() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const body = useBody();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [yesterday, setYesterday] = useState<FoodEntry[]>([]);
  const [water, setWater] = useState(0);
  const [week, setWeek] = useState<DayIntake[]>([]);

  const load = useCallback(async () => {
    const prev = dayKey(addDays(parseDayKey(day), -1));
    const now = new Date();
    const [e, y, w, days] = await Promise.all([
      listEntries(db, day),
      listEntries(db, prev),
      getWater(db, day),
      intakeByDay(db, dayKey(addDays(now, -7))),
    ]);
    setEntries(e);
    setYesterday(y);
    setWater(w);
    // The weekly insight covers finished days only.
    setWeek(days.filter((d) => d.day < dayKey(now)));
    // A meal just logged or the water goal reached: drop today's reminders for it.
    syncReminders(db);
  }, [db, day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = dayKey(new Date());
  const isToday = day === today;
  const targets = body.targets;
  const eaten = sum(entries);
  const left = targets ? targets.calories - eaten.kcal : null;
  const insight = targets ? quickInsight(weekStats(week, targets, []), targets) : null;

  function shiftDay(delta: number) {
    Haptics.selectionAsync();
    setDay((d) => dayKey(addDays(parseDayKey(d), delta)));
  }

  async function changeWater(ml: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addWater(db, day, ml);
    setWater(await getWater(db, day));
  }

  async function onCopyYesterday(meal: Meal) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await copyMeal(db, dayKey(addDays(parseDayKey(day), -1)), day, meal);
    load();
  }

  async function removeEntry(id: number) {
    await deleteEntry(db, id);
    load();
  }

  function onEntryPress(entry: FoodEntry) {
    if (entry.food_id) {
      router.push({ pathname: '/food/[id]', params: { id: String(entry.food_id), entryId: String(entry.id) } });
    } else {
      onEntryLongPress(entry);
    }
  }

  function onEntryLongPress(entry: FoodEntry) {
    Alert.alert(entry.name, `${Math.round(entry.kcal)} kcal`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry.id);
          load();
        },
      },
    ]);
  }

  const dayLabel = isToday
    ? t('time.today')
    : day === dayKey(addDays(new Date(), -1))
      ? t('time.yesterday')
      : parseDayKey(day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Screen
      title={t('tabs.nutrition')}
      right={
        <View style={styles.dayNav}>
          <Pressable
            onPress={() => shiftDay(-1)}
            hitSlop={8}
            style={styles.dayButton}
            accessibilityLabel={t('nutrition.prevDay')}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <Text style={styles.dayLabel}>{dayLabel}</Text>
          <Pressable
            onPress={() => shiftDay(1)}
            disabled={isToday}
            hitSlop={8}
            style={[styles.dayButton, isToday && { opacity: 0.3 }]}
            accessibilityLabel={t('nutrition.nextDay')}>
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summary}>
          {targets ? (
            <>
              <View style={styles.summaryTop}>
                <ProgressRing
                  size={150}
                  stroke={13}
                  progress={eaten.kcal / targets.calories}
                  color={left !== null && left < 0 ? c.warning : c.accent}>
                  <Text style={styles.left}>{Math.abs(Math.round(left ?? 0)).toLocaleString()}</Text>
                  <Text style={styles.leftLabel}>{left !== null && left < 0 ? t('home.kcalOver') : t('home.kcalLeft')}</Text>
                </ProgressRing>
                <View style={styles.summaryNumbers}>
                  <Figure label={t('nutrition.eaten')} value={Math.round(eaten.kcal)} />
                  <Figure label={t('nutrition.target')} value={targets.calories} />
                </View>
              </View>
              <View style={styles.macros}>
                <MacroProgress
                  label={t('macros.protein')}
                  eaten={eaten.protein}
                  target={targets.protein}
                  color={c.macros.protein}
                />
                <MacroProgress label={t('macros.carbs')} eaten={eaten.carbs} target={targets.carbs} color={c.macros.carbs} />
                <MacroProgress label={t('macros.fat')} eaten={eaten.fat} target={targets.fat} color={c.macros.fat} />
              </View>
            </>
          ) : (
            <Pressable onPress={() => router.push('/onboarding')} style={styles.noTargets}>
              <Text style={styles.cardTitle}>{t('nutrition.kcalEaten', { kcal: Math.round(eaten.kcal) })}</Text>
              <Text style={styles.muted}>{t('nutrition.setGoal')}</Text>
            </Pressable>
          )}
        </Card>

        <Card style={styles.water}>
          <Ionicons name="water" size={26} color={c.macros.protein} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.cardTitle}>
              {liters(water)} L{targets ? <Text style={styles.muted}> / {(targets.waterMl / 1000).toFixed(1)} L</Text> : null}
            </Text>
            {targets && (
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.min(100, (water / targets.waterMl) * 100)}%`, backgroundColor: c.macros.protein },
                  ]}
                />
              </View>
            )}
          </View>
          <Pressable
            onPress={() => changeWater(-GLASS_ML)}
            disabled={water === 0}
            hitSlop={6}
            style={[styles.waterButton, water === 0 && { opacity: 0.3 }]}>
            <Ionicons name="remove" size={20} color={c.text} />
          </Pressable>
          <Pressable onPress={() => changeWater(GLASS_ML)} hitSlop={6} style={[styles.waterButton, styles.waterAdd]}>
            <Ionicons name="add" size={20} color={c.accentText} />
          </Pressable>
        </Card>

        {targets && insight && (
          <View style={styles.coachRow}>
            <Pressable
              onPress={() => router.push({ pathname: '/nutrition-review', params: { kind: isToday ? 'day' : 'week' } })}
              style={({ pressed }) => [styles.coachCard, pressed && { opacity: 0.8 }]}>
              <View style={styles.coachHeader}>
                <Ionicons name="sparkles" size={16} color={c.accent} />
                <Text style={styles.coachTitle}>{t('screens.coachReview')}</Text>
              </View>
              <Text style={styles.muted} numberOfLines={3}>
                {t(`insight.${insight.key}`, insight.params)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/supplements')}
              style={({ pressed }) => [styles.coachCard, styles.suppCard, pressed && { opacity: 0.8 }]}>
              <Ionicons name="flask" size={22} color={c.accent} />
              <Text style={styles.coachTitle}>{t('screens.supplements')}</Text>
              <Text style={styles.muted}>{t('nutrition.whatWorks')}</Text>
            </Pressable>
          </View>
        )}

        {MEALS.map((meal) => {
          const items = entries.filter((e) => e.meal === meal.value);
          const total = sum(items);
          const before = yesterday.filter((e) => e.meal === meal.value);
          return (
            <Card key={meal.value} style={styles.meal}>
              <View style={styles.mealHeader}>
                <Ionicons name={meal.icon as 'sunny'} size={18} color={c.accent} />
                <Text style={styles.mealTitle}>{t(`meals.${meal.value}`)}</Text>
                {items.length > 0 && <Text style={styles.mealKcal}>{Math.round(total.kcal)} kcal</Text>}
                <Pressable
                  onPress={() => router.push({ pathname: '/food/add', params: { day, meal: meal.value } })}
                  hitSlop={8}
                  style={styles.addButton}
                  accessibilityLabel={t('nutrition.addTo', { meal: t(`meals.${meal.value}`) })}>
                  <Ionicons name="add" size={20} color={c.accentText} />
                </Pressable>
              </View>
              {items.map((e) => (
                <SwipeToDelete key={e.id} onDelete={() => removeEntry(e.id)}>
                  <Pressable
                    onPress={() => onEntryPress(e)}
                    onLongPress={() => onEntryLongPress(e)}
                    style={({ pressed }) => [styles.entry, pressed && { opacity: 0.6 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text style={styles.muted}>
                        {e.grams ? `${Math.round(e.grams)} g · ` : ''}
                        {t('macros.short', { p: Math.round(e.protein), c: Math.round(e.carbs), f: Math.round(e.fat) })}
                      </Text>
                    </View>
                    <Text style={styles.entryKcal}>{Math.round(e.kcal)}</Text>
                  </Pressable>
                </SwipeToDelete>
              ))}
              {items.length === 0 && before.length > 0 && (
                <Pressable onPress={() => onCopyYesterday(meal.value)} style={styles.copy}>
                  <Ionicons name="repeat" size={16} color={c.accent} />
                  <Text style={styles.copyText}>
                    {t('nutrition.sameAsYesterday', { count: before.length, kcal: Math.round(sum(before).kcal) })}
                  </Text>
                </Pressable>
              )}
            </Card>
          );
        })}
        <Text style={styles.hint}>{t('nutrition.hint')}</Text>
        <Text style={styles.credit}>{t('nutrition.credit')}</Text>
      </ScrollView>
    </Screen>
  );
}

/** 1250 → "1.25", 1500 → "1.5", 2000 → "2" */
function liters(ml: number) {
  return String(Math.round(ml / 10) / 100);
}

function Figure({ label, value }: { label: string; value: number }) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.figureValue}>{value.toLocaleString()}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function MacroProgress({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, (eaten / target) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroValue}>
        {Math.round(eaten)}
        <Text style={styles.muted}> / {target} g</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { color: c.text, fontSize: 15, fontWeight: '700', minWidth: 74, textAlign: 'center' },
  summary: { gap: Spacing.lg },
  coachRow: { flexDirection: 'row', gap: Spacing.md },
  coachCard: { flex: 1, backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  coachTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  suppCard: { flex: 0, width: 116, alignItems: 'flex-start' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  summaryNumbers: { gap: Spacing.md },
  left: { color: c.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  leftLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  figureValue: { color: c.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macros: { flexDirection: 'row', gap: Spacing.md },
  macro: { flex: 1, gap: 6 },
  macroLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  macroValue: { color: c.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  noTargets: { gap: 4 },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  muted: { color: c.textSecondary, fontSize: 13 },
  water: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  waterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterAdd: { backgroundColor: c.accent },
  meal: { gap: Spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealTitle: { color: c.text, fontSize: 17, fontWeight: '800', flex: 1 },
  mealKcal: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  entryName: { color: c.text, fontSize: 15, fontWeight: '600' },
  entryKcal: { color: c.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.accentSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  copyText: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
  hint: { color: c.textSecondary, fontSize: 12, textAlign: 'center' },
  credit: { color: c.textSecondary, fontSize: 11, textAlign: 'center', opacity: 0.7 },
}));
