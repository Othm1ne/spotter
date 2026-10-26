import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { useT, useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import {
  deleteConversation,
  getActiveConversation,
  listConversations,
  setActiveConversation,
  type Conversation,
} from '@/db/coach';

/** Past coach conversations. Tap to reopen one, hold to delete it. */
export default function CoachHistoryScreen() {
  const { locale } = useI18n();
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<number | null>(null);

  const load = useCallback(async () => {
    setConversations(await listConversations(db));
    setActive(await getActiveConversation(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function open(id: number | null) {
    Haptics.selectionAsync();
    await setActiveConversation(db, id);
    router.back();
  }

  function onDelete(chat: Conversation) {
    Alert.alert(t('chats.deleteTitle'), chat.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteConversation(db, chat.id);
          if (chat.id === active) await setActiveConversation(db, null);
          load();
        },
      },
    ]);
  }

  return (
    <FlatList
      style={styles.screen}
      data={conversations}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Pressable onPress={() => open(null)} style={({ pressed }) => [styles.newChat, pressed && { opacity: 0.8 }]}>
          <Ionicons name="add" size={22} color={c.accentText} />
          <Text style={styles.newChatText}>{t('coach.newChat')}</Text>
        </Pressable>
      }
      ListEmptyComponent={<Empty title={t('chats.emptyTitle')} body={t('chats.emptyBody')} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open(item.id)}
          onLongPress={() => onDelete(item)}
          style={({ pressed }) => [styles.row, item.id === active && styles.rowActive, pressed && { opacity: 0.7 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {item.preview ? (
              <Text style={styles.preview} numberOfLines={2}>
                {item.preview.replace(/[*#>|]/g, '').replace(/\s+/g, ' ').trim()}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {formatWhen(item.updated_at, locale)} · {t('chats.messages', { count: item.message_count })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </Pressable>
      )}
      ListFooterComponent={
        conversations.length > 0 ? <Text style={styles.hint}>{t('chats.hint')}</Text> : undefined
      }
    />
  );
}

function formatWhen(time: number, locale: string) {
  const date = new Date(time);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 60 },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: c.accent,
    borderRadius: Radius.md,
    height: 52,
    marginBottom: Spacing.sm,
  },
  newChatText: { color: c.accentText, fontSize: 16, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowActive: { borderColor: c.accent },
  title: { color: c.text, fontSize: 16, fontWeight: '700' },
  preview: { color: c.textSecondary, fontSize: 14, lineHeight: 19 },
  meta: { color: c.textSecondary, fontSize: 12 },
  hint: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: Spacing.md },
}));
