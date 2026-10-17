import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Card } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { saveProfile } from '@/db/profile';
import type { useBody } from '@/hooks/use-body';
import { formatWeight, signed } from '@/lib/workout-math';

type Body = ReturnType<typeof useBody>;

const MIN_WEIGH_INS = 5;

/** Gradient call-to-action shown until the user has set a goal. */
export function SetupCard() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable onPress={() => router.push('/onboarding')} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
      <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.setup}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.setupTitle}>{t('plan.setTitle')}</Text>
          <Text style={styles.setupBody}>{t('plan.setBody')}</Text>
        </View>
        <View style={styles.setupArrow}>
          <Ionicons name="arrow-forward" size={22} color={c.accent} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Daily targets with the goal, plus the weight-trend check-in when there is one. */
export function PlanCard({ body }: { body: Body }) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
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
          <Ionicons name="flag" size={14} color={c.accent} />
          <Text style={styles.goalText}>{t(`goals.${profile.goal}.title`)}</Text>
        </View>
        <Pressable onPress={() => router.push('/onboarding')} hitSlop={10}>
          <Text style={styles.link}>{t('plan.edit')}</Text>
        </Pressable>
      </View>

      <View style={styles.calories}>
        <Text style={styles.kcal}>{targets.calories.toLocaleString()}</Text>
        <Text style={styles.kcalUnit}>{t('plan.kcalPerDay')}</Text>
      </View>
      <View style={styles.macros}>
        <MacroBar label={t('macros.protein')} grams={targets.protein} kcal={targets.protein * 4} total={targets.calories} color={c.macros.protein} />
        <MacroBar label={t('macros.carbs')} grams={targets.carbs} kcal={targets.carbs * 4} total={targets.calories} color={c.macros.carbs} />
        <MacroBar label={t('macros.fat')} grams={targets.fat} kcal={targets.fat * 9} total={targets.calories} color={c.macros.fat} />
      </View>
      <Text style={styles.muted}>
        {t('plan.waterLine', { water: (targets.waterMl / 1000).toFixed(1), maintenance: targets.maintenance.toLocaleString() })}
        {profile.calorieAdjustment ? t('plan.tuned', { kcal: signed(profile.calorieAdjustment) }) : ''}
      </Text>

      {checkIn ? (
        <View style={[styles.checkIn, checkIn.kind === 'on_track' && styles.checkInGood]}>
          <Ionicons
            name={checkIn.kind === 'on_track' ? 'checkmark-circle' : 'analytics'}
            size={20}
            color={checkIn.kind === 'on_track' ? c.success : c.warning}
          />
          <View style={{ flex: 1, gap: Spacing.sm }}>
            <Text style={styles.checkInText}>{t(`checkIn.${checkIn.reason}`, { change: checkIn.change, kcal: Math.abs(checkIn.delta) })}</Text>
            {checkIn.kind !== 'on_track' && (
              <Pressable onPress={applyCheckIn} style={styles.apply}>
                <Text style={styles.applyText}>{t('plan.apply', { kcal: signed(checkIn.delta) })}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.checkIn}>
          <Ionicons name="time-outline" size={20} color={c.textSecondary} />
          <Text style={[styles.checkInText, { flex: 1, color: c.textSecondary }]}>
            {t('plan.weighInFirst', { count: Math.min(weighIns, MIN_WEIGH_INS), total: MIN_WEIGH_INS })}
          </Text>
        </View>
      )}
    </Card>
  );
}

function MacroBar({ label, grams, kcal, total, color }: { label: string; grams: number; kcal: number; total: number; color: string }) {
  const styles = useStyles();
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
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const { latest, average, rate, weights } = body;
  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.weightValue}>
            {latest ? `${formatWeight(latest.weight)} kg` : '–'}
          </Text>
          <Text style={styles.muted}>
            {average ? t('weight.avg7', { kg: formatWeight(Math.round(average * 10) / 10) }) : t('weight.none')}
            {rate ? ` · ${t('weight.perWeek', { kg: signed((Math.round(rate.kgPerWeek * 100) / 100 || 0).toFixed(2)) })}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/weight')} style={styles.logButton}>
          <Ionicons name="add" size={18} color={c.accentText} />
          <Text style={styles.logText}>{t('common.log')}</Text>
        </Pressable>
      </View>
      {weights.length > 1 ? (
        <WeightChart entries={weights} />
      ) : (
        <Text style={styles.muted}>{t('weight.logFew')}</Text>
      )}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  setup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg },
  setupTitle: { color: c.accentText, fontSize: 20, fontWeight: '800' },
  setupBody: { color: c.accentText, fontSize: 14, opacity: 0.8 },
  setupArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accentText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: { gap: Spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.accentSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  goalText: { color: c.accent, fontWeight: '800', fontSize: 13 },
  link: { color: c.accent, fontWeight: '700', fontSize: 15 },
  calories: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  kcal: { color: c.text, fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  kcalUnit: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  macros: { flexDirection: 'row', gap: Spacing.md },
  macro: { flex: 1, gap: 6 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  macroValue: { color: c.text, fontSize: 13, fontWeight: '800' },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 3 },
  muted: { color: c.textSecondary, fontSize: 13 },
  checkIn: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  checkInGood: { backgroundColor: c.dark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(15, 157, 104, 0.10)' },
  checkInText: { color: c.text, fontSize: 14, lineHeight: 20 },
  apply: {
    alignSelf: 'flex-start',
    backgroundColor: c.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  applyText: { color: c.accentText, fontWeight: '800' },
  weightValue: { color: c.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logText: { color: c.accentText, fontWeight: '800' },
}));
