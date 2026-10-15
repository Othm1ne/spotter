import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { DEFAULT_WEEKLY_GOAL, getWeeklyGoal } from '@/db/settings';
import { getLiftStats, listWorkoutStats } from '@/db/stats';
import { computeAchievements } from '@/lib/achievements';
import { dayStreaks, groupByDay, weekStreaks, type WorkoutStat } from '@/lib/stats';

/** History-wide stats, reloaded whenever the screen gains focus. */
export function useStats() {
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<WorkoutStat[]>([]);
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [lifts, setLifts] = useState({ heaviestWeight: 0, exercisesTried: 0 });
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [w, g, l] = await Promise.all([listWorkoutStats(db), getWeeklyGoal(db), getLiftStats(db)]);
        setWorkouts(w);
        setGoal(g);
        setLifts(l);
        setLoaded(true);
      })();
    }, [db])
  );

  return useMemo(() => {
    const now = new Date();
    const days = groupByDay(workouts);
    const dayStreak = dayStreaks(days, now);
    const weekStreak = weekStreaks(workouts, goal, now);
    const totals = workouts.reduce(
      (t, w) => ({ sets: t.sets + w.sets, volume: t.volume + w.volume }),
      { sets: 0, volume: 0 }
    );
    const hours = workouts.map((w) => new Date(w.started_at).getHours());
    const achievements = computeAchievements({
      workouts: workouts.length,
      sets: totals.sets,
      volume: totals.volume,
      longestDayStreak: dayStreak.longest,
      longestWeekStreak: weekStreak.longest,
      heaviestWeight: lifts.heaviestWeight,
      exercisesTried: lifts.exercisesTried,
      earlyBird: hours.some((h) => h < 7),
      nightOwl: hours.some((h) => h >= 21),
    });
    return { loaded, workouts, days, goal, dayStreak, weekStreak, totals, achievements };
  }, [loaded, workouts, goal, lifts]);
}
