import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Card } from '@/components/ui';
import { Colors, Radius, Spacing, TierColors as TIER_COLORS } from '@/constants/theme';
import { useAskCoach } from '@/hooks/use-ask-coach';
import { useSupplementContext } from '@/hooks/use-supplement-context';
import { forYou, SUPPLEMENTS, TIERS } from '@/lib/supplements';

/** One supplement: what it does, the dose for you, safety, and questions for the coach. */
export default function SupplementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useSupplementContext();
  const ask = useAskCoach();
  const s = SUPPLEMENTS.find((x) => x.id === id);
  if (!s) return <View style={styles.screen} />;
  const tier = TIERS.find((t) => t.value === s.tier);
  const reason = forYou(s, ctx);


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: Spacing.sm }}>
        <View style={[styles.badge, { borderColor: TIER_COLORS[s.tier] }]}>
          <Ionicons name={s.icon as IconName} size={13} color={TIER_COLORS[s.tier]} />
          <Text style={[styles.badgeText, { color: TIER_COLORS[s.tier] }]}>{tier?.title}</Text>
        </View>
        <Text style={styles.title}>{s.name}</Text>
        <Text style={styles.body}>{s.summary}</Text>
        {reason && (
          <View style={styles.forYou}>
            <Ionicons name="person-circle" size={18} color={Colors.accent} />
            <Text style={styles.forYouText}>{reason}</Text>
          </View>
        )}
      </View>

      {s.benefits.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.label}>WHAT IT DOES</Text>
          {s.benefits.map((b) => (
            <View key={b} style={styles.item}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.itemText}>{b}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.label}>{s.tier === 'skip' ? 'VERDICT' : 'HOW MUCH'}</Text>
        <Text style={styles.body}>{s.dose(ctx.profile)}</Text>
        {s.timing !== '—' && (
          <>
            <Text style={[styles.label, { marginTop: Spacing.sm }]}>WHEN</Text>
            <Text style={styles.body}>{s.timing}</Text>
          </>
        )}
      </Card>

      {s.safety.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.label}>GOOD TO KNOW</Text>
          {s.safety.map((b) => (
            <View key={b} style={styles.item}>
              <Ionicons name="information-circle" size={18} color={Colors.warning} />
              <Text style={styles.itemText}>{b}</Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.label}>ASK THE COACH</Text>
      {s.questions.map((q) => (
        <Pressable key={q} onPress={() => ask(q)} style={({ pressed }) => [styles.question, pressed && { opacity: 0.7 }]}>
          <Text style={styles.questionText}>{q}</Text>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.accent} />
        </Pressable>
      ))}
      <Text style={styles.disclaimer}>General guidance for healthy adults, not medical advice.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  title: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  body: { color: Colors.text, fontSize: 15, lineHeight: 22, opacity: 0.9 },
  forYou: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  forYouText: { color: Colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  card: { gap: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  item: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  itemText: { color: Colors.text, fontSize: 15, lineHeight: 21, flex: 1, opacity: 0.9 },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  questionText: { color: Colors.text, fontSize: 15, flex: 1 },
  disclaimer: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: Spacing.sm },
});
