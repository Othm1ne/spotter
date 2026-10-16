import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, OptionCard } from '@/components/option-card';
import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui';
import { PickerField, PickerSheet, range, Wheel } from '@/components/picker-field';
import { Colors, HeroGradient, Macros, Radius, Spacing } from '@/constants/theme';
import { listWeights, logWeight } from '@/db/body';
import { getProfile, saveProfile } from '@/db/profile';
import { computeTargets } from '@/lib/nutrition';
import {
  ACTIVITIES,
  EQUIPMENTS,
  EXPERIENCES,
  GOALS,
  LIMITATIONS,
  goalTitle,
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
        <Pressable onPress={back} hitSlop={12} style={styles.topButton} accessibilityLabel={step === 0 ? 'Close' : 'Back'}>
          <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={24} color={Colors.text} />
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
                <LinearGradient colors={HeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
                  <Ionicons name="barbell" size={40} color={Colors.accentText} />
                </LinearGradient>
                <Text style={styles.title}>{existing ? 'Update your plan' : "Let's build your plan"}</Text>
                <Text style={styles.subtitle}>
                  Two minutes of questions, then Spotter sets your calories, protein and training around your goal.
                </Text>
                <Text style={styles.fieldLabel}>What should we call you?</Text>
                <TextInput
                  value={profile.name}
                  onChangeText={(name) => update({ name })}
                  placeholder="Your first name"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                  autoFocus={!existing}
                  returnKeyType="next"
                  onSubmitEditing={() => canContinue && next()}
                />
              </>
            )}

            {current === 'goal' && (
              <>
                <Text style={styles.title}>What’s your main goal?</Text>
                {GOALS.map((g) => (
                  <OptionCard
                    key={g.value}
                    title={g.title}
                    subtitle={g.subtitle}
                    icon={g.icon}
                    selected={profile.goal === g.value}
                    onPress={() => update({ goal: g.value })}
                  />
                ))}
              </>
            )}

            {current === 'body' && (
              <>
                <Text style={styles.title}>About your body</Text>
                <Text style={styles.subtitle}>Used to estimate how much energy you burn. It stays on your phone.</Text>
                <View style={styles.row}>
                  {(['male', 'female'] as const).map((sex) => (
                    <View key={sex} style={{ flex: 1 }}>
                      <OptionCard
                        compact
                        title={sex === 'male' ? 'Male' : 'Female'}
                        icon={sex === 'male' ? 'male' : 'female'}
                        selected={profile.sex === sex}
                        onPress={() => update({ sex })}
                      />
                    </View>
                  ))}
                </View>
                <PickerField label="Born in" value={String(profile.birthYear)} onPress={() => setPicking('birthYear')} />
                <PickerField label="Height" value={`${profile.heightCm} cm`} onPress={() => setPicking('height')} />
                <PickerField label="Weight" value={`${profile.weightKg.toFixed(1)} kg`} onPress={() => setPicking('weight')} />
              </>
            )}

            {current === 'activity' && (
              <>
                <Text style={styles.title}>How active is your day?</Text>
                <Text style={styles.subtitle}>Count your job and daily life, plus your workouts.</Text>
                {ACTIVITIES.map((a) => (
                  <OptionCard
                    key={a.value}
                    title={a.title}
                    subtitle={a.subtitle}
                    selected={profile.activity === a.value}
                    onPress={() => update({ activity: a.value })}
                  />
                ))}
              </>
            )}

            {current === 'training' && (
              <>
                <Text style={styles.title}>Your training</Text>
                {EXPERIENCES.map((e) => (
                  <OptionCard
                    key={e.value}
                    title={e.title}
                    subtitle={e.subtitle}
                    selected={profile.experience === e.value}
                    onPress={() => update({ experience: e.value })}
                  />
                ))}
                <Text style={styles.fieldLabel}>Workouts per week</Text>
                <View style={styles.chips}>
                  {[2, 3, 4, 5, 6].map((d) => (
                    <Chip key={d} label={String(d)} selected={profile.daysPerWeek === d} onPress={() => update({ daysPerWeek: d })} />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Time per workout</Text>
                <View style={styles.chips}>
                  {[30, 45, 60, 75, 90].map((m) => (
                    <Chip
                      key={m}
                      label={`${m} min`}
                      selected={profile.sessionMinutes === m}
                      onPress={() => update({ sessionMinutes: m })}
                    />
                  ))}
                </View>
              </>
            )}

            {current === 'setup' && (
              <>
                <Text style={styles.title}>Where do you train?</Text>
                {EQUIPMENTS.map((e) => (
                  <OptionCard
                    key={e.value}
                    title={e.title}
                    subtitle={e.subtitle}
                    icon={e.icon}
                    selected={profile.equipment === e.value}
                    onPress={() => update({ equipment: e.value })}
                  />
                ))}
                <Text style={styles.fieldLabel}>Anything to be careful with?</Text>
                <View style={styles.chips}>
                  {LIMITATIONS.map((l) => {
                    const on = profile.limitations.includes(l);
                    return (
                      <Chip
                        key={l}
                        label={l}
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
                  placeholder="Other notes, e.g. old knee injury, no jumping"
                  placeholderTextColor={Colors.textSecondary}
                  style={[styles.input, styles.notes]}
                  multiline
                />
              </>
            )}

            {current === 'plan' && (
              <>
                <Text style={styles.title}>
                  {profile.name.trim() ? `${profile.name.trim()}, here's your plan` : "Here's your plan"}
                </Text>
                <Text style={styles.subtitle}>
                  Goal: {goalTitle(profile.goal)} · {profile.daysPerWeek} workouts a week
                </Text>
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                  <LinearGradient colors={['#1F2A12', Colors.surface]} style={styles.planCard}>
                    <ProgressRing size={170} stroke={14} progress={1} color={Colors.accent}>
                      <Text style={styles.kcal}>{targets.calories}</Text>
                      <Text style={styles.kcalLabel}>kcal / day</Text>
                    </ProgressRing>
                    <View style={styles.macros}>
                      <Macro label="Protein" grams={targets.protein} color={Macros.protein} />
                      <Macro label="Carbs" grams={targets.carbs} color={Macros.carbs} />
                      <Macro label="Fat" grams={targets.fat} color={Macros.fat} />
                    </View>
                  </LinearGradient>
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.explain}>
                  <Explain icon="flash" text={`You burn about ${targets.maintenance} kcal a day. ${calorieReason(profile.goal, targets.calories - targets.maintenance)}`} />
                  <Explain icon="fish" text={`${targets.protein} g of protein a day protects and builds muscle. Spread it over 3–4 meals.`} />
                  <Explain icon="water" text={`Drink about ${(targets.waterMl / 1000).toFixed(1)} L of water a day, more on training days.`} />
                  <Explain icon="trending-up" text="Weigh yourself most mornings. After two weeks Spotter checks your trend and fine-tunes these numbers." />
                </Animated.View>
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {current === 'plan' ? (
            <Button label={saving ? 'Saving…' : existing ? 'Save my plan' : "Let's go"} onPress={finish} disabled={saving} />
          ) : (
            <Button label="Continue" onPress={next} disabled={!canContinue} />
          )}
        </View>
      </KeyboardAvoidingView>
      <PickerSheet
        visible={picking !== null}
        title={picking === 'birthYear' ? 'Born in' : picking === 'height' ? 'Height' : 'Weight'}
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
              onChange={(t) => update({ weightKg: Math.round(kilos * 10 + t) / 10 })}
              format={(t) => `.${t}`}
              suffix="kg"
            />
          </>
        )}
      </PickerSheet>
    </SafeAreaView>
  );
}

function calorieReason(goal: Profile['goal'], diff: number) {
  if (diff < -20) return `Eating ${Math.abs(diff)} kcal less than that loses fat at a steady, sustainable pace.`;
  if (diff > 20) return `Eating ${diff} kcal more than that gives your muscles what they need to grow.`;
  return goal === 'maintain' ? 'Eating about that much keeps your weight stable.' : 'Eating about that much fits your goal.';
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{grams} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function Explain({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.explainRow}>
      <Ionicons name={icon as 'flash'} size={18} color={Colors.accent} style={{ marginTop: 2 }} />
      <Text style={styles.explainText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surface, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.accent },
  stepCount: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  logo: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: Spacing.sm },
  subtitle: { color: Colors.textSecondary, fontSize: 16, lineHeight: 22 },
  fieldLabel: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 56,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  notes: { height: 90, paddingTop: Spacing.md, fontSize: 16, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  planCard: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.xl, borderWidth: 1, borderColor: '#2E3A1A' },
  kcal: { color: Colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  kcalLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  macros: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around' },
  macro: { alignItems: 'center', gap: 2 },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  macroValue: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  macroLabel: { color: Colors.textSecondary, fontSize: 13 },
  explain: { gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  explainRow: { flexDirection: 'row', gap: Spacing.md },
  explainText: { color: Colors.text, fontSize: 15, lineHeight: 21, flex: 1 },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
});
