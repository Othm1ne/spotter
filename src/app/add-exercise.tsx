import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { ExercisePicker } from '@/components/exercise-picker';
import { addExerciseToWorkout, type Exercise } from '@/db/workouts';

export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [adding, setAdding] = useState(false);

  async function pick(exercise: Exercise) {
    if (adding) return;
    setAdding(true);
    await addExerciseToWorkout(db, Number(workoutId), exercise.id);
    router.back();
  }

  return (
    <ExercisePicker
      onPick={pick}
      onInfo={(e) => router.push({ pathname: '/exercise/[id]', params: { id: String(e.id) } })}
    />
  );
}
