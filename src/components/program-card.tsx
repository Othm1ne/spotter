import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { Colors, HeroGradient, Radius, Spacing } from '@/constants/theme';
import type { Program } from '@/db/program';
import { programWeek } from '@/lib/program';
import { dayKey } from '@/lib/stats';

/** Home card: the next workout of the program, or an invite to build one. */
export function ProgramCard({ program, now, onStart }: { program: Program | null; now: number; onStart: (routineId: number) => void }) {
  if (!program) {
    return (
      <Pressable onPress={() => router.push('/program')} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
        <LinearGradient colors={HeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
          <Ionicons name="sparkles" size={26} color={Colors.accentText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.inviteTitle}>Get your training program</Text>
            <Text style={styles.inviteBody}>Built by AI for your goal, schedule and equipment.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.accentText} />
        </LinearGradient>
      </Pressable>
    );
  }

  const day = program.days[program.next];
  if (!day) return null;
  const doneToday = program.lastDoneAt !== null && dayKey(new Date(program.lastDoneAt)) === dayKey(new Date(now));
  const week = programWeek(program.started_at, program.weeks, now);

  return (
    <Card style={styles.card}>
      <Pressable onPress={() => router.push('/program')} style={styles.header} hitSlop={6}>
        <Text style={styles.label}>
          {doneToday ? 'DONE TODAY · NEXT UP' : 'TODAY'} · WEEK {week} OF {program.weeks}
        </Text>
        <Text style={styles.link}>Program ›</Text>
      </Pressable>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{day.name}</Text>
          <Text style={styles.muted} numberOfLines={2}>
            {day.exercise_count} exercises · ~{day.minutes} min · {day.exercises}
          </Text>
        </View>
        <Pressable
          onPress={() => onStart(day.routine_id)}
          style={({ pressed }) => [styles.play, pressed && { opacity: 0.7 }]}
          accessibilityLabel={`Start ${day.name}`}>
          <Ionicons name="play" size={24} color={Colors.accentText} />
        </Pressable>
      </View>
      {doneToday && <Text style={styles.rest}>Nice work today. Rest and recover, or go again if it&apos;s on your plan.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  invite: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  inviteTitle: { color: Colors.accentText, fontSize: 18, fontWeight: '800' },
  inviteBody: { color: Colors.accentText, fontSize: 13, opacity: 0.8 },
  card: { gap: Spacing.md, borderWidth: 1, borderColor: Colors.accent },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  link: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rest: { color: Colors.textSecondary, fontSize: 13 },
});
