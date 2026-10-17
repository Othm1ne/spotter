import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Chip, OptionCard } from '@/components/option-card';
import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui';
import { PickerField, PickerSheet, range, Wheel } from '@/components/picker-field';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { listWeights, logWeight } from '@/db/body';
import { getProfile, saveProfile } from '@/db/profile';
import { computeTargets } from '@/lib/nutrition';
import {
  ACTIVITIES,
  EQUIPMENTS,
  EXPERIENCES,
  GOALS,
  LIMITATIONS,
  type Profile,
} from '@/lib/profile';

const DEFAULTS: Profile = {
  name: '',
  sex: 'male',
  birthYear: new Date().getFullYear() - 25,
  heightCm: 175,
  weightKg: 75,
  goal: 'build_muscle',
  activity: 'light',
  experience: 'beginner',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: 'full_gym',
  limitations: [],
  notes: '',
  calorieAdjustment: 0,
};

const THIS_YEAR = new Date().getFullYear();
const YEARS = range(THIS_YEAR - 90, THIS_YEAR - 13);
const HEIGHTS = range(120, 230);
const KILOS = range(30, 250);
const TENTHS = range(0, 9);

const STEPS = ['welcome', 'goal', 'body', 'activity', 'training', 'setup', 'plan'] as const;

/** Seven short steps that turn your goal and body into a plan. Also used to edit the profile later. */
export default function OnboardingScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(DEFAULTS);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<'birthYear' | 'height' | 'weight' | null>(null);

  useEffect(() => {
    (async () => {
      const [saved, weights] = await Promise.all([getProfile(db), listWeights(db)]);
      // Editing: start from what we know, with the latest weigh-in as current weight.
      if (saved) {
        setExisting(true);
        setProfile({ ...saved, weightKg: weights.at(-1)?.weight ?? saved.weightKg });
      }
    })();
  }, [db]);

  const update = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const current = STEPS[step];
  const canContinue = current !== 'welcome' || profile.name.trim().length > 0;

  function next() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    const weights = await listWeights(db);
    // Changing goal resets any earlier calorie fine-tuning, since it was tuned for the old goal.
    const saved = await getProfile(db);
    const final = { ...profile, name: profile.name.trim(), calorieAdjustment: saved?.goal === profile.goal ? profile.calorieAdjustment : 0 };
    await saveProfile(db, final);
    if (weights.at(-1)?.weight !== profile.weightKg) await logWeight(db, profile.weightKg, new Date());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const targets = computeTargets(profile, profile.weightKg, new Date());
  const kilos = Math.floor(profile.weightKg + 1e-6);
  const tenths = Math.round((profile.weightKg - kilos) * 10) % 10;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={back} hitSlop={12} style={styles.topButton} accessibilityLabel={step === 0 ? t('common.close') : t('common.back')}>
          <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={24} color={c.text} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
        <Text style={styles.stepCount}>
          {step + 1}/{STEPS.length}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View key={current} entering={FadeInRight.duration(260)} style={{ gap: Spacing.md }}>
            {current === 'welcome' && (
              <>
                <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
                  <Ionicons name="barbell" size={40} color={c.accentText} />
                </LinearGradient>
                <Text style={styles.title}>{existing ? t('onboarding.update') : t('onboarding.build')}</Text>
                <Text style={styles.subtitle}>
                  {t('onboarding.intro')}
                </Text>
                <Text style={styles.fieldLabel}>{t('onboarding.nameLabel')}</Text>
                <TextInput
                  value={profile.name}
                  onChangeText={(name) => update({ name })}
                  placeholder={t('onboarding.namePlaceholder')}
                  placeholderTextColor={c.textSecondary}
                  style={styles.input}
                  autoFocus={!existing}
                  returnKeyType="next"
                  onSubmitEditing={() => canContinue && next()}
                />
              </>
            )}

            {current === 'goal' && (
              <>
                <Text style={styles.title}>{t('onboarding.goalTitle')}</Text>
                {GOALS.map((g) => (
                  <OptionCard
                    key={g.value}
                    title={t(`goals.${g.value}.title`)}
                    subtitle={t(`goals.${g.value}.subtitle`)}
                    icon={g.icon}
                    selected={profile.goal === g.value}
                    onPress={() => update({ goal: g.value })}
                  />
                ))}
              </>
            )}

            {current === 'body' && (
              <>
                <Text style={styles.title}>{t('onboarding.bodyTitle')}</Text>
                <Text style={styles.subtitle}>{t('onboarding.bodySub')}</Text>
                <View style={styles.row}>
                  {(['male', 'female'] as const).map((sex) => (
                    <View key={sex} style={{ flex: 1 }}>
                      <OptionCard
                        compact
                        title={t(`onboarding.sex.${sex}`)}
                        icon={sex === 'male' ? 'male' : 'female'}
                        selected={profile.sex === sex}
                        onPress={() => update({ sex })}
                      />
                    </View>
                  ))}
                </View>
                <PickerField label={t('onboarding.bornIn')} value={String(profile.birthYear)} onPress={() => setPicking('birthYear')} />
                <PickerField label={t('onboarding.height')} value={`${profile.heightCm} cm`} onPress={() => setPicking('height')} />
                <PickerField label={t('onboarding.weight')} value={`${profile.weightKg.toFixed(1)} kg`} onPress={() => setPicking('weight')} />
              </>
            )}

            {current === 'activity' && (
              <>
                <Text style={styles.title}>{t('onboarding.activityTitle')}</Text>
                <Text style={styles.subtitle}>{t('onboarding.activitySub')}</Text>
                {ACTIVITIES.map((a) => (
                  <OptionCard
                    key={a.value}
                    title={t(`activities.${a.value}.title`)}
                    subtitle={t(`activities.${a.value}.subtitle`)}
                    selected={profile.activity === a.value}
                    onPress={() => update({ activity: a.value })}
                  />
                ))}
              </>
            )}

            {current === 'training' && (
              <>
                <Text style={styles.title}>{t('onboarding.trainingTitle')}</Text>
                {EXPERIENCES.map((e) => (
                  <OptionCard
                    key={e.value}
                    title={t(`experiences.${e.value}.title`)}
                    subtitle={t(`experiences.${e.value}.subtitle`)}
                    selected={profile.experience === e.value}
                    onPress={() => update({ experience: e.value })}
                  />
                ))}
                <Text style={styles.fieldLabel}>{t('onboarding.perWeek')}</Text>
                <View style={styles.chips}>
                  {[2, 3, 4, 5, 6].map((d) => (
                    <Chip key={d} label={String(d)} selected={profile.daysPerWeek === d} onPress={() => update({ daysPerWeek: d })} />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{t('onboarding.timePer')}</Text>
                <View style={styles.chips}>
                  {[30, 45, 60, 75, 90].map((m) => (
                    <Chip
                      key={m}
                      label={t('common.minutes', { count: m })}
                      selected={profile.sessionMinutes === m}
                      onPress={() => update({ sessionMinutes: m })}
                    />
                  ))}
                </View>
              </>
            )}

            {current === 'setup' && (
              <>
                <Text style={styles.title}>{t('onboarding.whereTitle')}</Text>
                {EQUIPMENTS.map((e) => (
                  <OptionCard
                    key={e.value}
                    title={t(`equipments.${e.value}.title`)}
                    subtitle={t(`equipments.${e.value}.subtitle`)}
                    icon={e.icon}
                    selected={profile.equipment === e.value}
                    onPress={() => update({ equipment: e.value })}
                  />
                ))}
                <Text style={styles.fieldLabel}>{t('onboarding.careful')}</Text>
                <View style={styles.chips}>
                  {LIMITATIONS.map((l) => {
                    const on = profile.limitations.includes(l);
                    return (
                      <Chip
                        key={l}
                        label={t(`limitations.${l}`)}
                        selected={on}
                        onPress={() =>
                          update({ limitations: on ? profile.limitations.filter((x) => x !== l) : [...profile.limitations, l] })
                        }
                      />
                    );
                  })}
                </View>
                <TextInput
                  value={profile.notes}
                  onChangeText={(notes) => update({ notes })}
                  placeholder={t('onboarding.notesPlaceholder')}
                  placeholderTextColor={c.textSecondary}
                  style={[styles.input, styles.notes]}
                  multiline
                />
              </>
            )}

            {current === 'plan' && (
              <>
                <Text style={styles.title}>
                  {profile.name.trim() ? t('onboarding.planNamed', { name: profile.name.trim() }) : t('onboarding.plan')}
                </Text>
                <Text style={styles.subtitle}>
                  {t('onboarding.planSub', { goal: t(`goals.${profile.goal}.title`), days: profile.daysPerWeek })}
                </Text>
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                  <LinearGradient colors={[c.accentSoft, c.surface]} style={styles.planCard}>
                    <ProgressRing size={170} stroke={14} progress={1} color={c.accent}>
                      <Text style={styles.kcal}>{targets.calories}</Text>
                      <Text style={styles.kcalLabel}>{t('plan.kcalPerDay')}</Text>
                    </ProgressRing>
                    <View style={styles.macros}>
                      <Macro label={t('macros.protein')} grams={targets.protein} color={c.macros.protein} />
                      <Macro label={t('macros.carbs')} grams={targets.carbs} color={c.macros.carbs} />
                      <Macro label={t('macros.fat')} grams={targets.fat} color={c.macros.fat} />
                    </View>
                  </LinearGradient>
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.explain}>
                  <Explain
                    icon="flash"
                    text={`${t('onboarding.burn', { kcal: targets.maintenance })} ${t(`onboarding.reason.${calorieReason(profile.goal, targets.calories - targets.maintenance)}`, { kcal: Math.abs(targets.calories - targets.maintenance) })}`}
                  />
                  <Explain icon="fish" text={t('onboarding.protein', { grams: targets.protein })} />
                  <Explain icon="water" text={t('onboarding.water', { liters: (targets.waterMl / 1000).toFixed(1) })} />
                  <Explain icon="trending-up" text={t('onboarding.weighIn')} />
                </Animated.View>
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {current === 'plan' ? (
            <Button
              label={saving ? t('onboarding.saving') : existing ? t('onboarding.savePlan') : t('onboarding.go')}
              onPress={finish}
              disabled={saving}
            />
          ) : (
            <Button label={t('onboarding.continue')} onPress={next} disabled={!canContinue} />
          )}
        </View>
      </KeyboardAvoidingView>
      <PickerSheet
        visible={picking !== null}
        title={picking === 'birthYear' ? t('onboarding.bornIn') : picking === 'height' ? t('onboarding.height') : t('onboarding.weight')}
        onClose={() => setPicking(null)}>
        {picking === 'birthYear' && (
          <Wheel values={YEARS} value={profile.birthYear} onChange={(birthYear) => update({ birthYear })} />
        )}
        {picking === 'height' && (
          <Wheel values={HEIGHTS} value={profile.heightCm} onChange={(heightCm) => update({ heightCm })} suffix="cm" />
        )}
        {picking === 'weight' && (
          <>
            <Wheel values={KILOS} value={kilos} onChange={(k) => update({ weightKg: Math.round(k * 10 + tenths) / 10 })} />
            <Wheel
              values={TENTHS}
              value={tenths}
              onChange={(tenth) => update({ weightKg: Math.round(kilos * 10 + tenth) / 10 })}
              format={(tenth) => `.${tenth}`}
              suffix="kg"
            />
          </>
        )}
      </PickerSheet>
    </SafeAreaView>
  );
}

/** Why the calorie target differs from maintenance: an `onboarding.reason.*` key. */
function calorieReason(goal: Profile['goal'], diff: number) {
  if (diff < -20) return 'deficit';
  if (diff > 20) return 'surplus';
  return goal === 'maintain' ? 'maintain' : 'fits';
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{grams} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function Explain({ icon, text }: { icon: string; text: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.explainRow}>
      <Ionicons name={icon as 'flash'} size={18} color={c.accent} style={{ marginTop: 2 }} />
      <Text style={styles.explainText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },
  stepCount: { color: c.textSecondary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  logo: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: Spacing.sm },
  subtitle: { color: c.textSecondary, fontSize: 16, lineHeight: 22 },
  fieldLabel: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: Spacing.md },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 56,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  notes: { height: 90, paddingTop: Spacing.md, fontSize: 16, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  planCard: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.xl, borderWidth: 1, borderColor: c.border },
  kcal: { color: c.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  kcalLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  macros: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around' },
  macro: { alignItems: 'center', gap: 2 },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  macroValue: { color: c.text, fontSize: 20, fontWeight: '800' },
  macroLabel: { color: c.textSecondary, fontSize: 13 },
  explain: { gap: Spacing.md, backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  explainRow: { flexDirection: 'row', gap: Spacing.md },
  explainText: { color: c.text, fontSize: 15, lineHeight: 21, flex: 1 },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
}));
