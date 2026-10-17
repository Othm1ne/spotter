import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RichText } from '@/components/rich-text';
import { Colors, HeroGradient, Radius, Spacing } from '@/constants/theme';
import {
  addCoachMessage,
  createConversation,
  deleteCoachMessage,
  gatherCoachData,
  getActiveConversation,
  listCoachMessages,
  setActiveConversation,
  takePendingQuestion,
  type CoachData,
  type CoachMessage,
} from '@/db/coach';
import { buildCoachPrompt, suggestedQuestions } from '@/lib/coach';
import { aiChat, aiErrorMessage, type ChatMessage } from '@/services/ai';

/** Messages sent with each request, newest last. Keeps requests inside the free token budget. */
const CONTEXT_MESSAGES = 12;

const timestamp = () => Date.now();

export default function CoachTab() {
  const db = useSQLiteContext();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [data, setData] = useState<CoachData | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The focus callback runs once per focus; the ref gives it the latest send.
  const sendRef = useRef<typeof send>(null!);
  useEffect(() => {
    sendRef.current = send;
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Another screen may have asked a question: answer it in a new chat.
        const pending = await takePendingQuestion(db);
        if (pending) {
          await setActiveConversation(db, null);
          setConversationId(null);
          setMessages([]);
          setError(null);
          sendRef.current(pending, { conversationId: null, messages: [] });
          return;
        }
        // The history screen may have picked another conversation.
        const id = await getActiveConversation(db);
        setConversationId(id);
        setMessages(id ? await listCoachMessages(db, id) : []);
        setError(null);
        setData(await gatherCoachData(db));
      })();
    }, [db])
  );

  /** `base` overrides the current chat, for a question sent before state has caught up. */
  async function send(text: string, base = { conversationId, messages }) {
    const content = text.trim();
    if (!content || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setError(null);
    setSending(true);
    let conversation = base.conversationId;
    if (conversation === null) {
      conversation = await createConversation(db, content);
      await setActiveConversation(db, conversation);
      setConversationId(conversation);
    }
    const id = await addCoachMessage(db, conversation, 'user', content);
    const history = [
      ...base.messages,
      { id, conversation_id: conversation, role: 'user' as const, content, created_at: timestamp() },
    ];
    setMessages(history);
    try {
      // Fresh data every time, so the coach sees the workout you just finished.
      const fresh = await gatherCoachData(db);
      setData(fresh);
      const request: ChatMessage[] = [
        { role: 'system', content: buildCoachPrompt(fresh, new Date()) },
        ...history.slice(-CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
      ];
      const reply = await aiChat(request);
      const replyId = await addCoachMessage(db, conversation, 'assistant', reply);
      setMessages((all) => [
        ...all,
        { id: replyId, conversation_id: conversation, role: 'assistant', content: reply, created_at: timestamp() },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function retry() {
    const last = messages.at(-1);
    if (!last || last.role !== 'user') return;
    // Resend the unanswered question without storing it twice.
    setMessages((all) => all.slice(0, -1));
    deleteCoachMessage(db, last.id).then(() => send(last.content));
  }

  async function onNewChat() {
    Haptics.selectionAsync();
    await setActiveConversation(db, null);
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  const name = data?.profile?.name;
  const suggestions = data ? suggestedQuestions(data) : [];
  const reversed = [...messages].reverse();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Avatar size={34} />
          <View>
            <Text style={styles.title}>Coach</Text>
            <Text style={styles.subtitle}>{sending ? 'Thinking…' : 'Knows your training and goal'}</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => router.push('/coach-history')}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityLabel="Past chats">
            <Ionicons name="time-outline" size={22} color={Colors.text} />
          </Pressable>
          {messages.length > 0 && (
            <Pressable onPress={onNewChat} hitSlop={10} style={styles.iconButton} accessibilityLabel="New chat">
              <Ionicons name="create-outline" size={22} color={Colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.empty} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInUp.duration(400)} style={{ alignItems: 'center', gap: Spacing.md }}>
              <Avatar size={72} />
              <Text style={styles.emptyTitle}>{name ? `Hi ${name}, I'm your coach` : "Hi, I'm your coach"}</Text>
              <Text style={styles.emptyBody}>
                Ask me anything about training, nutrition or recovery. I can see your goal, your targets and your
                recent workouts.
              </Text>
            </Animated.View>
            <View style={styles.suggestions}>
              {suggestions.map((q, i) => (
                <Animated.View key={q} entering={FadeInUp.delay(150 + i * 80).duration(350)}>
                  <Pressable onPress={() => send(q)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="sparkles" size={16} color={Colors.accent} />
                    <Text style={styles.suggestionText}>{q}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            inverted
            data={reversed}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {sending && <Typing />}
                {error && (
                  <View style={styles.error}>
                    <Ionicons name="alert-circle" size={18} color={Colors.warning} />
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={retry} hitSlop={8}>
                      <Text style={styles.retry}>Retry</Text>
                    </Pressable>
                  </View>
                )}
              </>
            }
            renderItem={({ item }) =>
              item.role === 'user' ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{item.content}</Text>
                </View>
              ) : (
                <View style={styles.assistantRow}>
                  <Avatar size={26} />
                  <View style={styles.assistantBubble}>
                    <RichText text={item.content} />
                  </View>
                </View>
              )
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
            multiline
            maxLength={1500}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            style={[styles.send, (!input.trim() || sending) && { opacity: 0.35 }]}
            accessibilityLabel="Send">
            <Ionicons name="arrow-up" size={22} color={Colors.accentText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Avatar({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={HeroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="sparkles" size={size * 0.5} color={Colors.accentText} />
    </LinearGradient>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1));
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Typing() {
  return (
    <View style={styles.assistantRow}>
      <Avatar size={26} />
      <View style={[styles.assistantBubble, styles.typing]}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerButtons: { flexDirection: 'row', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl, gap: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: Colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  suggestions: { gap: Spacing.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  suggestionText: { color: Colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  userText: { color: Colors.accentText, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, maxWidth: '92%' },
  assistantBubble: {
    flexShrink: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  typing: { flexDirection: 'row', gap: 6, paddingVertical: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textSecondary },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 181, 71, 0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { color: Colors.text, fontSize: 14, flex: 1 },
  retry: { color: Colors.accent, fontWeight: '800' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    color: Colors.text,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
