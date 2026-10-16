import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { listWeights } from '@/db/body';
import { getProfile } from '@/db/profile';
import { calorieCheckIn, smoothedWeight, weeklyRate, type WeightEntry } from '@/lib/body';
import { computeTargets } from '@/lib/nutrition';
import type { Profile } from '@/lib/profile';
import { dayKey } from '@/lib/stats';

/** Profile, weigh-ins and the targets derived from them, reloaded on focus. */
export function useBody() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);

  const reload = useCallback(async () => {
    const [p, w] = await Promise.all([getProfile(db), listWeights(db)]);
    setProfile(p);
    setWeights(w);
    setLoaded(true);
    setLoadedAt(Date.now());
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return useMemo(() => {
    const now = loadedAt;
    const latest = weights.at(-1) ?? null;
    const average = smoothedWeight(weights, now);
    // Targets follow the smoothed weight so one salty dinner doesn't change them.
    const currentWeight = average ?? latest?.weight ?? profile?.weightKg ?? null;
    const targets = profile && currentWeight ? computeTargets(profile, currentWeight, new Date(now)) : null;
    const rate = weeklyRate(weights, now);
    const checkIn = profile && rate ? calorieCheckIn(profile.goal, rate) : null;
    const loggedToday = latest !== null && dayKey(latest.measured_at) === dayKey(now);
    return { loaded, profile, weights, latest, average, currentWeight, targets, rate, checkIn, loggedToday, reload };
  }, [loaded, loadedAt, profile, weights, reload]);
}
