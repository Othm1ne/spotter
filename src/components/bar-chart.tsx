import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

export type Bar = { key: string; label: string; value: number; current?: boolean };

type Props = {
  bars: Bar[];
  /** Dashed target line; bars that reach it are bright, the others dimmed. */
  goal?: number;
  height?: number;
  /** Text shown above a tapped bar. */
  describe: (bar: Bar) => string;
};

/** Single-series column chart. Tap a bar to read its exact value. */
export function BarChart({ bars, goal, height = 150, describe }: Props) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value));
  const top = niceMax(max);
  const ticks = [top, top / 2, 0];
  const picked = bars.find((b) => b.key === selected);

  return (
    <View style={styles.wrap}>
      <Text style={styles.readout} numberOfLines={1}>
        {picked ? describe(picked) : t('chart.tapBar')}
      </Text>
      <View style={[styles.plot, { height }]}>
        <View style={styles.axis}>
          {ticks.map((tick) => (
            <Text key={tick} style={styles.tick}>
              {formatTick(tick)}
            </Text>
          ))}
        </View>
        <View style={styles.area}>
          {ticks.map((tick) => (
            <View key={tick} style={[styles.grid, { bottom: (tick / top) * height }]} />
          ))}
          {goal !== undefined && (
            <View style={[styles.goal, { bottom: (goal / top) * height }]}>
              {/* Separate dashes: one-sided dashed borders don't render reliably on iOS. */}
              {Array.from({ length: 24 }, (_, i) => (
                <View key={i} style={styles.dash} />
              ))}
              <Text style={styles.goalLabel}>Goal {goal}</Text>
            </View>
          )}
          <View style={styles.bars}>
            {bars.map((bar) => {
              const reached = goal === undefined || bar.value >= goal;
              const isSelected = bar.key === selected;
              return (
                <Pressable
                  key={bar.key}
                  onPress={() => setSelected(isSelected ? null : bar.key)}
                  style={styles.slot}
                  accessibilityLabel={describe(bar)}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: bar.value > 0 ? Math.max(6, (bar.value / top) * height) : 4,
                        backgroundColor: bar.value === 0 ? c.surfaceRaised : reached ? c.accent : c.chartDim,
                      },
                      isSelected && styles.barSelected,
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.labels}>
        <View style={styles.axis} />
        {bars.map((bar) => (
          <Text key={bar.key} style={[styles.label, bar.current && styles.labelCurrent]} numberOfLines={1}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = max <= 10 ? 2 : max <= 50 ? 10 : max <= 100 ? 20 : 50;
  return Math.ceil(max / step) * step;
}

function formatTick(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const AXIS_WIDTH = 24;

const useStyles = makeStyles((c) => ({
  wrap: { gap: Spacing.xs },
  readout: { color: c.textSecondary, fontSize: 13, fontWeight: '600', minHeight: 18 },
  plot: { flexDirection: 'row' },
  axis: { width: AXIS_WIDTH, justifyContent: 'space-between' },
  tick: { color: c.textSecondary, fontSize: 10, marginTop: -6, marginBottom: -6 },
  area: { flex: 1 },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  goal: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: 4, zIndex: 1 },
  dash: { flex: 1, height: 1.5, backgroundColor: c.textSecondary },
  goalLabel: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    color: c.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  bars: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected: { borderWidth: 2, borderColor: c.text },
  labels: { flexDirection: 'row', gap: 2 },
  label: { flex: 1, textAlign: 'center', color: c.textSecondary, fontSize: 11 },
  labelCurrent: { color: c.accent, fontWeight: '800' },
}));
