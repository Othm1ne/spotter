import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { startRoutine } from '@/db/routines';
import { getActiveWorkout } from '@/db/workouts';
import { useT } from '@/i18n';

/** Starts a workout from a plan and opens it, unless another workout is still in progress. */
export function useStartRoutine() {
  const db = useSQLiteContext();
  const t = useT();
  return async (routineId: number) => {
    const active = await getActiveWorkout(db);
    if (active) {
      Alert.alert(t('startRoutine.busyTitle'), t('startRoutine.busyBody', { name: active.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('startRoutine.resume'), onPress: () => router.push('/workout') },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startRoutine(db, routineId);
    router.push('/workout');
  };
}
