import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { Colors, HeroGradient, Macros, Radius, Spacing } from '@/constants/theme';
import { saveProfile } from '@/db/profile';
import type { useBody } from '@/hooks/use-body';
import { goalTitle } from '@/lib/profile';
import { formatWeight } from '@/lib/workout-math';

type Body = ReturnType<typeof useBody>;

const MIN_WEIGH_INS = 5;

/** Gradient call-to-action shown until the user has set a goal. */
export function SetupCard() {
  return (
    <Pressable onPress={() => router.push('/onboarding')} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
      <LinearGradient colors={HeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.setup}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.setupTitle}>Set your goal</Text>
          <Text style={styles.setupBody}>2 minutes to get your calories, protein and a plan that fits you.</Text>
        </View>
        <View style={styles.setupArrow}>
          <Ionicons name="arrow-forward" size={22} color={Colors.accent} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Daily targets with the goal, plus the weight-trend check-in when there is one. */
export function PlanCard({ body }: { body: Body }) {
  const db = useSQLiteContext();
  const { profile, targets, checkIn } = body;
  if (!profile || !targets) return null;

  async function applyCheckIn() {
    if (!profile || !checkIn) return;
    await saveProfile(db, { ...profile, calorieAdjustment: profile.calorieAdjustment + checkIn.delta });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    body.reload();
  }

  const weighIns = body.weights.length;

  return (
    <Card style={styles.plan}>
      <View style={styles.planHeader}>
        <View style={styles.goalPill}>
          <Ionicons name="flag" size={14} color={Colors.accent} />
          <Text style={styles.goalText}>{goalTitle(profile.goal)}</Text>
        </View>
        <Pressable onPress={() => router.push('/onboarding')} hitSlop={10}>
          <Text style={styles.link}>Edit plan</Text>
        </Pressable>
      </View>

      <View style={styles.calories}>
        <Text style={styles.kcal}>{targets.calories.toLocaleString()}</Text>
        <Text style={styles.kcalUnit}>kcal / day</Text>
      </View>
      <View style={styles.macros}>
        <MacroBar label="Protein" grams={targets.protein} kcal={targets.protein * 4} total={targets.calories} color={Macros.protein} />
        <MacroBar label="Carbs" grams={targets.carbs} kcal={targets.carbs * 4} total={targets.calories} color={Macros.carbs} />
        <MacroBar label="Fat" grams={targets.fat} kcal={targets.fat * 9} total={targets.calories} color={Macros.fat} />
      </View>
      <Text style={styles.muted}>
        Water {(targets.waterMl / 1000).toFixed(1)} L · maintenance {targets.maintenance.toLocaleString()} kcal
        {profile.calorieAdjustment ? ` · tuned ${profile.calorieAdjustment > 0 ? '+' : ''}${profile.calorieAdjustment} kcal` : ''}
      </Text>

      {checkIn ? (
        <View style={[styles.checkIn, checkIn.kind === 'on_track' && styles.checkInGood]}>
          <Ionicons
            name={checkIn.kind === 'on_track' ? 'checkmark-circle' : 'analytics'}
            size={20}
            color={checkIn.kind === 'on_track' ? Colors.success : Colors.warning}
          />
          <View style={{ flex: 1, gap: Spacing.sm }}>
            <Text style={styles.checkInText}>{checkIn.message}</Text>
            {checkIn.kind !== 'on_track' && (
              <Pressable onPress={applyCheckIn} style={styles.apply}>
                <Text style={styles.applyText}>
                  Apply {checkIn.delta > 0 ? '+' : ''}
                  {checkIn.delta} kcal
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.checkIn}>
          <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          <Text style={[styles.checkInText, { flex: 1, color: Colors.textSecondary }]}>
            Weigh in for 2 weeks ({Math.min(weighIns, MIN_WEIGH_INS)}/{MIN_WEIGH_INS} weigh-ins so far) and Spotter will
            check your progress and fine-tune your calories.
          </Text>
        </View>
      )}
    </Card>
  );
}

function MacroBar({ label, grams, kcal, total, color }: { label: string; grams: number; kcal: number; total: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={styles.macroTop}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{grams} g</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.min(100, (kcal / total) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Current weight, weekly change and the trend chart. */
export function BodyWeightCard({ body }: { body: Body }) {
  const { latest, average, rate, weights } = body;
  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.weightValue}>
            {latest ? `${formatWeight(latest.weight)} kg` : '–'}
          </Text>
          <Text style={styles.muted}>
            {average ? `7-day average ${formatWeight(Math.round(average * 10) / 10)} kg` : 'No weigh-ins yet'}
            {rate ? ` · ${rate.kgPerWeek > 0 ? '+' : ''}${(Math.round(rate.kgPerWeek * 100) / 100 || 0).toFixed(2)} kg/week` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/weight')} style={styles.logButton}>
          <Ionicons name="add" size={18} color={Colors.accentText} />
          <Text style={styles.logText}>Log</Text>
        </Pressable>
      </View>
      {weights.length > 1 ? (
        <WeightChart entries={weights} />
      ) : (
        <Text style={styles.muted}>Log your weight a few mornings to see your trend here.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  setup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg },
  setupTitle: { color: Colors.accentText, fontSize: 20, fontWeight: '800' },
  setupBody: { color: Colors.accentText, fontSize: 14, opacity: 0.8 },
  setupArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: { gap: Spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(198, 244, 50, 0.1)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  goalText: { color: Colors.accent, fontWeight: '800', fontSize: 13 },
  link: { color: Colors.accent, fontWeight: '700', fontSize: 15 },
  calories: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  kcal: { color: Colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  kcalUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  macros: { flexDirection: 'row', gap: Spacing.md },
  macro: { flex: 1, gap: 6 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  macroValue: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 3 },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  checkIn: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  checkInGood: { backgroundColor: 'rgba(61, 220, 132, 0.1)' },
  checkInText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  apply: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  applyText: { color: Colors.accentText, fontWeight: '800' },
  weightValue: { color: Colors.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logText: { color: Colors.accentText, fontWeight: '800' },
});
