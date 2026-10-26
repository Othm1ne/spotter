import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import { getProfile } from '@/db/profile';
import { getCandidates } from '@/db/program';
import { getExerciseHistory, type Exercise } from '@/db/workouts';
import { aiLanguageName, useT } from '@/i18n';
import { buildPlanReviewPrompt, parsePlanReview, type PlanItem, type PlanReview, type PlanSuggestion } from '@/lib/plan-review';
import { candidateNames, filterCandidates } from '@/lib/program';
import { formatDuration, formatWeight } from '@/lib/workout-math';
import { aiChat, aiConfigured, aiErrorMessage } from '@/services/ai';
import { makeStyles, useColors } from '@/theme';

/** What the review needs to know about each exercise of the plan being edited. */
export type ReviewBlock = { exercise: Exercise; sets: number; reps: string; restSeconds: number };

const ICONS: Record<PlanSuggestion['type'], IconName> = {
  swap: 'swap-horizontal',
  sets: 'layers',
  reps: 'repeat',
  rest: 'timer',
  remove: 'remove-circle',
  add: 'add-circle',
};

/**
 * "Review with AI" for a workout plan: the coach looks at the plan and how the last sessions went,
 * and proposes changes. Nothing changes until the user taps Apply on a suggestion.
 */
export function PlanReviewCard({
  planName,
  blocks,
  onApply,
}: {
  planName: string;
  blocks: ReviewBlock[];
  onApply: (suggestion: PlanSuggestion, exercises: Map<number, Exercise>) => void;
}) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<PlanReview | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [exercises, setExercises] = useState<Map<number, Exercise>>(new Map());

  if (!aiConfigured || blocks.length === 0) return null;

  async function run() {
    setLoading(true);
    setError(null);
    setApplied(new Set());
    try {
      const profile = await getProfile(db);
      const all = await getCandidates(db, candidateNames(profile?.equipment ?? 'full_gym'));
      const candidates = profile ? filterCandidates(all, profile) : all;
      const known = new Map<number, Exercise>([...all.map((e) => [e.id, e] as const), ...blocks.map((b) => [b.exercise.id, b.exercise] as const)]);
      setExercises(known);
      const history = await getExerciseHistory(db, blocks.map((b) => b.exercise.id), 3);
      const items: PlanItem[] = blocks.map((b) => ({
        exerciseId: b.exercise.id,
        name: b.exercise.name,
        muscle: b.exercise.muscle,
        sets: b.sets,
        reps: b.reps,
        restSeconds: b.restSeconds,
        history: (history.get(b.exercise.id) ?? []).map((session) => {
          const top = Math.max(0, ...session.map((s) => s.weight ?? 0));
          return `${top ? `${formatWeight(top)} kg` : 'bodyweight'} × ${session.map((s) => s.reps ?? '?').join(', ')}`;
        }),
      }));
      const raw = await aiChat(
        [
          { role: 'system', content: 'You are Spotter Coach, an expert strength coach. Be specific and practical. Reply with JSON only.' },
          { role: 'user', content: buildPlanReviewPrompt(planName, items, profile, candidates, aiLanguageName()) },
        ],
        { json: true, maxTokens: 1200 }
      );
      const parsed = parsePlanReview(raw, new Set(blocks.map((b) => b.exercise.id)), new Set(candidates.map((x) => x.id)));
      if (!parsed) throw new Error('invalid');
      setReview(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function apply(i: number, suggestion: PlanSuggestion) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply(suggestion, exercises);
    setApplied((s) => new Set(s).add(i));
  }

  const nameOf = (id: number) => exercises.get(id)?.name ?? '?';

  function title(s: PlanSuggestion) {
    switch (s.type) {
      case 'swap':
        return t('planReview.swap', { from: nameOf(s.exerciseId), to: nameOf(s.newExerciseId) });
      case 'sets':
        return t('planReview.sets', { name: nameOf(s.exerciseId), count: s.sets });
      case 'reps':
        return t('planReview.reps', { name: nameOf(s.exerciseId), reps: s.repMin === s.repMax ? s.repMin : `${s.repMin}–${s.repMax}` });
      case 'rest':
        return t('planReview.rest', { name: nameOf(s.exerciseId), time: formatDuration(s.restSeconds) });
      case 'remove':
        return t('planReview.remove', { name: nameOf(s.exerciseId) });
      case 'add':
        return t('planReview.add', { name: nameOf(s.newExerciseId), sets: s.sets, reps: `${s.repMin}–${s.repMax}` });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={c.accent} />
        <Text style={styles.title}>{t('planReview.title')}</Text>
        {loading ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <Pressable onPress={run} hitSlop={8}>
            <Text style={styles.action}>{review ? t('planReview.again') : t('planReview.start')}</Text>
          </Pressable>
        )}
      </View>
      {!review && !loading && !error && <Text style={styles.muted}>{t('planReview.intro')}</Text>}
      {loading && <Text style={styles.muted}>{t('planReview.reading')}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {review && !loading && (
        <>
          {review.summary ? <Text style={styles.summary}>{review.summary}</Text> : null}
          {review.suggestions.length === 0 && <Text style={styles.muted}>{t('planReview.none')}</Text>}
          {review.suggestions.map((s, i) => (
            <View key={i} style={styles.suggestion}>
              <Ionicons name={ICONS[s.type]} size={20} color={c.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.suggestionTitle}>{title(s)}</Text>
                {s.reason ? <Text style={styles.muted}>{s.reason}</Text> : null}
              </View>
              {applied.has(i) ? (
                <View style={styles.appliedBadge}>
                  <Ionicons name="checkmark" size={16} color={c.success} />
                </View>
              ) : (
                <Pressable onPress={() => apply(i, s)} style={styles.apply} accessibilityLabel={t('planReview.apply')}>
                  <Text style={styles.applyText}>{t('planReview.apply')}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { color: c.text, fontSize: 17, fontWeight: '800', flex: 1 },
  action: { color: c.accent, fontSize: 15, fontWeight: '700' },
  muted: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  error: { color: c.danger, fontSize: 14 },
  summary: { color: c.text, fontSize: 15, lineHeight: 21 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  suggestionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  apply: { backgroundColor: c.accent, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, alignSelf: 'center' },
  applyText: { color: c.accentText, fontSize: 14, fontWeight: '800' },
  appliedBadge: { alignSelf: 'center', padding: 6 },
}));
