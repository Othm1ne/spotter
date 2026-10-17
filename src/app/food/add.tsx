import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useT } from '@/i18n';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { Chip } from '@/components/option-card';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import {
  getFood,
  getFoodByBarcode,
  getSuggestions,
  logFood,
  logQuick,
  saveFood,
  searchSavedFoods,
  type Food,
} from '@/db/food';
import { MEALS, mealForTime, per100, sum, type EstimatedItem, type FoodInput, type Meal } from '@/lib/food';
import { parseNumber } from '@/lib/workout-math';
import { aiErrorMessage } from '@/services/ai';
import { estimateMeal, foodErrorMessage, productByBarcode, searchOpenFoodFacts } from '@/services/food-api';

const MODES = ['Search', 'Describe', 'Scan', 'Quick'] as const;
type Mode = (typeof MODES)[number];

/** Default amount for one-tap adds: what you had last time, else one serving, else 100 g. */
const defaultGrams = (f: Food) => f.last_grams ?? f.serving_g ?? 100;

export default function AddFoodScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ day?: string; meal?: Meal }>();
  const day = params.day!;
  const [meal, setMeal] = useState<Meal>(params.meal ?? mealForTime(new Date()));
  const [mode, setMode] = useState<Mode>('Search');

  // Search
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Food[]>([]);
  const [online, setOnline] = useState<FoodInput[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<{ usual: Food[]; favorites: Food[]; recent: Food[] }>({
    usual: [],
    favorites: [],
    recent: [],
  });

  // Describe
  const [description, setDescription] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<(EstimatedItem & { keep: boolean; gramsText: string })[] | null>(null);

  // Quick
  const [quick, setQuick] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<
    { kind: 'idle' } | { kind: 'looking'; code: string } | { kind: 'missing'; code: string }
  >({ kind: 'idle' });
  const [typedCode, setTypedCode] = useState('');

  useFocusEffect(
    useCallback(() => {
      getSuggestions(db, meal).then(setSuggestions);
    }, [db, meal])
  );

  async function onQueryChange(text: string) {
    setQuery(text);
    setOnline(null);
    setSaved(text.trim().length >= 2 ? await searchSavedFoods(db, text) : []);
  }

  async function searchOnline() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setError(null);
    try {
      setOnline(await searchOpenFoodFacts(q));
    } catch (e) {
      setError(foodErrorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  async function openOnline(food: FoodInput) {
    const id = await saveFood(db, food);
    router.push({ pathname: '/food/[id]', params: { id: String(id), day, meal } });
  }

  async function onScan(code: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setScanStatus({ kind: 'looking', code });
    try {
      // Products scanned before are already on the phone: instant, and works offline.
      const local = await getFoodByBarcode(db, code);
      let id = local?.id ?? null;
      if (id === null) {
        const product = await productByBarcode(code);
        if (product) id = await saveFood(db, product);
      }
      if (id === null) {
        setScanStatus({ kind: 'missing', code });
        return;
      }
      setScanStatus({ kind: 'idle' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/food/[id]', params: { id: String(id), day, meal } });
    } catch (e) {
      setScanStatus({ kind: 'idle' });
      setError(foodErrorMessage(e));
    }
  }

  async function quickAdd(food: Food) {
    await logFood(db, food, defaultGrams(food), day, meal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setJustAdded(t('addFood.added', { name: food.name }));
    setTimeout(() => setJustAdded(null), 1800);
    getSuggestions(db, meal).then(setSuggestions);
  }

  async function runEstimate() {
    if (!description.trim() || estimating) return;
    setEstimating(true);
    setError(null);
    try {
      const items = await estimateMeal(description.trim());
      if (items.length === 0) setError(t('addFood.notRecognised'));
      setEstimate(items.map((i) => ({ ...i, keep: true, gramsText: String(Math.round(i.grams)) })));
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setEstimating(false);
    }
  }

  /** An estimated item resized to the grams typed by the user. */
  function resized(item: EstimatedItem & { gramsText: string }) {
    const grams = parseNumber(item.gramsText) ?? item.grams;
    const f = grams / item.grams;
    return { ...item, grams, kcal: item.kcal * f, protein: item.protein * f, carbs: item.carbs * f, fat: item.fat * f };
  }

  async function addEstimate() {
    const items = (estimate ?? []).filter((i) => i.keep).map(resized);
    for (const item of items) {
      const id = await saveFood(db, { name: item.name, brand: null, barcode: null, servingG: null, source: 'ai', ...per100(item) });
      const food = await getFood(db, id);
      if (food) await logFood(db, food, item.grams, day, meal);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  }

  async function addQuick() {
    const kcal = parseNumber(quick.kcal);
    if (kcal === null) return;
    await logQuick(
      db,
      quick.name.trim() || t('addFood.quickName'),
      { kcal, protein: parseNumber(quick.protein) ?? 0, carbs: parseNumber(quick.carbs) ?? 0, fat: parseNumber(quick.fat) ?? 0 },
      day,
      meal
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  }

  const kept = (estimate ?? []).filter((i) => i.keep).map(resized);
  const keptTotal = sum(kept);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('screens.addFood') }} />
      <View style={styles.top}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meals}>
          {MEALS.map((m) => (
            <Chip key={m.value} label={t(`meals.${m.value}`)} selected={meal === m.value} onPress={() => setMeal(m.value)} />
          ))}
        </ScrollView>
        <View style={{ alignItems: 'center' }}>
          <Segmented
            options={MODES}
            format={(m) => t(`addFood.mode.${m}`)}
            value={mode}
            onChange={(m) => {
              setError(null);
              setMode(m);
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={c.warning} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {mode === 'Search' && (
          <>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={c.textSecondary} />
              <TextInput
                value={query}
                onChangeText={onQueryChange}
                onSubmitEditing={searchOnline}
                placeholder={t('addFood.searchPlaceholder')}
                placeholderTextColor={c.textSecondary}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {query.trim().length < 2 ? (
              <>
                <FoodSection
                  title={t('addFood.usual', { meal: t(`meals.${meal}`).toLowerCase() })} foods={suggestions.usual} day={day} meal={meal} onQuickAdd={quickAdd} />
                <FoodSection title={t('addFood.favorites')} foods={suggestions.favorites} day={day} meal={meal} onQuickAdd={quickAdd} />
                <FoodSection title={t('addFood.recent')} foods={suggestions.recent} day={day} meal={meal} onQuickAdd={quickAdd} />
                {suggestions.recent.length === 0 && (
                  <Text style={styles.empty}>
                    {t('addFood.emptyHint')}
                  </Text>
                )}
              </>
            ) : (
              <>
                <FoodSection title={t('addFood.onPhone')} foods={saved} day={day} meal={meal} onQuickAdd={quickAdd} />
                {online === null ? (
                  <Button
                    label={searching ? t('addFood.searching') : t('addFood.searchOnline', { query: query.trim() })}
                    variant="secondary"
                    onPress={searchOnline}
                    disabled={searching}
                  />
                ) : (
                  <>
                    <Text style={styles.section}>{t('addFood.onlineResults')}</Text>
                    {online.length === 0 && <Text style={styles.empty}>{t('addFood.noProducts')}</Text>}
                    {online.map((f, i) => (
                      <Pressable key={`${f.barcode}-${i}`} onPress={() => openOnline(f)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text style={styles.muted} numberOfLines={1}>
                            {f.brand ? `${f.brand} · ` : ''}
                            {t('addFood.onlineLine', { kcal: Math.round(f.kcal), protein: f.protein.toFixed(1) })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                      </Pressable>
                    ))}
                  </>
                )}
                <Pressable
                  onPress={() => {
                    setDescription(query.trim());
                    setMode('Describe');
                  }}
                  style={styles.aiHint}>
                  <Ionicons name="sparkles" size={16} color={c.accent} />
                  <Text style={styles.aiHintText}>{t('addFood.aiHint', { query: query.trim() })}</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {mode === 'Scan' && (
          <>
            <BarcodeScanner active={scanStatus.kind !== 'looking'} onScan={onScan} />
            {scanStatus.kind === 'idle' && <Text style={styles.empty}>{t('addFood.pointCamera')}</Text>}
            {scanStatus.kind === 'looking' && (
              <View style={styles.scanRow}>
                <ActivityIndicator color={c.accent} />
                <Text style={styles.muted}>{t('addFood.lookingUp', { code: scanStatus.code })}</Text>
              </View>
            )}
            <Text style={styles.label}>{t('addFood.typeCode')}</Text>
            <View style={styles.codeRow}>
              <TextInput
                value={typedCode}
                onChangeText={(text) => setTypedCode(text.replace(/\D/g, ''))}
                placeholder={t('addFood.codePlaceholder')}
                placeholderTextColor={c.textSecondary}
                keyboardType="number-pad"
                maxLength={14}
                returnKeyType="search"
                onSubmitEditing={() => typedCode.length >= 8 && onScan(typedCode)}
                style={[styles.input, styles.codeInput]}
                accessibilityLabel={t('addFood.barcodeNumber')}
              />
              <Button
                label={t('addFood.lookUp')}
                variant="secondary"
                onPress={() => onScan(typedCode)}
                disabled={typedCode.length < 8 || scanStatus.kind === 'looking'}
              />
            </View>
            {scanStatus.kind === 'missing' && (
              <>
                <Text style={styles.empty}>
                  {t('addFood.notInDb')}
                </Text>
                <Button label={t('addFood.describeInstead')} variant="secondary" onPress={() => setMode('Describe')} />
              </>
            )}
          </>
        )}

        {mode === 'Describe' && (
          <>
            <Text style={styles.label}>{t('addFood.whatDidYouEat')}</Text>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setEstimate(null);
              }}
              placeholder={t('addFood.describePlaceholder')}
              placeholderTextColor={c.textSecondary}
              style={[styles.input, styles.multiline]}
              multiline
              autoFocus={!description}
            />
            {!estimate && (
              <Button label={estimating ? t('addFood.estimating') : t('addFood.estimate')} onPress={runEstimate} disabled={estimating || !description.trim()} />
            )}
            {estimating && <ActivityIndicator color={c.accent} />}
            {estimate && estimate.length > 0 && (
              <>
                <Text style={styles.section}>{t('addFood.checkAmounts')}</Text>
                {estimate.map((item, i) => {
                  const r = resized(item);
                  return (
                    <View key={i} style={[styles.row, !item.keep && { opacity: 0.4 }]}>
                      <Pressable
                        onPress={() => setEstimate((all) => all!.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                        hitSlop={8}>
                        <Ionicons
                          name={item.keep ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={item.keep ? c.accent : c.textSecondary}
                        />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.muted}>
                          {Math.round(r.kcal)} kcal · P {Math.round(r.protein)} · C {Math.round(r.carbs)} · F {Math.round(r.fat)}
                        </Text>
                      </View>
                      <TextInput
                        value={item.gramsText}
                        onChangeText={(text) => setEstimate((all) => all!.map((x, j) => (j === i ? { ...x, gramsText: text } : x)))}
                        keyboardType="decimal-pad"
                        style={styles.grams}
                        selectTextOnFocus
                      />
                      <Text style={styles.muted}>g</Text>
                    </View>
                  );
                })}
                <Button
                  label={t('addFood.addItems', { count: kept.length, kcal: Math.round(keptTotal.kcal) })}
                  onPress={addEstimate}
                  disabled={kept.length === 0}
                />
                <Text style={styles.empty}>AI estimates are approximate. Adjust the grams if you know them.</Text>
              </>
            )}
          </>
        )}

        {mode === 'Quick' && (
          <>
            <Text style={styles.label}>{t('addFood.nameOptional')}</Text>
            <TextInput
              value={quick.name}
              onChangeText={(name) => setQuick((q) => ({ ...q, name }))}
              placeholder={t('addFood.namePlaceholder')}
              placeholderTextColor={c.textSecondary}
              style={styles.input}
            />
            <View style={styles.quickGrid}>
              {(
                [
                  ['kcal', t('addFood.calories')],
                  ['protein', t('addFood.proteinG')],
                  ['carbs', t('addFood.carbsG')],
                  ['fat', t('addFood.fatG')],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={styles.quickField}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    value={quick[key]}
                    onChangeText={(v) => setQuick((q) => ({ ...q, [key]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.textSecondary}
                    style={styles.input}
                  />
                </View>
              ))}
            </View>
            <Button label={t('addFood.add')} onPress={addQuick} disabled={parseNumber(quick.kcal) === null} />
          </>
        )}
      </ScrollView>

      {justAdded && (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color={c.accentText} />
          <Text style={styles.toastText}>{justAdded}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function FoodSection({
  title,
  foods,
  day,
  meal,
  onQuickAdd,
}: {
  title: string;
  foods: Food[];
  day: string;
  meal: Meal;
  onQuickAdd: (food: Food) => void;
}) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  if (foods.length === 0) return null;
  return (
    <>
      <Text style={styles.section}>{title}</Text>
      {foods.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => router.push({ pathname: '/food/[id]', params: { id: String(f.id), day, meal } })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName} numberOfLines={1}>
              {f.favorite ? '★ ' : ''}
              {f.name}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {f.brand ? `${f.brand} · ` : ''}
              {Math.round(defaultGrams(f))} g · {Math.round((f.kcal * defaultGrams(f)) / 100)} kcal
            </Text>
          </View>
          <Pressable onPress={() => onQuickAdd(f)} hitSlop={8} style={styles.plus} accessibilityLabel={t('addFood.addNamed', { name: f.name })}>
            <Ionicons name="add" size={20} color={c.accentText} />
          </Pressable>
        </Pressable>
      ))}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  top: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  meals: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 80 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 16 },
  section: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowName: { color: c.text, fontSize: 15, fontWeight: '700' },
  muted: { color: c.textSecondary, fontSize: 13 },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: Spacing.md, lineHeight: 19 },
  aiHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  aiHintText: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '700', marginTop: Spacing.xs },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: 16,
  },
  multiline: { height: 110, paddingTop: Spacing.md, textAlignVertical: 'top' },
  grams: {
    width: 64,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: c.surfaceRaised,
    color: c.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  codeInput: { flex: 1, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  scanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickField: { width: '48.5%' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 181, 71, 0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { color: c.text, fontSize: 14, flex: 1 },
  toast: {
    position: 'absolute',
    bottom: Spacing.xxl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toastText: { color: c.accentText, fontWeight: '800', flexShrink: 1 },
}));
