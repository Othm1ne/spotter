import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/option-card';
import { Button, Card } from '@/components/ui';
import { Colors, Macros, Spacing } from '@/constants/theme';
import { deleteEntry, getEntry, getFood, logFood, setFavorite, updateEntry, type Food, type FoodEntry } from '@/db/food';
import { MEALS, mealForTime, mealTitle, scale, type Meal } from '@/lib/food';
import { dayKey } from '@/lib/stats';
import { formatWeight, parseNumber } from '@/lib/workout-math';

const COMMON_GRAMS = [50, 100, 150, 200, 250];

/** Choose how much you ate of a food, see its calories and macros, and log it (or edit a logged entry). */
export default function FoodPortionScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string; day?: string; meal?: Meal; entryId?: string }>();
  const [food, setFood] = useState<Food | null>(null);
  const [entry, setEntry] = useState<FoodEntry | null>(null);
  const [gramsText, setGramsText] = useState('');
  const [meal, setMeal] = useState<Meal>(params.meal ?? mealForTime(new Date()));

  useEffect(() => {
    (async () => {
      const f = await getFood(db, Number(params.id));
      setFood(f);
      if (params.entryId) {
        const e = await getEntry(db, Number(params.entryId));
        setEntry(e);
        if (e) {
          setMeal(e.meal);
          setGramsText(formatWeight(Math.round((e.grams ?? 100) * 10) / 10));
          return;
        }
      }
      if (f) setGramsText(formatWeight(f.last_grams ?? f.serving_g ?? 100));
    })();
  }, [db, params.id, params.entryId]);

  if (!food) return <View style={styles.screen} />;

  const grams = parseNumber(gramsText) ?? 0;
  const n = scale(food, grams);
  const shortcuts = [
    ...(food.last_grams ? [{ label: `Last time · ${formatWeight(food.last_grams)} g`, grams: food.last_grams }] : []),
    ...(food.serving_g && food.serving_g !== food.last_grams
      ? [{ label: `1 serving · ${formatWeight(food.serving_g)} g`, grams: food.serving_g }]
      : []),
    ...COMMON_GRAMS.filter((g) => g !== food.last_grams && g !== food.serving_g).map((g) => ({ label: `${g} g`, grams: g })),
  ];

  async function toggleFavorite() {
    if (!food) return;
    Haptics.selectionAsync();
    await setFavorite(db, food.id, !food.favorite);
    setFood({ ...food, favorite: food.favorite ? 0 : 1 });
  }

  async function onSave() {
    if (!food || grams <= 0) return;
    if (entry) await updateEntry(db, entry, food, grams, meal);
    else await logFood(db, food, grams, params.day ?? dayKey(new Date()), meal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  }

  function onDelete() {
    if (!entry) return;
    Alert.alert('Remove from your log?', food?.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry.id);
          router.dismissAll();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: entry ? 'Edit food' : 'Add food',
          headerRight: () => (
            <Pressable onPress={toggleFavorite} hitSlop={10} accessibilityLabel={food.favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Ionicons name={food.favorite ? 'star' : 'star-outline'} size={24} color={Colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.name}>{food.name}</Text>
          <Text style={styles.muted}>
            {food.brand ? `${food.brand} · ` : ''}
            {food.source === 'ai' ? 'AI estimate · ' : ''}per 100 g: {Math.round(food.kcal)} kcal · P {food.protein.toFixed(1)} · C{' '}
            {food.carbs.toFixed(1)} · F {food.fat.toFixed(1)}
          </Text>
        </View>

        <Card style={styles.amount}>
          <Text style={styles.label}>AMOUNT</Text>
          <View style={styles.gramsRow}>
            <TextInput
              value={gramsText}
              onChangeText={setGramsText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={styles.gramsInput}
              accessibilityLabel="Grams"
            />
            <Text style={styles.unit}>g</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {shortcuts.map((s) => (
              <Chip key={s.label} label={s.label} selected={grams === s.grams} onPress={() => setGramsText(formatWeight(s.grams))} />
            ))}
          </ScrollView>
        </Card>

        <Card style={styles.nutrition}>
          <View style={styles.kcalRow}>
            <Text style={styles.kcal}>{Math.round(n.kcal)}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
          </View>
          <View style={styles.macros}>
            <Macro label="Protein" grams={n.protein} color={Macros.protein} />
            <Macro label="Carbs" grams={n.carbs} color={Macros.carbs} />
            <Macro label="Fat" grams={n.fat} color={Macros.fat} />
          </View>
        </Card>

        <Text style={styles.label}>MEAL</Text>
        <View style={styles.mealChips}>
          {MEALS.map((m) => (
            <Chip key={m.value} label={m.title} selected={meal === m.value} onPress={() => setMeal(m.value)} />
          ))}
        </View>

        <Button
          label={entry ? 'Save changes' : `Add to ${mealTitle(meal)} · ${Math.round(n.kcal)} kcal`}
          onPress={onSave}
          disabled={grams <= 0}
        />
        {entry && <Button label="Remove from log" variant="danger" onPress={onDelete} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{grams.toFixed(grams < 10 ? 1 : 0)} g</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  name: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  amount: { gap: Spacing.md },
  gramsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.xs },
  gramsInput: {
    color: Colors.text,
    fontSize: 48,
    fontWeight: '800',
    minWidth: 120,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 0,
  },
  unit: { color: Colors.textSecondary, fontSize: 22, fontWeight: '700' },
  chips: { gap: Spacing.sm },
  nutrition: { gap: Spacing.lg },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm },
  kcal: { color: Colors.text, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kcalUnit: { color: Colors.textSecondary, fontSize: 18, fontWeight: '700' },
  macros: { flexDirection: 'row', justifyContent: 'space-around' },
  macro: { alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  macroValue: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
