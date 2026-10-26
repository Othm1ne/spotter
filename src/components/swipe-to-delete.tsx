import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Radius, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { makeStyles } from '@/theme';

/**
 * Swipe a row left to reveal a red Delete button, like Mail. Deleting asks first when `confirm`
 * is given (title of the confirmation).
 */
export function SwipeToDelete({
  children,
  onDelete,
  confirm,
}: {
  children: ReactNode;
  onDelete: () => void;
  confirm?: { title: string; message?: string };
}) {
  const t = useT();
  const styles = useStyles();
  const swipeable = useRef<SwipeableMethods>(null);

  function remove() {
    if (!confirm) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDelete();
      return;
    }
    Alert.alert(confirm.title, confirm.message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => swipeable.current?.close() },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete();
        },
      },
    ]);
  }

  return (
    <Swipeable
      ref={swipeable}
      friction={1.6}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={remove} style={styles.action} accessibilityLabel={t('common.delete')}>
          <Ionicons name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.label}>{t('common.delete')}</Text>
        </Pressable>
      )}>
      {children}
    </Swipeable>
  );
}

const useStyles = makeStyles((c) => ({
  action: {
    width: 92,
    marginLeft: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
}));
