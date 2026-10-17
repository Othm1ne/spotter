import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { askCoachLater } from '@/db/coach';

/** Opens the Coach tab and asks `question` in a new chat, from any screen (closing open modals). */
export function useAskCoach() {
  const db = useSQLiteContext();
  return async (question: string) => {
    Haptics.selectionAsync();
    await askCoachLater(db, question);
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/coach');
  };
}
