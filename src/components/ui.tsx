import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

/** Tab screen with a large title over a soft accent glow. */
export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={c.glow} style={styles.glow} pointerEvents="none" />
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
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
  const c = useColors();
  const styles = useStyles();
  const labelStyle = [
    styles.buttonLabel,
    variant === 'primary' && { color: c.onHero },
    variant === 'danger' && { color: c.danger },
    variant === 'ghost' && { color: c.accent },
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primary : styles[variant],
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.45 },
        style,
      ]}>
      {variant === 'primary' && (
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient} />
      )}
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatTile({ value, label, style }: { value: string; label: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  stat: { flex: 1, gap: 2, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  statLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  statValue: { color: c.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  section: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  button: {
    minHeight: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  // Rounded itself rather than clipped by the button, so the button keeps its glow.
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: Radius.md },
  primary: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: c.dark ? 0.45 : 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  secondary: { backgroundColor: c.surfaceRaised },
  danger: { backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  buttonLabel: { color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...(c.dark
      ? {}
      : { shadowColor: '#1A2240', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } }),
  },
  empty: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
}));
