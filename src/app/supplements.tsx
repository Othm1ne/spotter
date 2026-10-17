import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Colors, Radius, Spacing, TierColors as TIER_COLORS } from '@/constants/theme';
import { useSupplementContext } from '@/hooks/use-supplement-context';
import { forYou, SUPPLEMENTS, TIERS } from '@/lib/supplements';

/** Evidence-based supplement guide, grouped by how much each one is worth it. */
export default function SupplementsScreen() {
  const ctx = useSupplementContext();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Food, sleep and training come first. These are the supplements with real evidence behind them, and the popular
        ones that aren&apos;t worth your money.
      </Text>
      {TIERS.map((tier) => (
        <View key={tier.value} style={{ gap: Spacing.sm }}>
          <View style={styles.tierHeader}>
            <View style={[styles.dot, { backgroundColor: TIER_COLORS[tier.value] }]} />
            <Text style={styles.tierTitle}>{tier.title}</Text>
            <Text style={styles.tierSubtitle}>{tier.subtitle}</Text>
          </View>
          {SUPPLEMENTS.filter((s) => s.tier === tier.value).map((s) => {
            const reason = forYou(s, ctx);
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/supplement/[id]', params: { id: s.id } })}
                style={({ pressed }) => [styles.card, reason && styles.cardForYou, pressed && { opacity: 0.8 }]}>
                <View style={[styles.icon, { backgroundColor: Colors.surfaceRaised }]}>
                  <Ionicons name={s.icon as IconName} size={20} color={TIER_COLORS[s.tier]} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.summary} numberOfLines={2}>
                    {s.summary}
                  </Text>
                  {reason && (
                    <View style={styles.forYou}>
                      <Ionicons name="person" size={11} color={Colors.accent} />
                      <Text style={styles.forYouText}>For you · {reason}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={styles.disclaimer}>
        General guidance for healthy adults, not medical advice. Check with a doctor or pharmacist if you take medication,
        are pregnant or have a health condition.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  intro: { color: Colors.textSecondary, fontSize: 15, lineHeight: 21 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tierTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  tierSubtitle: { color: Colors.textSecondary, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardForYou: { borderColor: Colors.accent },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  summary: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  forYou: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  forYouText: { color: Colors.accent, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  disclaimer: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
