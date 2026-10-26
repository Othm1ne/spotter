import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-preview';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { PreviousSet, WorkoutSet } from '@/db/workouts';
import { useT } from '@/i18n';
import { formatWeight, parseNumber } from '@/lib/workout-math';
import { makeStyles, useColors } from '@/theme';

export type Draft = { weight: string; reps: string };

export type WorkoutBlock = {
  position: number;
  exerciseId: number;
  name: string;
  muscle: string;
  gif: string | null;
  hint: string | null;
  sets: WorkoutSet[];
};

const WEIGHT_STEP = 2.5;

type Props = {
  blocks: WorkoutBlock[];
  index: number;
  onIndex: (index: number) => void;
  drafts: Record<number, Draft>;
  previous: Map<number, PreviousSet[]>;
  /** Saves new kg / reps for a set (done or not). */
  onValues: (set: WorkoutSet, draft: Draft) => void;
  /** Ticks or unticks a set; ticking starts the rest timer. */
  onToggleDone: (set: WorkoutSet) => void;
  onAddSet: (block: WorkoutBlock) => void;
  onDeleteSet: (set: WorkoutSet) => void;
  onMenu: (block: WorkoutBlock) => void;
  onFinish: () => void;
  hintText: (hint: string) => string;
};

/**
 * One exercise at a time, made for the gym: big − / + buttons instead of the keyboard and one
 * big "Set done" button that starts the rest and moves on to the next set.
 */
export function WorkoutFocus(props: Props) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const { blocks, index, drafts, previous } = props;
  const block = blocks[index];
  // The set being edited; by default the first one not done yet.
  const [picked, setPicked] = useState<number | null>(null);

  if (!block) return null;
  const prevSets = previous.get(block.exerciseId) ?? [];
  const firstOpen = block.sets.findIndex((s) => s.done !== 1);
  const selectedIndex = picked !== null && block.sets[picked] ? picked : firstOpen === -1 ? block.sets.length - 1 : firstOpen;
  const set = block.sets[selectedIndex];
  const prev = prevSets[selectedIndex];
  const blockDone = firstOpen === -1;
  const nextOpenBlock = blocks.findIndex((b, i) => i !== index && b.sets.some((s) => s.done !== 1));

  const draft = set ? (drafts[set.id] ?? { weight: '', reps: '' }) : { weight: '', reps: '' };
  // Empty fields show last time's numbers; the steppers start from them too.
  const weight = parseNumber(draft.weight) ?? prev?.weight ?? null;
  const reps = parseNumber(draft.reps) ?? prev?.reps ?? null;

  function go(i: number) {
    Haptics.selectionAsync();
    setPicked(null);
    props.onIndex(i);
  }

  function change(field: 'weight' | 'reps', delta: number) {
    if (!set) return;
    Haptics.selectionAsync();
    const base = field === 'weight' ? (weight ?? 0) : (reps ?? 0);
    const value = Math.max(0, Math.round((base + delta) * 100) / 100);
    props.onValues(set, {
      weight: field === 'weight' ? formatWeight(value) : weight === null ? '' : formatWeight(weight),
      reps: field === 'reps' ? String(value) : reps === null ? '' : String(reps),
    });
  }

  function type(field: 'weight' | 'reps', text: string) {
    if (!set) return;
    props.onValues(set, { ...draft, [field]: text });
  }

  function done() {
    if (!set) return;
    props.onToggleDone(set);
    setPicked(null);
    // Last open set of this exercise: move on to the next one with sets left.
    const remaining = block.sets.filter((s) => s.done !== 1 && s.id !== set.id).length;
    if (set.done !== 1 && remaining === 0 && nextOpenBlock !== -1) setTimeout(() => go(nextOpenBlock), 350);
  }

  const allDone = blocks.every((b) => b.sets.every((s) => s.done === 1));

  return (
    <View style={styles.wrap}>
      {/* Every exercise, to jump straight to one. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {blocks.map((b, i) => {
          const doneCount = b.sets.filter((s) => s.done === 1).length;
          const complete = doneCount === b.sets.length && b.sets.length > 0;
          return (
            <Pressable key={b.position} onPress={() => go(i)} style={[styles.chip, i === index && styles.chipOn]}>
              {complete && <Ionicons name="checkmark-circle" size={14} color={i === index ? c.accentText : c.success} />}
              <Text style={[styles.chipText, i === index && styles.chipTextOn]} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={[styles.chipCount, i === index && styles.chipTextOn]}>
                {doneCount}/{b.sets.length}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(block.exerciseId) } })}
            style={styles.title}>
            <ExerciseThumb gif={block.gif} name={block.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>
                {block.name}
              </Text>
              <Text style={styles.muted}>
                {t('focus.exerciseOf', { n: index + 1, total: blocks.length })} · {t('exercise.howTo')}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={() => props.onMenu(block)} hitSlop={12} style={styles.menu} accessibilityLabel={t('focus.options')}>
            <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
          </Pressable>
        </View>

        {block.hint && (
          <View style={styles.hint}>
            <Ionicons name="bulb-outline" size={15} color={c.accent} />
            <Text style={styles.hintText}>{props.hintText(block.hint)}</Text>
          </View>
        )}

        {/* One dot per set: tap to edit it, hold to delete it. */}
        <View style={styles.dots}>
          {block.sets.map((s, i) => {
            const isDone = s.done === 1;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPicked(i);
                }}
                onLongPress={() => props.onDeleteSet(s)}
                accessibilityLabel={t(isDone ? 'workout.setDone' : 'workout.setNumber', { n: i + 1 })}
                style={[styles.dot, isDone && styles.dotDone, i === selectedIndex && styles.dotSelected]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={18} color={c.accentText} />
                ) : (
                  <Text style={styles.dotText}>{i + 1}</Text>
                )}
              </Pressable>
            );
          })}
          <Pressable onPress={() => props.onAddSet(block)} style={[styles.dot, styles.dotAdd]} accessibilityLabel={t('workout.addSetLabel')}>
            <Ionicons name="add" size={20} color={c.textSecondary} />
          </Pressable>
        </View>

        {set ? (
          <>
            <Text style={styles.setLabel}>
              {t('focus.setOf', { n: selectedIndex + 1, total: block.sets.length })}
              {set.done === 1 ? ` · ${t('focus.done')}` : ''}
            </Text>
            <View style={styles.steppers}>
              <Stepper
                label={t('workout.colKg')}
                value={draft.weight}
                placeholder={prev?.weight != null ? formatWeight(prev.weight) : '0'}
                keyboardType="decimal-pad"
                onMinus={() => change('weight', -WEIGHT_STEP)}
                onPlus={() => change('weight', WEIGHT_STEP)}
                onType={(text) => type('weight', text)}
              />
              <Stepper
                label={t('workout.colReps')}
                value={draft.reps}
                placeholder={prev?.reps != null ? String(prev.reps) : '0'}
                keyboardType="number-pad"
                onMinus={() => change('reps', -1)}
                onPlus={() => change('reps', 1)}
                onType={(text) => type('reps', text)}
              />
            </View>
            <Text style={styles.last}>
              {prev ? t('focus.lastTime', { weight: formatWeight(prev.weight), reps: prev.reps ?? '–' }) : t('focus.firstTime')}
            </Text>
          </>
        ) : null}
      </View>

      {set && set.done !== 1 ? (
        <Pressable onPress={done} style={({ pressed }) => [styles.doneButton, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Ionicons name="checkmark" size={28} color={c.accentText} />
          <Text style={styles.doneText}>{t('focus.setDone')}</Text>
        </Pressable>
      ) : allDone ? (
        <Button label={t('focus.finish')} onPress={props.onFinish} />
      ) : blockDone && nextOpenBlock !== -1 ? (
        <Button label={t('focus.nextExercise', { name: blocks[nextOpenBlock].name })} onPress={() => go(nextOpenBlock)} />
      ) : null}
      {set && set.done === 1 && (
        <Pressable onPress={() => props.onToggleDone(set)} hitSlop={8} style={styles.undo}>
          <Text style={styles.undoText}>{t('focus.undo')}</Text>
        </Pressable>
      )}

      <View style={styles.nav}>
        <Pressable onPress={() => go(index - 1)} disabled={index === 0} style={[styles.navButton, index === 0 && { opacity: 0.3 }]}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <Text style={styles.navText} numberOfLines={1}>
            {blocks[index - 1]?.name ?? ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => go(index + 1)}
          disabled={index === blocks.length - 1}
          style={[styles.navButton, styles.navRight, index === blocks.length - 1 && { opacity: 0.3 }]}>
          <Text style={[styles.navText, { textAlign: 'right' }]} numberOfLines={1}>
            {blocks[index + 1]?.name ?? ''}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Stepper(props: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType: 'decimal-pad' | 'number-pad';
  onMinus: () => void;
  onPlus: () => void;
  onType: (text: string) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{props.label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={props.onMinus} style={styles.stepButton} accessibilityLabel={`− ${props.label}`}>
          <Ionicons name="remove" size={26} color={c.text} />
        </Pressable>
        <TextInput
          value={props.value}
          onChangeText={props.onType}
          placeholder={props.placeholder}
          placeholderTextColor={c.textSecondary}
          keyboardType={props.keyboardType}
          selectTextOnFocus
          style={styles.stepValue}
          accessibilityLabel={props.label}
        />
        <Pressable onPress={props.onPlus} style={styles.stepButton} accessibilityLabel={`+ ${props.label}`}>
          <Ionicons name="add" size={26} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: Spacing.md },
  strip: { gap: Spacing.sm, paddingRight: Spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    backgroundColor: c.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipOn: { backgroundColor: c.accent },
  chipText: { color: c.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  chipTextOn: { color: c.accentText },
  chipCount: { color: c.textSecondary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: { backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { color: c.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  muted: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  menu: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start' },
  hintText: { color: c.accent, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 19 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotDone: { backgroundColor: c.accent },
  dotSelected: { borderColor: c.text },
  dotAdd: { borderStyle: 'dashed', borderColor: c.border, backgroundColor: 'transparent' },
  dotText: { color: c.text, fontSize: 16, fontWeight: '700' },
  setLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  steppers: { flexDirection: 'row', gap: Spacing.md },
  stepper: { flex: 1, gap: Spacing.xs, alignItems: 'center' },
  stepperLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepButton: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    color: c.text,
    fontSize: 34,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  last: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: c.dark ? 0.45 : 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  doneText: { color: c.accentText, fontSize: 21, fontWeight: '800' },
  undo: { alignSelf: 'center', padding: Spacing.sm },
  undoText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  nav: { flexDirection: 'row', gap: Spacing.sm },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  navRight: { justifyContent: 'flex-end' },
  navText: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
}));
