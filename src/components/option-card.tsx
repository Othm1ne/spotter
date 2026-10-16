import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

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
          <Ionicons name={icon as IconName} size={22} color={selected ? Colors.accentText : Colors.text} />
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
          color={selected ? Colors.accent : Colors.border}
        />
      )}
    </Pressable>
  );
}

/** Small pill choice, for numbers and multi-select tags. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.chipLabel, selected && { color: Colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  selected: { borderColor: Colors.accent, backgroundColor: 'rgba(198, 244, 50, 0.07)' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: Colors.accent },
  title: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 14 },
  chip: {
    minWidth: 52,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipLabel: { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
