import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { ExerciseThumb } from '@/components/exercise-preview';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
            <Text style={styles.muted}>{exercise.muscle} · How to ›</Text>
          </View>
        </Pressable>
        <Pressable onPress={props.onRemove} hitSlop={10} accessibilityLabel={`Remove ${exercise.name}`}>
          <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {restSeconds !== undefined && onRestChange && (
        <View style={styles.rest}>
          <Ionicons name="timer-outline" size={18} color={Colors.accent} />
          <Text style={styles.restLabel}>Rest</Text>
          <Pressable
            onPress={() => onRestChange(Math.max(0, restSeconds - REST_STEP))}
            hitSlop={6}
            style={styles.restButton}>
            <Ionicons name="remove" size={18} color={Colors.text} />
          </Pressable>
          <Text style={styles.restValue}>{restSeconds === 0 ? 'Off' : formatDuration(restSeconds)}</Text>
          <Pressable onPress={() => onRestChange(Math.min(600, restSeconds + REST_STEP))} hitSlop={6} style={styles.restButton}>
            <Ionicons name="add" size={18} color={Colors.text} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Text style={[styles.colSet, styles.colHead]}>SET</Text>
        <Text style={[styles.colInput, styles.colHead]}>KG</Text>
        <Text style={[styles.colInput, styles.colHead]}>REPS</Text>
        <View style={styles.colRemove} />
      </View>
      {sets.map((s, i) => (
        <View key={i} style={styles.row}>
          <Text style={[styles.colSet, styles.setNumber]}>{i + 1}</Text>
          <TextInput
            style={[styles.colInput, styles.input]}
            value={s.weight}
            onChangeText={(t) => props.onChangeSet(i, 'weight', t)}
            keyboardType="decimal-pad"
            placeholder={props.placeholders?.[i]?.weight || '–'}
            placeholderTextColor={Colors.textSecondary}
            selectTextOnFocus
          />
          <TextInput
            style={[styles.colInput, styles.input]}
            value={s.reps}
            onChangeText={(t) => props.onChangeSet(i, 'reps', t)}
            keyboardType="number-pad"
            placeholder={props.placeholders?.[i]?.reps || '–'}
            placeholderTextColor={Colors.textSecondary}
            selectTextOnFocus
          />
          <Pressable onPress={() => props.onRemoveSet(i)} hitSlop={8} style={styles.colRemove}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      ))}
      <Button label="+ Add set" variant="secondary" onPress={props.onAddSet} style={styles.addSet} />
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
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Add exercise</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ExercisePicker onPick={onPick} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { color: Colors.accent, fontSize: 17, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  restLabel: { color: Colors.text, fontWeight: '700', flex: 1 },
  restButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restValue: { color: Colors.text, fontSize: 16, fontWeight: '800', minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colHead: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 32, textAlign: 'center' },
  colInput: { flex: 1 },
  colRemove: { width: 32, alignItems: 'center' },
  setNumber: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    borderRadius: Radius.sm,
    height: 44,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  addSet: { minHeight: 40 },
  sheet: { flex: 1, backgroundColor: Colors.background },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  sheetTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  close: { color: Colors.accent, fontSize: 17, fontWeight: '700' },
});
