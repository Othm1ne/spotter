import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { hasTranslation, useT } from '@/i18n';
import type { IconName } from '@/components/icon';
import { Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { useAskCoach } from '@/hooks/use-ask-coach';
import { useSupplementContext } from '@/hooks/use-supplement-context';
import { caffeineDose, forYou, SUPPLEMENTS } from '@/lib/supplements';

/** One supplement: what it does, the dose for you, safety, and questions for the coach. */
export default function SupplementScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useSupplementContext();
  const ask = useAskCoach();
  const s = SUPPLEMENTS.find((x) => x.id === id);
  if (!s) return <View style={styles.screen} />;
  const reason = forYou(s, ctx);
  // Fields a supplement doesn't have (e.g. benefits of a "skip" one) are simply absent.
  const text = (field: string) => (hasTranslation(`supp.${s.id}.${field}`) ? t(`supp.${s.id}.${field}`) : null);
  // List fields are newline-separated in the translations.
  const list = (field: string) => text(field)?.split('\n') ?? [];
  const caffeine = s.id === 'caffeine' ? caffeineDose(ctx.profile) : null;
  const dose = caffeine ? t('supp.caffeine.doseFor', caffeine) : text('dose');
  const timing = text('timing');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: Spacing.sm }}>
        <View style={[styles.badge, { borderColor: c.tiers[s.tier] }]}>
          <Ionicons name={s.icon as IconName} size={13} color={c.tiers[s.tier]} />
          <Text style={[styles.badgeText, { color: c.tiers[s.tier] }]}>{t(`supp.tier.${s.tier}.title`)}</Text>
        </View>
        <Text style={styles.title}>{text('name')}</Text>
        <Text style={styles.body}>{text('summary')}</Text>
        {reason && (
          <View style={styles.forYou}>
            <Ionicons name="person-circle" size={18} color={c.accent} />
            <Text style={styles.forYouText}>{t(`supp.forYou.${reason.key}`, reason.params)}</Text>
          </View>
        )}
      </View>

      {list('benefits').length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.label}>{t('supp.whatItDoes')}</Text>
          {list('benefits').map((b) => (
            <View key={b} style={styles.item}>
              <Ionicons name="checkmark-circle" size={18} color={c.success} />
              <Text style={styles.itemText}>{b}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.label}>{s.tier === 'skip' ? t('supp.verdict') : t('supp.howMuch')}</Text>
        <Text style={styles.body}>{dose}</Text>
        {timing && (
          <>
            <Text style={[styles.label, { marginTop: Spacing.sm }]}>{t('supp.when')}</Text>
            <Text style={styles.body}>{timing}</Text>
          </>
        )}
      </Card>

      {list('safety').length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.label}>{t('supp.goodToKnow')}</Text>
          {list('safety').map((b) => (
            <View key={b} style={styles.item}>
              <Ionicons name="information-circle" size={18} color={c.warning} />
              <Text style={styles.itemText}>{b}</Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.label}>{t('common.askCoach')}</Text>
      {list('questions').map((q) => (
        <Pressable key={q} onPress={() => ask(q)} style={({ pressed }) => [styles.question, pressed && { opacity: 0.7 }]}>
          <Text style={styles.questionText}>{q}</Text>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.accent} />
        </Pressable>
      ))}
      <Text style={styles.disclaimer}>{t('supp.disclaimerShort')}</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
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
  title: { color: c.text, fontSize: 28, fontWeight: '800' },
  body: { color: c.text, fontSize: 15, lineHeight: 22, opacity: 0.9 },
  forYou: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: c.accent,
  },
  forYouText: { color: c.text, fontSize: 14, lineHeight: 20, flex: 1 },
  card: { gap: Spacing.sm },
  label: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  item: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  itemText: { color: c.text, fontSize: 15, lineHeight: 21, flex: 1, opacity: 0.9 },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  questionText: { color: c.text, fontSize: 15, flex: 1 },
  disclaimer: { color: c.textSecondary, fontSize: 12, textAlign: 'center', marginTop: Spacing.sm },
}));
