import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useStats } from '@/hooks/use-stats';
import type { Achievement } from '@/lib/achievements';

export default function AchievementsScreen() {
  const { achievements } = useStats();
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.value / b.target - a.value / a.target);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.summaryValue}>
          {unlocked.length}
          <Text style={styles.summaryTotal}> / {achievements.length}</Text>
        </Text>
        <Text style={styles.muted}>achievements unlocked</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(unlocked.length / achievements.length) * 100}%` }]} />
        </View>
      </View>

      {unlocked.length > 0 && <Text style={styles.section}>Unlocked</Text>}
      <View style={styles.grid}>
        {unlocked.map((a) => (
          <Badge key={a.id} achievement={a} />
        ))}
      </View>

      <Text style={styles.section}>Up next</Text>
      <View style={styles.grid}>
        {locked.map((a) => (
          <Badge key={a.id} achievement={a} />
        ))}
      </View>
    </ScrollView>
  );
}

function Badge({ achievement: a }: { achievement: Achievement }) {
  return (
    <View style={[styles.badge, a.unlocked && styles.badgeUnlocked]}>
      <Text style={[styles.emoji, !a.unlocked && styles.emojiLocked]}>{a.emoji}</Text>
      <Text style={styles.title} numberOfLines={1}>
        {a.title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {a.description}
      </Text>
      {a.unlocked ? (
        <Text style={styles.done}>✓ Unlocked</Text>
      ) : (
        <View style={{ gap: 4, alignSelf: 'stretch' }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(a.value / a.target) * 100}%` }]} />
          </View>
          <Text style={styles.progress}>
            {formatProgress(a.value)} / {formatProgress(a.target)}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatProgress(n: number) {
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k`;
  return String(Math.floor(n));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  summary: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs },
  summaryValue: { color: Colors.text, fontSize: 40, fontWeight: '800' },
  summaryTotal: { color: Colors.textSecondary, fontSize: 24 },
  muted: { color: Colors.textSecondary, fontSize: 14, marginBottom: Spacing.sm },
  section: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeUnlocked: { borderColor: Colors.accent },
  emoji: { fontSize: 38, marginBottom: 2 },
  emojiLocked: { opacity: 0.3 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  description: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', minHeight: 32 },
  done: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceRaised, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Colors.accent },
  progress: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
