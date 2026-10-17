import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

/** Grouped list rows in the iOS Settings style. */
export function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  value,
  right,
  danger,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Current choice shown before the chevron, e.g. "English". */
  value?: string;
  right?: ReactNode;
  danger?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const color = danger ? c.danger : c.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={danger ? c.danger : c.accent} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={c.textSecondary} /> : null)}
    </Pressable>
  );
}

export function Stepper({
  icon,
  title,
  subtitle,
  value,
  onMinus,
  onPlus,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <View style={styles.stepper}>
          <Pressable onPress={onMinus} hitSlop={6} style={styles.stepButton} accessibilityLabel={`Less ${title}`}>
            <Ionicons name="remove" size={18} color={c.text} />
          </Pressable>
          <Text style={styles.stepValue}>{value}</Text>
          <Pressable onPress={onPlus} hitSlop={6} style={styles.stepButton} accessibilityLabel={`More ${title}`}>
            <Ionicons name="add" size={18} color={c.text} />
          </Pressable>
        </View>
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  sectionTitle: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginLeft: Spacing.xs },
  card: { backgroundColor: c.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md },
  footer: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginHorizontal: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  value: { color: c.textSecondary, fontSize: 15, maxWidth: 140 },
  rowSubtitle: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { color: c.text, fontSize: 16, fontWeight: '800', minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
}));
