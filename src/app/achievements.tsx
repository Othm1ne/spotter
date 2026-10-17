import { ScrollView, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { useStats } from '@/hooks/use-stats';
import type { Achievement } from '@/lib/achievements';

export default function AchievementsScreen() {
  const t = useT();
  const styles = useStyles();
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
        <Text style={styles.muted}>{t('achievementsScreen.unlocked')}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(unlocked.length / achievements.length) * 100}%` }]} />
        </View>
      </View>

      {unlocked.length > 0 && <Text style={styles.section}>{t('achievementsScreen.unlockedTitle')}</Text>}
      <View style={styles.grid}>
        {unlocked.map((a) => (
          <Badge key={a.id} achievement={a} />
        ))}
      </View>

      <Text style={styles.section}>{t('achievementsScreen.upNext')}</Text>
      <View style={styles.grid}>
        {locked.map((a) => (
          <Badge key={a.id} achievement={a} />
        ))}
      </View>
    </ScrollView>
  );
}

function Badge({ achievement: a }: { achievement: Achievement }) {
  const t = useT();
  const styles = useStyles();
  return (
    <View style={[styles.badge, a.unlocked && styles.badgeUnlocked]}>
      <Text style={[styles.emoji, !a.unlocked && styles.emojiLocked]}>{a.emoji}</Text>
      <Text style={styles.title} numberOfLines={1}>
        {t(`achievements.${a.id}.title`)}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {t(`achievements.${a.id}.description`)}
      </Text>
      {a.unlocked ? (
        <Text style={styles.done}>{t('achievementsScreen.done')}</Text>
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

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  summary: { backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs },
  summaryValue: { color: c.text, fontSize: 40, fontWeight: '800' },
  summaryTotal: { color: c.textSecondary, fontSize: 24 },
  muted: { color: c.textSecondary, fontSize: 14, marginBottom: Spacing.sm },
  section: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    width: '48.5%',
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeUnlocked: { borderColor: c.accent },
  emoji: { fontSize: 38, marginBottom: 2 },
  emojiLocked: { opacity: 0.3 },
  title: { color: c.text, fontSize: 15, fontWeight: '800' },
  description: { color: c.textSecondary, fontSize: 12, textAlign: 'center', minHeight: 32 },
  done: { color: c.accent, fontSize: 12, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceRaised, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },
  progress: { color: c.textSecondary, fontSize: 11, textAlign: 'center', fontVariant: ['tabular-nums'] },
}));
