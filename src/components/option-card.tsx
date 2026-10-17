import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

/** Big selectable card used in onboarding choices. */
export function OptionCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  compact,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  /** Narrow layout for side-by-side cards: no radio circle. */
  compact?: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && { transform: [{ scale: 0.98 }] }]}>
      {icon && (
        <View style={[styles.icon, selected && styles.iconSelected]}>
          <Ionicons name={icon as IconName} size={22} color={selected ? c.accentText : c.text} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {!compact && (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? c.accent : c.border}
        />
      )}
    </Pressable>
  );
}

/** Small pill choice, for numbers and multi-select tags. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.chipLabel, selected && { color: c.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    padding: Spacing.lg,
  },
  selected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: c.accent },
  title: { color: c.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: c.textSecondary, fontSize: 14 },
  chip: {
    minWidth: 52,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  chipSelected: { backgroundColor: c.accent, borderColor: c.accent },
  chipLabel: { color: c.text, fontSize: 16, fontWeight: '700' },
}));
