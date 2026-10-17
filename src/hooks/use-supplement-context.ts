import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { foodNamesSince, intakeByDay } from '@/db/food';
import { useBody } from '@/hooks/use-body';
import { weekStats } from '@/lib/nutrition-review';
import { addDays, dayKey } from '@/lib/stats';
import { FISH, type SupplementContext } from '@/lib/supplements';

/** What the supplement guide needs to say "for you": profile, protein intake and fish in the log. */
export function useSupplementContext(): SupplementContext {
  const db = useSQLiteContext();
  const body = useBody();
  const [log, setLog] = useState<{ avgProtein: number | null; eatsFish: boolean | null; month: number }>({
    avgProtein: null,
    eatsFish: null,
    month: 0,
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const now = new Date();
        const today = dayKey(now);
        const [days, names] = await Promise.all([
          intakeByDay(db, dayKey(addDays(now, -7))),
          foodNamesSince(db, dayKey(addDays(now, -14))),
        ]);
        const past = days.filter((d) => d.day < today);
        const targets = body.targets;
        const stats = targets ? weekStats(past, targets, []) : null;
        setLog({
          avgProtein: stats && stats.daysLogged >= 3 ? stats.avgProtein : null,
          // Too little logged to say someone never eats fish.
          eatsFish: names.length >= 15 ? names.some((n) => FISH.test(n)) : null,
          month: now.getMonth(),
        });
      })();
    }, [db, body.targets])
  );

  return { profile: body.profile, proteinTarget: body.targets?.protein ?? null, ...log };
}
