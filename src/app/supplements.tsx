import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useT } from '@/i18n';
import type { IconName } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { useSupplementContext } from '@/hooks/use-supplement-context';
import { forYou, SUPPLEMENTS, TIERS } from '@/lib/supplements';

/** Evidence-based supplement guide, grouped by how much each one is worth it. */
export default function SupplementsScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const ctx = useSupplementContext();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        {t('supp.intro')}
      </Text>
      {TIERS.map((tier) => (
        <View key={tier} style={{ gap: Spacing.sm }}>
          <View style={styles.tierHeader}>
            <View style={[styles.dot, { backgroundColor: c.tiers[tier] }]} />
            <Text style={styles.tierTitle}>{t(`supp.tier.${tier}.title`)}</Text>
            <Text style={styles.tierSubtitle}>{t(`supp.tier.${tier}.subtitle`)}</Text>
          </View>
          {SUPPLEMENTS.filter((s) => s.tier === tier).map((s) => {
            const reason = forYou(s, ctx);
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/supplement/[id]', params: { id: s.id } })}
                style={({ pressed }) => [styles.card, reason && styles.cardForYou, pressed && { opacity: 0.8 }]}>
                <View style={[styles.icon, { backgroundColor: c.surfaceRaised }]}>
                  <Ionicons name={s.icon as IconName} size={20} color={c.tiers[s.tier]} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{t(`supp.${s.id}.name`)}</Text>
                  <Text style={styles.summary} numberOfLines={2}>
                    {t(`supp.${s.id}.summary`)}
                  </Text>
                  {reason && (
                    <View style={styles.forYou}>
                      <Ionicons name="person" size={11} color={c.accent} />
                      <Text style={styles.forYouText}>{t('supp.forYouPrefix', { reason: t(`supp.forYou.${reason.key}`, reason.params) })}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={styles.disclaimer}>
        {t('supp.disclaimer')}
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  intro: { color: c.textSecondary, fontSize: 15, lineHeight: 21 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tierTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  tierSubtitle: { color: c.textSecondary, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardForYou: { borderColor: c.accent },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { color: c.text, fontSize: 16, fontWeight: '700' },
  summary: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  forYou: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  forYouText: { color: c.accent, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  disclaimer: { color: c.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
}));
