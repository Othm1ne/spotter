/**
 * Smart reminders: which notifications to schedule over the next days, skipping what is already
 * done today (meal logged, water goal reached, weighed in, trained). Pure: no db, no notifications.
 */
import { dayKey, startOfWeek } from './stats';

/** Times are "HH:MM", 24-hour. */
export type ReminderSettings = {
  meals: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  water: boolean;
  waterStart: string;
  waterEnd: string;
  waterEveryHours: number;
  weighIn: boolean;
  weighInTime: string;
  workout: boolean;
  workoutTime: string;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  meals: false,
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:30',
  water: false,
  waterStart: '10:00',
  waterEnd: '20:00',
  waterEveryHours: 2,
  weighIn: false,
  weighInTime: '07:30',
  workout: false,
  workoutTime: '18:00',
};

export type ReminderState = {
  mealsLogged: string[];
  waterMl: number;
  waterTarget: number | null;
  weighedToday: boolean;
  trainedToday: boolean;
  workoutsThisWeek: number;
  weeklyGoal: number;
  nextWorkout: string | null;
};

export type Reminder = { id: string; at: Date; title: string; body: string; url: string };

export function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function at(day: Date, time: string): Date {
  const { hour, minute } = parseTime(time);
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const MEALS = [
  { key: 'breakfast', title: 'Breakfast time', body: 'Log your breakfast: your usual is one tap away.' },
  { key: 'lunch', title: 'Lunch time', body: 'Log your lunch and see what is left for today.' },
  { key: 'dinner', title: 'Dinner time', body: 'Log your dinner to close the day on target.' },
] as const;

/**
 * Reminders for today (from now) and the following days. Today's are skipped when the thing is
 * already done; later days are scheduled in full and refreshed the next time the app opens.
 */
export function planReminders(s: ReminderSettings, state: ReminderState, now: Date, days = 2): Reminder[] {
  const out: Reminder[] = [];
  const goalReached = state.workoutsThisWeek >= state.weeklyGoal;
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const key = dayKey(day);
    const today = offset === 0;

    if (s.meals) {
      for (const meal of MEALS) {
        if (today && state.mealsLogged.includes(meal.key)) continue;
        out.push({ id: `meal-${meal.key}-${key}`, at: at(day, s[meal.key]), title: meal.title, body: meal.body, url: '/nutrition' });
      }
    }

    if (s.water && !(today && state.waterTarget !== null && state.waterMl >= state.waterTarget)) {
      const start = parseTime(s.waterStart);
      const end = parseTime(s.waterEnd);
      const target = state.waterTarget ? ` Goal: ${(state.waterTarget / 1000).toFixed(1)} L today.` : '';
      for (let h = start.hour; h * 60 + start.minute <= end.hour * 60 + end.minute; h += Math.max(1, s.waterEveryHours)) {
        out.push({
          id: `water-${h}-${key}`,
          at: at(day, formatTime(h, start.minute)),
          title: 'Water break',
          body: `Drink a glass of water.${target}`,
          url: '/nutrition',
        });
      }
    }

    if (s.weighIn && !(today && state.weighedToday)) {
      out.push({
        id: `weigh-${key}`,
        at: at(day, s.weighInTime),
        title: 'Morning weigh-in',
        body: 'Step on the scale before breakfast: it keeps your calorie target accurate.',
        url: '/weight',
      });
    }

    // Weekly goal reached: no more workout nudges until the next week starts.
    const sameWeek = dayKey(startOfWeek(day)) === dayKey(startOfWeek(now));
    if (s.workout && !(today && state.trainedToday) && !(sameWeek && goalReached)) {
      out.push({
        id: `workout-${key}`,
        at: at(day, s.workoutTime),
        title: today && state.nextWorkout ? `Today: ${state.nextWorkout}` : 'Time to train',
        body: state.nextWorkout
          ? `${state.nextWorkout} is next. Your weights are ready.`
          : sameWeek
            ? `${state.weeklyGoal - state.workoutsThisWeek} workouts to go this week.`
            : 'A new week: start it strong.',
        url: '/train',
      });
    }
  }
  // Only the future, with a minute of margin.
  return out.filter((r) => r.at.getTime() > now.getTime() + 60_000).sort((a, b) => a.at.getTime() - b.at.getTime());
}
