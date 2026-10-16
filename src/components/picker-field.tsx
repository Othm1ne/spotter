import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

/** A value row; tap it to open its picker sheet. */
export function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.field, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityHint="Opens a picker">
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
      <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
    </Pressable>
  );
}

/** Bottom sheet holding one or more wheels side by side. Values update live; Done closes it. */
export function PickerSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close picker" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.wheels}>{children}</View>
      </View>
    </Modal>
  );
}

/** One native wheel (iOS) / dropdown (Android) column. */
export function Wheel<T extends number | string>({
  values,
  value,
  onChange,
  format = String,
  suffix,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  /** Unit shown to the right of the wheel, like "kg". */
  suffix?: string;
}) {
  return (
    <View style={styles.column}>
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(v as T)}
        style={styles.picker}
        itemStyle={styles.item}
        dropdownIconColor={Colors.text}
        mode="dropdown">
        {values.map((v) => (
          <Picker.Item key={String(v)} label={format(v)} value={v} color={Platform.OS === 'ios' ? Colors.text : undefined} />
        ))}
      </Picker>
      {suffix && <Text style={styles.suffix}>{suffix}</Text>}
    </View>
  );
}

/** Inclusive numeric range with a step, e.g. range(30, 250). */
export function range(min: number, max: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 60,
  },
  fieldLabel: { flex: 1, color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  fieldValue: { color: Colors.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  done: { color: Colors.accent, fontSize: 17, fontWeight: '800' },
  wheels: { flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  picker: { flex: 1, color: Colors.text },
  item: { color: Colors.text, fontSize: 24, fontWeight: '600' },
  suffix: { color: Colors.textSecondary, fontSize: 18, fontWeight: '700', marginLeft: -Spacing.sm },
});
