import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityLevels, Colors, Spacing } from '@/constants/theme';
import { activityLevel, addDays, dayKey, parseDayKey, startOfWeek, type DayStat } from '@/lib/stats';

const CELL = 14;
const GAP = 3;
const WEEKS = 53;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

type Props = {
  days: Map<string, DayStat>;
  selected: string | null;
  onSelect: (key: string) => void;
};

/** GitHub-style year of training: one column per week, Monday on top, newest week on the right. */
export function ActivityCalendar({ days, selected, onSelect }: Props) {
  const scroll = useRef<ScrollView>(null);
  const today = dayKey(new Date());

  const columns = useMemo(() => {
    const thisWeek = startOfWeek(new Date());
    return Array.from({ length: WEEKS }, (_, i) => {
      const monday = addDays(thisWeek, -7 * (WEEKS - 1 - i));
      return Array.from({ length: 7 }, (_, d) => dayKey(addDays(monday, d)));
    });
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.dayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <View>
          <View style={styles.months}>
            {columns.map((week, i) => {
              const month = parseDayKey(week[0]).getMonth();
              const showLabel = i === 0 ? false : parseDayKey(columns[i - 1][0]).getMonth() !== month;
              return (
                <View key={week[0]} style={styles.monthCell}>
                  {showLabel && (
                    <Text style={styles.monthLabel} numberOfLines={1}>
                      {parseDayKey(week[0]).toLocaleDateString(undefined, { month: 'short' })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.grid}>
            {columns.map((week) => (
              <View key={week[0]} style={styles.column}>
                {week.map((key) => {
                  if (key > today) return <View key={key} style={styles.cell} />;
                  const level = activityLevel(days.get(key)?.sets ?? 0);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => onSelect(key)}
                      hitSlop={GAP / 2}
                      style={[
                        styles.cell,
                        { backgroundColor: ActivityLevels[level] },
                        key === today && styles.today,
                        key === selected && styles.selected,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function ActivityLegend() {
  return (
    <View style={styles.legend}>
      <Text style={styles.legendText}>Less</Text>
      {ActivityLevels.map((color) => (
        <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
      ))}
      <Text style={styles.legendText}>More</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: Spacing.xs },
  dayLabels: { paddingTop: 18, gap: GAP },
  dayLabel: { height: CELL, color: Colors.textSecondary, fontSize: 10, lineHeight: CELL },
  months: { flexDirection: 'row', height: 18 },
  monthCell: { width: CELL + GAP, overflow: 'visible' },
  monthLabel: { position: 'absolute', width: 40, color: Colors.textSecondary, fontSize: 11 },
  grid: { flexDirection: 'row', gap: GAP },
  column: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  today: { borderWidth: 1.5, borderColor: Colors.text },
  selected: { borderWidth: 2, borderColor: Colors.text, transform: [{ scale: 1.15 }] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: Colors.textSecondary, fontSize: 11, marginHorizontal: 2 },
});
