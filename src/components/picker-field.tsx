import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

/** A value row; tap it to open its picker sheet. */
export function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.field, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityHint={t('picker.hint')}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
      <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
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
  const t = useT();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('picker.close')} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>{t('common.done')}</Text>
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
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.column}>
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(v as T)}
        style={styles.picker}
        itemStyle={styles.item}
        dropdownIconColor={c.text}
        mode="dropdown">
        {values.map((v) => (
          <Picker.Item key={String(v)} label={format(v)} value={v} color={Platform.OS === 'ios' ? c.text : undefined} />
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

const useStyles = makeStyles((c) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 60,
  },
  fieldLabel: { flex: 1, color: c.textSecondary, fontSize: 16, fontWeight: '600' },
  fieldValue: { color: c.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
    marginTop: Spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  title: { color: c.text, fontSize: 18, fontWeight: '800' },
  done: { color: c.accent, fontSize: 17, fontWeight: '800' },
  wheels: { flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  picker: { flex: 1, color: c.text },
  item: { color: c.text, fontSize: 24, fontWeight: '600' },
  suffix: { color: c.textSecondary, fontSize: 18, fontWeight: '700', marginLeft: -Spacing.sm },
}));
