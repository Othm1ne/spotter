import { useState } from 'react';
import { Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useT, useI18n } from '@/i18n';
import { Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { smoothedWeight, type WeightEntry } from '@/lib/body';
import { formatWeight } from '@/lib/workout-math';

const HEIGHT = 150;
const PAD_Y = 10;
const AXIS = 34;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Weigh-ins as small dots and the 7-day average as the main line (daily weight is noisy;
 * the average is what matters). Touch and drag to read any day.
 */
export function WeightChart({ entries, days = 90 }: { entries: WeightEntry[]; days?: number }) {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const now = entries.at(-1)?.measured_at ?? 0;
  const shown = entries.filter((e) => e.measured_at > now - days * DAY_MS);
  if (shown.length === 0) return null;

  const averages = shown.map((e) => smoothedWeight(entries, e.measured_at) ?? e.weight);
  const values = [...shown.map((e) => e.weight), ...averages];
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const t0 = shown[0].measured_at;
  const span = Math.max(DAY_MS, now - t0);
  const plotW = Math.max(1, width - AXIS);
  const x = (t: number) => AXIS + ((t - t0) / span) * (plotW - 8) + 4;
  const y = (w: number) => PAD_Y + (1 - (w - lo) / (hi - lo)) * (HEIGHT - 2 * PAD_Y);

  function onTouch(e: GestureResponderEvent) {
    const tx = e.nativeEvent.locationX;
    let best = 0;
    shown.forEach((p, i) => {
      if (Math.abs(x(p.measured_at) - tx) < Math.abs(x(shown[best].measured_at) - tx)) best = i;
    });
    setSelected(best);
  }

  const pick = selected !== null ? shown[selected] : shown.at(-1)!;
  const pickIndex = selected ?? shown.length - 1;

  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.readout}>
        {new Date(pick.measured_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
        {'  ·  '}
        <Text style={styles.readoutStrong}>{formatWeight(pick.weight)} kg</Text>
        {'  ·  avg '}
        {formatWeight(Math.round(averages[pickIndex] * 10) / 10)} kg
      </Text>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderRelease={() => setSelected(null)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {[hi, (hi + lo) / 2, lo].map((v) => (
              <Line key={v} x1={AXIS} x2={width} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            ))}
            {shown.map((p) => (
              <Circle key={p.id} cx={x(p.measured_at)} cy={y(p.weight)} r={3} fill={c.textSecondary} opacity={0.6} />
            ))}
            <Polyline
              points={shown.map((p, i) => `${x(p.measured_at)},${y(averages[i])}`).join(' ')}
              stroke={c.accent}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            <Line
              x1={x(pick.measured_at)}
              x2={x(pick.measured_at)}
              y1={PAD_Y / 2}
              y2={HEIGHT - PAD_Y / 2}
              stroke={c.textSecondary}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Circle
              cx={x(pick.measured_at)}
              cy={y(averages[pickIndex])}
              r={6}
              fill={c.accent}
              stroke={c.surface}
              strokeWidth={2}
            />
          </Svg>
        )}
        <View style={styles.axis} pointerEvents="none">
          {[hi, (hi + lo) / 2, lo].map((v) => (
            <Text key={v} style={[styles.tick, { top: y(v) - 7 }]}>
              {formatWeight(v)}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendLine, { backgroundColor: c.accent }]} />
        <Text style={styles.legendText}>{t('weight.avgLegend')}</Text>
        <View style={[styles.legendDot, { backgroundColor: c.textSecondary }]} />
        <Text style={styles.legendText}>{t('weight.weighIns')}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  readout: { color: c.textSecondary, fontSize: 13 },
  readoutStrong: { color: c.text, fontWeight: '800' },
  axis: { position: 'absolute', left: 0, top: 0, bottom: 0, width: AXIS },
  tick: { position: 'absolute', color: c.textSecondary, fontSize: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginLeft: Spacing.md },
  legendText: { color: c.textSecondary, fontSize: 12 },
}));
