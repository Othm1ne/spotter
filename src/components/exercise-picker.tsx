import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-preview';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MUSCLES } from '@/db/exercise-seed';
import { listExercises, type Exercise } from '@/db/workouts';

const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Smith Machine',
  'Kettlebell',
  'EZ Bar',
  'Band',
  'Other',
] as const;

const THUMB = 52;
const ITEM_HEIGHT = THUMB + Spacing.md * 2;

type Props = {
  onPick: (exercise: Exercise) => void;
  /** Shows an "i" button per row that opens the exercise guide. */
  onInfo?: (exercise: Exercise) => void;
};

/** Searchable exercise library with muscle filter chips. */
export function ExercisePicker({ onPick, onInfo }: Props) {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  useEffect(() => {
    listExercises(db).then(setExercises);
  }, [db]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Every word must match, so "incline db press" style searches work in any order.
    const words = q.split(/\s+/).filter(Boolean);
    return exercises.filter(
      (e) =>
        (!muscle || e.muscle === muscle) &&
        (!equipment || e.equipment === equipment) &&
        words.every((w) => e.name.toLowerCase().includes(w))
    );
  }, [exercises, query, muscle, equipment]);

  return (
    <View style={styles.screen}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor={Colors.textSecondary}
        style={styles.search}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <ChipRow options={MUSCLES} value={muscle} onChange={setMuscle} allLabel="All muscles" />
      <ChipRow options={EQUIPMENT} value={equipment} onChange={setEquipment} allLabel="All equipment" />
      <Text style={styles.count}>
        {filtered.length} exercise{filtered.length === 1 ? '' : 's'}
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        initialNumToRender={12}
        windowSize={7}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
            <ExerciseThumb gif={item.gif} name={item.name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.muscle} · {item.equipment}
              </Text>
            </View>
            {onInfo && (
              <Pressable onPress={() => onInfo(item)} hitSlop={10} style={styles.info}>
                <Text style={styles.infoLabel}>i</Text>
              </Pressable>
            )}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.none}>No exercise matches “{query}”.</Text>}
      />
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  allLabel,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel: string;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[null, ...options].map((option) => (
          <Pressable
            key={option ?? 'all'}
            onPress={() => onChange(option)}
            style={[styles.chip, value === option && styles.chipActive]}>
            <Text style={[styles.chipLabel, value === option && { color: Colors.accentText }]}>{option ?? allLabel}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  search: {
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    height: 44,
    fontSize: 16,
  },
  chips: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  chip: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.accent },
  chipLabel: { color: Colors.text, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    height: ITEM_HEIGHT,
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  count: { color: Colors.textSecondary, fontSize: 12, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  itemName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  itemMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  info: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: Colors.accent, fontSize: 17, fontWeight: '800', fontStyle: 'italic' },
  none: { color: Colors.textSecondary, textAlign: 'center', padding: Spacing.xl },
});
