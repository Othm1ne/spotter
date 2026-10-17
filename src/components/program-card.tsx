import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import type { Program } from '@/db/program';
import { programWeek } from '@/lib/program';
import { dayKey } from '@/lib/stats';

/** Home card: the next workout of the program, or an invite to build one. */
export function ProgramCard({ program, now, onStart }: { program: Program | null; now: number; onStart: (routineId: number) => void }) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  if (!program) {
    return (
      <Pressable onPress={() => router.push('/program')} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
          <Ionicons name="sparkles" size={26} color={c.accentText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.inviteTitle}>{t('programCard.inviteTitle')}</Text>
            <Text style={styles.inviteBody}>{t('programCard.inviteBody')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={c.accentText} />
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
          {t(doneToday ? 'programCard.doneToday' : 'programCard.today', { week, weeks: program.weeks })}
        </Text>
        <Text style={styles.link}>{t('programCard.link')}</Text>
      </Pressable>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{day.name}</Text>
          <Text style={styles.muted} numberOfLines={2}>
            {t('program.dayLine', { count: day.exercise_count, minutes: day.minutes, exercises: day.exercises ?? '' })}
          </Text>
        </View>
        <Pressable
          onPress={() => onStart(day.routine_id)}
          style={({ pressed }) => [styles.play, pressed && { opacity: 0.7 }]}
          accessibilityLabel={t('common.startNamed', { name: day.name })}>
          <Ionicons name="play" size={24} color={c.accentText} />
        </Pressable>
      </View>
      {doneToday && <Text style={styles.rest}>{t('programCard.rest')}</Text>}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  invite: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  inviteTitle: { color: c.accentText, fontSize: 18, fontWeight: '800' },
  inviteBody: { color: c.accentText, fontSize: 13, opacity: 0.8 },
  card: { gap: Spacing.md, borderWidth: 1, borderColor: c.accent },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: c.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  link: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { color: c.text, fontSize: 22, fontWeight: '800' },
  muted: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rest: { color: c.textSecondary, fontSize: 13 },
}));
