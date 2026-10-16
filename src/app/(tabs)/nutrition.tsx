import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { Card, Screen } from '@/components/ui';
import { Colors, Macros, Radius, Spacing } from '@/constants/theme';
import { addWater, copyMeal, deleteEntry, getWater, listEntries, type FoodEntry } from '@/db/food';
import { useBody } from '@/hooks/use-body';
import { MEALS, sum, type Meal } from '@/lib/food';
import { addDays, dayKey, parseDayKey } from '@/lib/stats';

const GLASS_ML = 250;

export default function NutritionTab() {
  const db = useSQLiteContext();
  const body = useBody();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [yesterday, setYesterday] = useState<FoodEntry[]>([]);
  const [water, setWater] = useState(0);

  const load = useCallback(async () => {
    const prev = dayKey(addDays(parseDayKey(day), -1));
    const [e, y, w] = await Promise.all([listEntries(db, day), listEntries(db, prev), getWater(db, day)]);
    setEntries(e);
    setYesterday(y);
    setWater(w);
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

  function onEntryPress(entry: FoodEntry) {
    if (entry.food_id) {
      router.push({ pathname: '/food/[id]', params: { id: String(entry.food_id), entryId: String(entry.id) } });
    } else {
      onEntryLongPress(entry);
    }
  }

  function onEntryLongPress(entry: FoodEntry) {
    Alert.alert(entry.name, `${Math.round(entry.kcal)} kcal`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry.id);
          load();
        },
      },
    ]);
  }

  const dayLabel = isToday
    ? 'Today'
    : day === dayKey(addDays(new Date(), -1))
      ? 'Yesterday'
      : parseDayKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Screen
      title="Nutrition"
      right={
        <View style={styles.dayNav}>
          <Pressable onPress={() => shiftDay(-1)} hitSlop={8} style={styles.dayButton} accessibilityLabel="Previous day">
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.dayLabel}>{dayLabel}</Text>
          <Pressable
            onPress={() => shiftDay(1)}
            disabled={isToday}
            hitSlop={8}
            style={[styles.dayButton, isToday && { opacity: 0.3 }]}
            accessibilityLabel="Next day">
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
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
                  color={left !== null && left < 0 ? Colors.warning : Colors.accent}>
                  <Text style={styles.left}>{Math.abs(Math.round(left ?? 0)).toLocaleString()}</Text>
                  <Text style={styles.leftLabel}>{left !== null && left < 0 ? 'kcal over' : 'kcal left'}</Text>
                </ProgressRing>
                <View style={styles.summaryNumbers}>
                  <Figure label="Eaten" value={Math.round(eaten.kcal)} />
                  <Figure label="Target" value={targets.calories} />
                </View>
              </View>
              <View style={styles.macros}>
                <MacroProgress label="Protein" eaten={eaten.protein} target={targets.protein} color={Macros.protein} />
                <MacroProgress label="Carbs" eaten={eaten.carbs} target={targets.carbs} color={Macros.carbs} />
                <MacroProgress label="Fat" eaten={eaten.fat} target={targets.fat} color={Macros.fat} />
              </View>
            </>
          ) : (
            <Pressable onPress={() => router.push('/onboarding')} style={styles.noTargets}>
              <Text style={styles.cardTitle}>{Math.round(eaten.kcal)} kcal eaten</Text>
              <Text style={styles.muted}>Set your goal to get calorie and protein targets ›</Text>
            </Pressable>
          )}
        </Card>

        <Card style={styles.water}>
          <Ionicons name="water" size={26} color={Macros.protein} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.cardTitle}>
              {liters(water)} L
              {targets ? <Text style={styles.muted}> / {(targets.waterMl / 1000).toFixed(1)} L</Text> : null}
            </Text>
            {targets && (
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${Math.min(100, (water / targets.waterMl) * 100)}%`, backgroundColor: Macros.protein }]}
                />
              </View>
            )}
          </View>
          <Pressable onPress={() => changeWater(-GLASS_ML)} disabled={water === 0} hitSlop={6} style={[styles.waterButton, water === 0 && { opacity: 0.3 }]}>
            <Ionicons name="remove" size={20} color={Colors.text} />
          </Pressable>
          <Pressable onPress={() => changeWater(GLASS_ML)} hitSlop={6} style={[styles.waterButton, styles.waterAdd]}>
            <Ionicons name="add" size={20} color={Colors.accentText} />
          </Pressable>
        </Card>

        {MEALS.map((meal) => {
          const items = entries.filter((e) => e.meal === meal.value);
          const total = sum(items);
          const before = yesterday.filter((e) => e.meal === meal.value);
          return (
            <Card key={meal.value} style={styles.meal}>
              <View style={styles.mealHeader}>
                <Ionicons name={meal.icon as 'sunny'} size={18} color={Colors.accent} />
                <Text style={styles.mealTitle}>{meal.title}</Text>
                {items.length > 0 && <Text style={styles.mealKcal}>{Math.round(total.kcal)} kcal</Text>}
                <Pressable
                  onPress={() => router.push({ pathname: '/food/add', params: { day, meal: meal.value } })}
                  hitSlop={8}
                  style={styles.addButton}
                  accessibilityLabel={`Add to ${meal.title}`}>
                  <Ionicons name="add" size={20} color={Colors.accentText} />
                </Pressable>
              </View>
              {items.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => onEntryPress(e)}
                  onLongPress={() => onEntryLongPress(e)}
                  style={({ pressed }) => [styles.entry, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.muted}>
                      {e.grams ? `${Math.round(e.grams)} g · ` : ''}P {Math.round(e.protein)} · C {Math.round(e.carbs)} · F{' '}
                      {Math.round(e.fat)}
                    </Text>
                  </View>
                  <Text style={styles.entryKcal}>{Math.round(e.kcal)}</Text>
                </Pressable>
              ))}
              {items.length === 0 && before.length > 0 && (
                <Pressable onPress={() => onCopyYesterday(meal.value)} style={styles.copy}>
                  <Ionicons name="repeat" size={16} color={Colors.accent} />
                  <Text style={styles.copyText}>
                    Same as yesterday? {before.length} item{before.length === 1 ? '' : 's'} · {Math.round(sum(before).kcal)} kcal
                  </Text>
                </Pressable>
              )}
            </Card>
          );
        })}
        <Text style={styles.hint}>Tap a food to change the amount, hold it to delete it.</Text>
        <Text style={styles.credit}>Food data from Open Food Facts (ODbL). AI estimates are approximate.</Text>
      </ScrollView>
    </Screen>
  );
}

/** 1250 → "1.25", 1500 → "1.5", 2000 → "2" */
function liters(ml: number) {
  return String(Math.round(ml / 10) / 100);
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <Text style={styles.figureValue}>{value.toLocaleString()}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function MacroProgress({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
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

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { color: Colors.text, fontSize: 15, fontWeight: '700', minWidth: 74, textAlign: 'center' },
  summary: { gap: Spacing.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  summaryNumbers: { gap: Spacing.md },
  left: { color: Colors.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  leftLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  figureValue: { color: Colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macros: { flexDirection: 'row', gap: Spacing.md },
  macro: { flex: 1, gap: 6 },
  macroLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  macroValue: { color: Colors.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  noTargets: { gap: 4 },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  water: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  waterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterAdd: { backgroundColor: Colors.accent },
  meal: { gap: Spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  mealKcal: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  entryName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  entryKcal: { color: Colors.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(198, 244, 50, 0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  copyText: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  hint: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center' },
  credit: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', opacity: 0.7 },
});
