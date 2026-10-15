import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (value: T) => string;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.option, active && styles.active]}
            hitSlop={4}>
            <Text style={[styles.label, active && styles.activeLabel]}>{format(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: Colors.surfaceRaised, borderRadius: Radius.pill, padding: 3 },
  option: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  active: { backgroundColor: Colors.accent },
  label: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  activeLabel: { color: Colors.accentText },
});
