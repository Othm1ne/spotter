import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { IconName } from '@/components/icon';
import { BarChart } from '@/components/bar-chart';
import { Segmented } from '@/components/segmented';
import { Button, Card, StatTile } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getWater, intakeByDay, listEntries, topFoods, waterSince, type FoodEntry } from '@/db/food';
import { getSetting, setSetting } from '@/db/settings';
import { useAskCoach } from '@/hooks/use-ask-coach';
import { useBody } from '@/hooks/use-body';
import { mealTitle, sum, type Meal } from '@/lib/food';
import {
  dayReviewPrompt,
  logSignature,
  parseReview,
  REVIEW_SYSTEM,
  weekReviewPrompt,
  weekStats,
  type DayIntake,
  type Review,
  type TopFood,
} from '@/lib/nutrition-review';
import { addDays, dayKey, parseDayKey } from '@/lib/stats';
import { aiChat, aiErrorMessage } from '@/services/ai';

type Kind = 'Today' | 'This week';

const FOLLOW_UPS: Record<Kind, string[]> = {
  Today: ['What should I eat for the rest of today?', 'Give me a high-protein snack under 300 kcal'],
  'This week': ['How can I hit my protein more easily?', 'Plan a full day of eating for my targets'],
};

/** Coach review of today's or the last 7 days' eating: hard numbers first, then the AI's take. */
export default function NutritionReviewScreen() {
  const db = useSQLiteContext();
  const body = useBody();
  const ask = useAskCoach();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'week' ? 'This week' : 'Today');
  const [today, setToday] = useState<FoodEntry[]>([]);
  const [waterToday, setWaterToday] = useState(0);
  const [week, setWeek] = useState<{ days: DayIntake[]; water: number[]; top: TopFood[] }>({ days: [], water: [], top: [] });
  const [reviews, setReviews] = useState<Partial<Record<Kind, Review>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const now = new Date();
        const key = dayKey(now);
        const from = dayKey(addDays(now, -7));
        const [entries, water, days, waters, top] = await Promise.all([
          listEntries(db, key),
          getWater(db, key),
          intakeByDay(db, from),
          waterSince(db, from),
          topFoods(db, from),
        ]);
        // The week review covers the 7 finished days before today.
        const past = days.filter((d) => d.day < key);
        setTodayKey(key);
        setToday(entries);
        setWaterToday(water);
        setWeek({ days: past, water: waters, top });
        // Reuse a saved review while the food log hasn't changed since.
        const cached: Partial<Record<Kind, Review>> = {};
        for (const [k, sig] of [
          ['Today', logSignature(entries)],
          ['This week', logSignature(past)],
        ] as const) {
          const saved = await getSetting(db, cacheKey(k, key));
          if (!saved) continue;
          const parsed = JSON.parse(saved) as { sig: string; review: Review };
          if (parsed.sig === sig) cached[k] = parsed.review;
        }
        setReviews(cached);
      })();
    }, [db])
  );

  const { profile, targets } = body;
  if (!body.loaded) return <View style={styles.screen} />;
  if (!profile || !targets) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.title}>Set your goal first</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>The review compares what you eat with your targets.</Text>
        <Button label="Set your goal" onPress={() => router.push('/onboarding')} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const stats = weekStats(week.days, targets, week.water);
  const eaten = sum(today);
  const enough = kind === 'Today' ? today.length >= 1 : stats.daysLogged >= 2;
  const review = reviews[kind];

  async function getReview() {
    if (!profile || !targets || loading) return;
    setLoading(true);
    setError(null);
    try {
      const prompt =
        kind === 'Today'
          ? dayReviewPrompt(
              profile,
              targets,
              today.map((e) => ({ name: e.name, meal: mealTitle(e.meal as Meal), grams: e.grams, kcal: e.kcal, protein: e.protein })),
              waterToday,
              new Date().getHours()
            )
          : weekReviewPrompt(profile, targets, stats, week.days, week.top);
      const raw = await aiChat(
        [
          { role: 'system', content: REVIEW_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { json: true, maxTokens: 1200 }
      );
      const parsed = parseReview(raw);
      if (!parsed) throw new Error('invalid');
      setReviews((r) => ({ ...r, [kind]: parsed }));
      const sig = kind === 'Today' ? logSignature(today) : logSignature(week.days);
      await setSetting(db, cacheKey(kind, todayKey), JSON.stringify({ sig, review: parsed }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }


  const bars = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(addDays(parseDayKey(todayKey || dayKey(new Date())), i - 7));
    const intake = week.days.find((d) => d.day === day);
    return {
      key: day,
      label: parseDayKey(day).toLocaleDateString(undefined, { weekday: 'narrow' }),
      value: Math.round(intake?.kcal ?? 0),
    };
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Segmented options={['Today', 'This week'] as Kind[]} value={kind} onChange={setKind} />

      {kind === 'Today' ? (
        <View style={styles.tiles}>
          <StatTile value={`${Math.round(eaten.kcal).toLocaleString()}`} label={`kcal of ${targets.calories.toLocaleString()}`} style={styles.tile} />
          <StatTile value={`${Math.round(eaten.protein)} g`} label={`protein of ${targets.protein} g`} style={styles.tile} />
          <StatTile value={`${(waterToday / 1000).toFixed(1)} L`} label={`water of ${(targets.waterMl / 1000).toFixed(1)} L`} style={styles.tile} />
        </View>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile value={stats.daysLogged ? stats.avgKcal.toLocaleString() : '–'} label={`avg kcal · target ${targets.calories.toLocaleString()}`} style={styles.tile} />
            <StatTile value={stats.daysLogged ? `${stats.avgProtein} g` : '–'} label={`avg protein · target ${targets.protein} g`} style={styles.tile} />
          </View>
          <View style={styles.tiles}>
            <StatTile value={`${stats.proteinDays} / ${stats.daysLogged}`} label="days protein hit" style={styles.tile} />
            <StatTile value={`${stats.onTargetDays} / ${stats.daysLogged}`} label="days on calorie target" style={styles.tile} />
          </View>
          <Card>
            <Text style={styles.cardTitle}>Calories, last 7 days</Text>
            <BarChart
              bars={bars}
              goal={targets.calories}
              height={130}
              describe={(b) => `${parseDayKey(b.key).toLocaleDateString(undefined, { weekday: 'long' })}: ${b.value.toLocaleString()} kcal`}
            />
          </Card>
          <Text style={styles.small}>Days with fewer than 2 foods logged are left out of the averages.</Text>
        </>
      )}

      {review ? (
        <Animated.View entering={FadeIn} style={{ gap: Spacing.md }}>
          <Card style={styles.review}>
            <View style={styles.reviewHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.accent} />
              <Text style={styles.label}>COACH REVIEW</Text>
            </View>
            <Text style={styles.headline}>{review.headline}</Text>
            <Section icon="checkmark-circle" color={Colors.success} title="What went well" items={review.wins} />
            <Section icon="arrow-up-circle" color={Colors.warning} title="To improve" items={review.fixes} />
            <Section icon="restaurant" color={Colors.accent} title={kind === 'Today' ? 'For the rest of today' : 'Easy ideas'} items={review.ideas} />
          </Card>
          <Pressable onPress={getReview} disabled={loading} hitSlop={8} style={styles.refresh}>
            <Ionicons name="refresh" size={14} color={Colors.textSecondary} />
            <Text style={styles.small}>{loading ? 'Updating…' : 'New review'}</Text>
          </Pressable>
        </Animated.View>
      ) : loading ? (
        <Card style={styles.loading}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.muted}>Your coach is reading your log…</Text>
        </Card>
      ) : enough ? (
        <Button label={kind === 'Today' ? 'Review my day' : 'Review my week'} onPress={getReview} />
      ) : (
        <Card style={styles.loading}>
          <Ionicons name="restaurant-outline" size={28} color={Colors.textSecondary} />
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {kind === 'Today' ? 'Log something today to get a review.' : 'Log your food on at least 2 days to get a weekly review.'}
          </Text>
        </Card>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>ASK THE COACH</Text>
      {FOLLOW_UPS[kind].map((q) => (
        <Pressable key={q} onPress={() => ask(q)} style={({ pressed }) => [styles.question, pressed && { opacity: 0.7 }]}>
          <Text style={styles.questionText}>{q}</Text>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.accent} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const cacheKey = (kind: Kind, day: string) => `review_${kind === 'Today' ? 'day' : 'week'}_${day}`;

function Section({ icon, color, title, items }: { icon: IconName; color: string; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  small: { color: Colors.textSecondary, fontSize: 12 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: Spacing.xs },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1 },
  review: { gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headline: { color: Colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  item: { flexDirection: 'row', gap: Spacing.sm },
  itemText: { color: Colors.text, fontSize: 15, lineHeight: 21, flex: 1, opacity: 0.9 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' },
  loading: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  questionText: { color: Colors.text, fontSize: 15, flex: 1 },
});
