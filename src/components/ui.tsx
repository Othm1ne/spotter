import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', style, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}>
      <Text style={[styles.buttonLabel, variant === 'primary' && { color: Colors.accentText }, variant === 'danger' && { color: Colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatTile({ value, label, style }: { value: string; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[styles.stat, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      {right}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { color: Colors.text, fontSize: 32, fontWeight: '800' },
  stat: { flex: 1, gap: 2, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  statLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  statValue: { color: Colors.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  section: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primary: { backgroundColor: Colors.accent },
  secondary: { backgroundColor: Colors.surfaceRaised },
  danger: { backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  buttonLabel: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  empty: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center' },
});
