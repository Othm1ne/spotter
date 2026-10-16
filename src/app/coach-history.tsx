import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Empty } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  deleteConversation,
  getActiveConversation,
  listConversations,
  setActiveConversation,
  type Conversation,
} from '@/db/coach';

/** Past coach conversations. Tap to reopen one, hold to delete it. */
export default function CoachHistoryScreen() {
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

  function onDelete(c: Conversation) {
    Alert.alert('Delete this chat?', c.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteConversation(db, c.id);
          if (c.id === active) await setActiveConversation(db, null);
          load();
        },
      },
    ]);
  }

  return (
    <FlatList
      style={styles.screen}
      data={conversations}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Pressable onPress={() => open(null)} style={({ pressed }) => [styles.newChat, pressed && { opacity: 0.8 }]}>
          <Ionicons name="add" size={22} color={Colors.accentText} />
          <Text style={styles.newChatText}>New chat</Text>
        </Pressable>
      }
      ListEmptyComponent={<Empty title="No chats yet" body="Your conversations with the coach are saved here." />}
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
              {formatWhen(item.updated_at)} · {item.message_count} message{item.message_count === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>
      )}
      ListFooterComponent={
        conversations.length > 0 ? <Text style={styles.hint}>Hold a chat to delete it.</Text> : null
      }
    />
  );
}

function formatWhen(time: number) {
  const date = new Date(time);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 60 },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    height: 52,
    marginBottom: Spacing.sm,
  },
  newChatText: { color: Colors.accentText, fontSize: 16, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowActive: { borderColor: Colors.accent },
  title: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  preview: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  hint: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: Spacing.md },
});
