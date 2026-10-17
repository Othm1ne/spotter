import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, dayKey } from '@/lib/stats';

import { listWeights } from './body';
import { dailyTotals, listEntries } from './food';
import { getProgram } from './program';
import { getProfile } from './profile';
import { getSetting, getWeeklyGoal, setSetting } from './settings';
import { getExerciseBests, listFinishedWorkouts } from './workouts';

export type CoachMessage = {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
};

export type Conversation = {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  preview: string | null;
};

const TITLE_LENGTH = 50;

export function listConversations(db: SQLiteDatabase) {
  return db.getAllAsync<Conversation>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM coach_messages m WHERE m.conversation_id = c.id) AS message_count,
       (SELECT substr(content, 1, 120) FROM coach_messages m
          WHERE m.conversation_id = c.id AND m.role = 'assistant' ORDER BY m.id DESC LIMIT 1) AS preview
     FROM coach_conversations c
     ORDER BY c.updated_at DESC`
  );
}

/** Starts a conversation titled after its first question. */
export async function createConversation(db: SQLiteDatabase, firstMessage: string) {
  const oneLine = firstMessage.replace(/\s+/g, ' ').trim();
  const title = oneLine.length > TITLE_LENGTH ? `${oneLine.slice(0, TITLE_LENGTH - 1)}…` : oneLine;
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO coach_conversations (title, created_at, updated_at) VALUES (?, ?, ?)',
    title,
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function deleteConversation(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM coach_conversations WHERE id = ?', id);
}

export function listCoachMessages(db: SQLiteDatabase, conversationId: number) {
  return db.getAllAsync<CoachMessage>(
    'SELECT * FROM coach_messages WHERE conversation_id = ? ORDER BY id',
    conversationId
  );
}

export async function addCoachMessage(
  db: SQLiteDatabase,
  conversationId: number,
  role: CoachMessage['role'],
  content: string
) {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO coach_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
    conversationId,
    role,
    content,
    now
  );
  await db.runAsync('UPDATE coach_conversations SET updated_at = ? WHERE id = ?', now, conversationId);
  return result.lastInsertRowId;
}

export async function deleteCoachMessage(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM coach_messages WHERE id = ?', id);
}

/** The conversation the Coach tab shows; null means a fresh, not-yet-saved chat. */
export async function getActiveConversation(db: SQLiteDatabase): Promise<number | null> {
  const value = await getSetting(db, 'coach_conversation');
  if (value === null) {
    // First visit: continue the most recent conversation, if any.
    const latest = await db.getFirstAsync<{ id: number }>('SELECT id FROM coach_conversations ORDER BY updated_at DESC LIMIT 1');
    return latest?.id ?? null;
  }
  const id = Number(value);
  if (!id) return null;
  const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM coach_conversations WHERE id = ?', id);
  return exists ? id : null;
}

export function setActiveConversation(db: SQLiteDatabase, id: number | null) {
  return setSetting(db, 'coach_conversation', id === null ? '0' : String(id));
}

/** A question asked from another screen (e.g. the supplement guide), sent in a new chat when the Coach tab opens. */
export function askCoachLater(db: SQLiteDatabase, question: string) {
  return setSetting(db, 'coach_pending', question);
}

/** Returns the pending question once, then clears it. */
export async function takePendingQuestion(db: SQLiteDatabase) {
  const question = await getSetting(db, 'coach_pending');
  if (question) await setSetting(db, 'coach_pending', '');
  return question || null;
}

/** Everything the coach should know about the user, gathered for the system prompt. */
export async function gatherCoachData(db: SQLiteDatabase) {
  const [profile, weights, goal, recent, bests, program] = await Promise.all([
    getProfile(db),
    listWeights(db),
    getWeeklyGoal(db),
    listFinishedWorkouts(db, 8),
    getExerciseBests(db),
    getProgram(db),
  ]);
  const topSets = await getTopSets(db, recent.map((w) => w.id));
  const today = dayKey(new Date());
  const [todayEntries, lastWeek] = await Promise.all([
    listEntries(db, today),
    dailyTotals(db, dayKey(addDays(new Date(), -7))),
  ]);
  return {
    profile,
    weights,
    weeklyGoal: goal,
    recent: recent.map((w) => ({ ...w, top: topSets.get(w.id) ?? [] })),
    bests: bests.slice(0, 12),
    program: program
      ? {
          name: program.name,
          weeks: program.weeks,
          startedAt: program.started_at,
          days: program.days.map((d) => `${d.name}: ${d.exercises ?? ''}`),
          next: program.days[program.next]?.name ?? null,
        }
      : null,
    todayFood: todayEntries.map((e) => ({ name: e.name, meal: e.meal, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat })),
    // Past days only: today is still in progress.
    lastWeekFood: lastWeek.filter((d) => d.day !== today),
  };
}

/** Per workout and exercise: completed set count and the heaviest set, in exercise order. */
async function getTopSets(db: SQLiteDatabase, workoutIds: number[]) {
  const result = new Map<number, { exercise: string; sets: number; weight: number | null; reps: number | null }[]>();
  if (workoutIds.length === 0) return result;
  const rows = await db.getAllAsync<{
    workout_id: number;
    exercise: string;
    sets: number;
    weight: number | null;
    reps: number | null;
  }>(
    `SELECT ws.workout_id, e.name AS exercise, COUNT(*) AS sets,
       MAX(COALESCE(ws.weight, 0)) AS weight,
       (SELECT s2.reps FROM workout_sets s2
          WHERE s2.workout_id = ws.workout_id AND s2.exercise_position = ws.exercise_position AND s2.done = 1
          ORDER BY COALESCE(s2.weight, 0) DESC, s2.reps DESC LIMIT 1) AS reps
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.done = 1 AND ws.workout_id IN (${workoutIds.map(() => '?').join(',')})
     GROUP BY ws.workout_id, ws.exercise_position
     ORDER BY ws.workout_id, ws.exercise_position`,
    ...workoutIds
  );
  for (const r of rows) {
    const list = result.get(r.workout_id) ?? [];
    list.push({ exercise: r.exercise, sets: r.sets, weight: r.weight, reps: r.reps });
    result.set(r.workout_id, list);
  }
  return result;
}

export type CoachData = Awaited<ReturnType<typeof gatherCoachData>>;
