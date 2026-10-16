import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { PickerSheet, range, Wheel } from '@/components/picker-field';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deleteWeight, listWeights, logWeight } from '@/db/body';
import { getProfile } from '@/db/profile';
import type { WeightEntry } from '@/lib/body';
import { formatWeight } from '@/lib/workout-math';

const KILOS = range(30, 250);
const TENTHS = range(0, 9);

/** Log today's weight. Starts at the last weigh-in, so most days it's a nudge and a tap. */
export default function WeightScreen() {
  const db = useSQLiteContext();
  const [weight, setWeight] = useState<number | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [picking, setPicking] = useState(false);

  async function load() {
    const list = await listWeights(db);
    setEntries(list);
    return list;
  }

  useEffect(() => {
    (async () => {
      const list = await listWeights(db);
      setEntries(list);
      setWeight(list.at(-1)?.weight ?? (await getProfile(db))?.weightKg ?? 75);
    })();
  }, [db]);

  async function onSave() {
    if (weight === null) return;
    await logWeight(db, weight, new Date());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  function onDelete(entry: WeightEntry) {
    Alert.alert(`Delete ${formatWeight(entry.weight)} kg?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWeight(db, entry.id);
          load();
        },
      },
    ]);
  }

  if (weight === null) return <View style={styles.screen} />;

  const kilos = Math.floor(weight + 1e-6);
  const tenths = Math.round((weight - kilos) * 10) % 10;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => setPicking(true)} style={({ pressed }) => [styles.big, pressed && { opacity: 0.7 }]}>
        <Text style={styles.bigLabel}>TODAY</Text>
        <Text style={styles.bigValue}>
          {weight.toFixed(1)}
          <Text style={styles.bigUnit}> kg</Text>
        </Text>
        <Text style={styles.bigHint}>Tap to change</Text>
      </Pressable>
      <Text style={styles.hint}>Best taken in the morning, after the bathroom and before eating.</Text>
      <Button label="Save weight" onPress={onSave} />

      {entries.length > 1 && (
        <Card>
          <WeightChart entries={entries} />
        </Card>
      )}

      {entries.length > 0 && <Text style={styles.section}>History</Text>}
      {[...entries].reverse().slice(0, 30).map((e) => (
        <Pressable key={e.id} onLongPress={() => onDelete(e)} style={styles.row}>
          <Text style={styles.date}>
            {new Date(e.measured_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <Text style={styles.value}>{formatWeight(e.weight)} kg</Text>
        </Pressable>
      ))}
      {entries.length > 0 && <Text style={styles.hint}>Hold an entry to delete it.</Text>}
      <PickerSheet visible={picking} title="Today's weight" onClose={() => setPicking(false)}>
        <Wheel values={KILOS} value={kilos} onChange={(k) => setWeight(Math.round(k * 10 + tenths) / 10)} />
        <Wheel values={TENTHS} value={tenths} onChange={(t) => setWeight(Math.round(kilos * 10 + t) / 10)} format={(t) => `.${t}`} suffix="kg" />
      </PickerSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  big: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: 2 },
  bigLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  bigValue: { color: Colors.text, fontSize: 56, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  bigUnit: { color: Colors.textSecondary, fontSize: 22, fontWeight: '700' },
  bigHint: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  section: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  date: { color: Colors.textSecondary, fontSize: 15 },
  value: { color: Colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
