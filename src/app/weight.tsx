import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { Button, Card } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { PickerSheet, range, Wheel } from '@/components/picker-field';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { deleteWeight, listWeights, logWeight } from '@/db/body';
import { getProfile } from '@/db/profile';
import type { WeightEntry } from '@/lib/body';
import { formatWeight } from '@/lib/workout-math';

const KILOS = range(30, 250);
const TENTHS = range(0, 9);

/** Log today's weight. Starts at the last weigh-in, so most days it's a nudge and a tap. */
export default function WeightScreen() {
  const { locale } = useI18n();
  const t = useT();
  const styles = useStyles();
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
    Alert.alert(t('weight.deleteTitle', { kg: formatWeight(entry.weight) }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
        <Text style={styles.bigLabel}>{t('weight.today')}</Text>
        <Text style={styles.bigValue}>
          {weight.toFixed(1)}
          <Text style={styles.bigUnit}> kg</Text>
        </Text>
        <Text style={styles.bigHint}>{t('weight.tapToChange')}</Text>
      </Pressable>
      <Text style={styles.hint}>{t('weight.bestTime')}</Text>
      <Button label={t('weight.save')} onPress={onSave} />

      {entries.length > 1 && (
        <Card>
          <WeightChart entries={entries} />
        </Card>
      )}

      {entries.length > 0 && <Text style={styles.section}>{t('screens.history')}</Text>}
      {[...entries].reverse().slice(0, 30).map((e) => (
        <Pressable key={e.id} onLongPress={() => onDelete(e)} style={styles.row}>
          <Text style={styles.date}>
            {new Date(e.measured_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <Text style={styles.value}>{formatWeight(e.weight)} kg</Text>
        </Pressable>
      ))}
      {entries.length > 0 && <Text style={styles.hint}>{t('weight.holdToDelete')}</Text>}
      <PickerSheet visible={picking} title={t('weight.todays')} onClose={() => setPicking(false)}>
        <Wheel values={KILOS} value={kilos} onChange={(k) => setWeight(Math.round(k * 10 + tenths) / 10)} />
        <Wheel values={TENTHS} value={tenths} onChange={(tenth) => setWeight(Math.round(kilos * 10 + tenth) / 10)} format={(tenth) => `.${tenth}`} suffix="kg" />
      </PickerSheet>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  big: { backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: 2 },
  bigLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  bigValue: { color: c.text, fontSize: 56, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  bigUnit: { color: c.textSecondary, fontSize: 22, fontWeight: '700' },
  bigHint: { color: c.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
  section: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  date: { color: c.textSecondary, fontSize: 15 },
  value: { color: c.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
}));
