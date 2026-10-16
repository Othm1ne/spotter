import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { startRoutine } from '@/db/routines';
import { getActiveWorkout } from '@/db/workouts';

/** Starts a workout from a plan and opens it, unless another workout is still in progress. */
export function useStartRoutine() {
  const db = useSQLiteContext();
  return async (routineId: number) => {
    const active = await getActiveWorkout(db);
    if (active) {
      Alert.alert('Workout in progress', `Finish or discard "${active.name}" before starting another one.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume', onPress: () => router.push('/workout') },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startRoutine(db, routineId);
    router.push('/workout');
  };
}
