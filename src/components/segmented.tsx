import { Pressable, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { makeStyles } from '@/theme';

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
  const styles = useStyles();
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

const useStyles = makeStyles((c) => ({
  wrap: { flexDirection: 'row', backgroundColor: c.surfaceRaised, borderRadius: Radius.pill, padding: 3 },
  option: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  active: { backgroundColor: c.accent },
  label: { color: c.textSecondary, fontWeight: '700', fontSize: 13 },
  activeLabel: { color: c.accentText },
}));
