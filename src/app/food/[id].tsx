import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { Chip } from '@/components/option-card';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { deleteEntry, getEntry, getFood, logFood, setFavorite, updateEntry, type Food, type FoodEntry } from '@/db/food';
import { MEALS, mealForTime, scale, type Meal } from '@/lib/food';
import { dayKey } from '@/lib/stats';
import { formatWeight, parseNumber } from '@/lib/workout-math';

const COMMON_GRAMS = [50, 100, 150, 200, 250];

/** Choose how much you ate of a food, see its calories and macros, and log it (or edit a logged entry). */
export default function FoodPortionScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
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
    ...(food.last_grams ? [{ label: t('portion.lastTime', { grams: formatWeight(food.last_grams) }), grams: food.last_grams }] : []),
    ...(food.serving_g && food.serving_g !== food.last_grams
      ? [{ label: t('portion.serving', { grams: formatWeight(food.serving_g) }), grams: food.serving_g }]
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
    Alert.alert(t('portion.removeTitle'), food?.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('portion.remove'),
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
          title: entry ? t('portion.editTitle') : t('screens.addFood'),
          headerRight: () => (
            <Pressable onPress={toggleFavorite} hitSlop={10} accessibilityLabel={food.favorite ? t('portion.unfavorite') : t('portion.favorite')}>
              <Ionicons name={food.favorite ? 'star' : 'star-outline'} size={24} color={c.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.name}>{food.name}</Text>
          <Text style={styles.muted}>
            {food.brand ? `${food.brand} · ` : ''}
            {food.source === 'ai' ? `${t('portion.aiEstimate')} · ` : ''}
            {t('portion.per100', {
              kcal: Math.round(food.kcal),
              macros: t('macros.short', { p: food.protein.toFixed(1), c: food.carbs.toFixed(1), f: food.fat.toFixed(1) }),
            })}
          </Text>
        </View>

        <Card style={styles.amount}>
          <Text style={styles.label}>{t('portion.amount')}</Text>
          <View style={styles.gramsRow}>
            <TextInput
              value={gramsText}
              onChangeText={setGramsText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={styles.gramsInput}
              accessibilityLabel={t('portion.grams')}
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
            <Macro label={t('macros.protein')} grams={n.protein} color={c.macros.protein} />
            <Macro label={t('macros.carbs')} grams={n.carbs} color={c.macros.carbs} />
            <Macro label={t('macros.fat')} grams={n.fat} color={c.macros.fat} />
          </View>
        </Card>

        <Text style={styles.label}>{t('portion.meal')}</Text>
        <View style={styles.mealChips}>
          {MEALS.map((m) => (
            <Chip key={m.value} label={t(`meals.${m.value}`)} selected={meal === m.value} onPress={() => setMeal(m.value)} />
          ))}
        </View>

        <Button
          label={entry ? t('portion.saveChanges') : t('portion.addTo', { meal: t(`meals.${meal}`), kcal: Math.round(n.kcal) })}
          onPress={onSave}
          disabled={grams <= 0}
        />
        {entry && <Button label={t('portion.removeFromLog')} variant="danger" onPress={onDelete} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{grams.toFixed(grams < 10 ? 1 : 0)} g</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  name: { color: c.text, fontSize: 24, fontWeight: '800' },
  muted: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  label: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  amount: { gap: Spacing.md },
  gramsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.xs },
  gramsInput: {
    color: c.text,
    fontSize: 48,
    fontWeight: '800',
    minWidth: 120,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    borderBottomWidth: 2,
    borderBottomColor: c.accent,
    paddingVertical: 0,
  },
  unit: { color: c.textSecondary, fontSize: 22, fontWeight: '700' },
  chips: { gap: Spacing.sm },
  nutrition: { gap: Spacing.lg },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm },
  kcal: { color: c.text, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kcalUnit: { color: c.textSecondary, fontSize: 18, fontWeight: '700' },
  macros: { flexDirection: 'row', justifyContent: 'space-around' },
  macro: { alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  macroValue: { color: c.text, fontSize: 18, fontWeight: '800' },
  mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
}));
