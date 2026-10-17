import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { ExercisePicker } from '@/components/exercise-picker';
import { ExerciseThumb } from '@/components/exercise-preview';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import type { Exercise } from '@/db/workouts';
import { formatDuration } from '@/lib/workout-math';

export type DraftSet = { weight: string; reps: string };

const REST_STEP = 15;

type Props = {
  exercise: Exercise;
  sets: DraftSet[];
  onChangeSet: (index: number, field: keyof DraftSet, text: string) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onRemove: () => void;
  onInfo: () => void;
  /** Rest after each set, in seconds. Omit to hide the rest control. */
  restSeconds?: number;
  onRestChange?: (seconds: number) => void;
  /** Placeholder for empty fields, e.g. last time's numbers. */
  placeholders?: DraftSet[];
};

/** One exercise with an editable kg × reps row per set. */
export function SetsEditor(props: Props) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const { exercise, sets, restSeconds, onRestChange } = props;
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Pressable onPress={props.onInfo} style={styles.title}>
          <ExerciseThumb gif={exercise.gif} name={exercise.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={styles.muted}>{t(`muscles.${exercise.muscle}`)} · {t('exercise.howTo')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={props.onRemove} hitSlop={10} accessibilityLabel={t('common.removeNamed', { name: exercise.name })}>
          <Ionicons name="trash-outline" size={20} color={c.textSecondary} />
        </Pressable>
      </View>

      {restSeconds !== undefined && onRestChange && (
        <View style={styles.rest}>
          <Ionicons name="timer-outline" size={18} color={c.accent} />
          <Text style={styles.restLabel}>{t('workout.rest')}</Text>
          <Pressable
            onPress={() => onRestChange(Math.max(0, restSeconds - REST_STEP))}
            hitSlop={6}
            style={styles.restButton}>
            <Ionicons name="remove" size={18} color={c.text} />
          </Pressable>
          <Text style={styles.restValue}>{restSeconds === 0 ? t('common.off') : formatDuration(restSeconds)}</Text>
          <Pressable onPress={() => onRestChange(Math.min(600, restSeconds + REST_STEP))} hitSlop={6} style={styles.restButton}>
            <Ionicons name="add" size={18} color={c.text} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Text style={[styles.colSet, styles.colHead]}>{t('workout.colSet')}</Text>
        <Text style={[styles.colInput, styles.colHead]}>{t('workout.colKg')}</Text>
        <Text style={[styles.colInput, styles.colHead]}>{t('workout.colReps')}</Text>
        <View style={styles.colRemove} />
      </View>
      {sets.map((s, i) => (
        <View key={i} style={styles.row}>
          <Text style={[styles.colSet, styles.setNumber]}>{i + 1}</Text>
          <TextInput
            style={[styles.colInput, styles.input]}
            value={s.weight}
            onChangeText={(text) => props.onChangeSet(i, 'weight', text)}
            keyboardType="decimal-pad"
            placeholder={props.placeholders?.[i]?.weight || '–'}
            placeholderTextColor={c.textSecondary}
            selectTextOnFocus
          />
          <TextInput
            style={[styles.colInput, styles.input]}
            value={s.reps}
            onChangeText={(text) => props.onChangeSet(i, 'reps', text)}
            keyboardType="number-pad"
            placeholder={props.placeholders?.[i]?.reps || '–'}
            placeholderTextColor={c.textSecondary}
            selectTextOnFocus
          />
          <Pressable onPress={() => props.onRemoveSet(i)} hitSlop={8} style={styles.colRemove}>
            <Ionicons name="close" size={20} color={c.textSecondary} />
          </Pressable>
        </View>
      ))}
      <Button label={t('workout.addSet')} variant="secondary" onPress={props.onAddSet} style={styles.addSet} />
    </View>
  );
}

/** Full-screen exercise library in a sheet, for screens that keep their state in memory. */
export function ExercisePickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}) {
  const t = useT();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{t('screens.addExercise')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <ExercisePicker onPick={onPick} />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  block: { gap: Spacing.sm, backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { color: c.accent, fontSize: 17, fontWeight: '700' },
  muted: { color: c.textSecondary, fontSize: 13 },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  restLabel: { color: c.text, fontWeight: '700', flex: 1 },
  restButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restValue: { color: c.text, fontSize: 16, fontWeight: '800', minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colHead: { color: c.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 32, textAlign: 'center' },
  colInput: { flex: 1 },
  colRemove: { width: 32, alignItems: 'center' },
  setNumber: { color: c.text, fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: c.surfaceRaised,
    color: c.text,
    borderRadius: Radius.sm,
    height: 44,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  addSet: { minHeight: 40 },
  sheet: { flex: 1, backgroundColor: c.background },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  sheetTitle: { color: c.text, fontSize: 20, fontWeight: '800' },
  close: { color: c.accent, fontSize: 17, fontWeight: '700' },
}));
