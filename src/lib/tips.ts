/**
 * The Home coach tip: one short, timely piece of advice picked from the user's day. Rules run on
 * the phone (no AI, works offline); each tip has a follow-up question for the coach.
 */
export type TipInput = {
  hour: number;
  /** Day of the year, to rotate the general tips. */
  dayOfYear: number;
  hasProfile: boolean;
  kcalLeft: number | null;
  proteinLeft: number | null;
  waterMl: number;
  waterTarget: number | null;
  foodsToday: number;
  trainedToday: boolean;
  daysSinceWorkout: number | null;
  nextWorkout: string | null;
  weighedToday: boolean;
  streak: number;
};

export type Tip = { icon: string; title: string; body: string; question: string };

const GENERAL: Tip[] = [
  {
    icon: 'moon',
    title: 'Sleep is a performance tool',
    body: '7–9 hours of sleep improves strength, recovery and appetite control more than any supplement.',
    question: 'How does sleep affect my muscle gains and fat loss?',
  },
  {
    icon: 'trending-up',
    title: 'Small jumps win',
    body: 'Adding one rep or 2.5 kg at a time beats big jumps. Progress you can repeat for months is what builds muscle.',
    question: 'How do I keep progressing when my lifts stall?',
  },
  {
    icon: 'leaf',
    title: 'Plants on every plate',
    body: 'Vegetables and fruit at most meals add fiber and keep you full for few calories.',
    question: 'How much fiber should I eat and where do I get it?',
  },
  {
    icon: 'walk',
    title: 'Steps count too',
    body: 'A daily walk of 7,000–10,000 steps burns calories without hurting recovery from lifting.',
    question: 'Should I do cardio while I lift?',
  },
  {
    icon: 'timer',
    title: 'Leave 1–2 reps in the tank',
    body: 'Most sets work best stopped 1–2 reps before failure: nearly all the gains, much less fatigue.',
    question: 'How close to failure should my sets be?',
  },
  {
    icon: 'restaurant',
    title: 'Spread your protein',
    body: '3–5 meals with 25–40 g of protein each works a little better than one huge serving.',
    question: 'Give me easy high-protein meal ideas',
  },
  {
    icon: 'body',
    title: 'Warm up the lift itself',
    body: '2–3 lighter sets of your first exercise prepare joints and muscles better than long cardio.',
    question: 'What is the best way to warm up before lifting?',
  },
];

/** The most useful tip right now: specific situations first, then a general tip of the day. */
export function pickTip(t: TipInput): Tip {
  if (t.hasProfile && t.trainedToday && t.proteinLeft !== null && t.proteinLeft > 30 && t.hour >= 11) {
    return {
      icon: 'barbell',
      title: 'Refuel after training',
      body: `You trained today and still have ${Math.round(t.proteinLeft)} g of protein to go. A protein-rich meal now helps your muscles recover.`,
      question: 'What should I eat after training?',
    };
  }
  if (t.hasProfile && t.proteinLeft !== null && t.proteinLeft > 40 && t.hour >= 19 && t.foodsToday > 0) {
    return {
      icon: 'nutrition',
      title: 'Protein catch-up',
      body: `${Math.round(t.proteinLeft)} g of protein left today. Greek yogurt, cottage cheese, eggs or a shake are easy evening options.`,
      question: 'Give me a high-protein evening snack',
    };
  }
  if (t.waterTarget && t.hour >= 15 && t.waterMl < t.waterTarget * 0.4) {
    return {
      icon: 'water',
      title: 'Drink some water',
      body: `Only ${(t.waterMl / 1000).toFixed(1)} L so far of your ${(t.waterTarget / 1000).toFixed(1)} L. Even mild dehydration lowers strength and focus.`,
      question: 'How much water do I really need when I train?',
    };
  }
  if (t.hasProfile && !t.weighedToday && t.hour < 11) {
    return {
      icon: 'scale',
      title: 'Morning weigh-in',
      body: 'Weigh yourself now, after the bathroom and before eating. Daily weigh-ins make your trend, and your calorie target, more accurate.',
      question: 'Why does my weight change so much from day to day?',
    };
  }
  if (t.daysSinceWorkout !== null && t.daysSinceWorkout >= 4 && !t.trainedToday) {
    return {
      icon: 'flash',
      title: `${t.daysSinceWorkout} days since your last workout`,
      body: t.nextWorkout
        ? `Even a short ${t.nextWorkout} keeps the habit going. Do the first 3 exercises if time is tight.`
        : 'Even a short session keeps the habit going. 30 minutes is plenty.',
      question: 'I am short on time today: what is the most effective short workout?',
    };
  }
  if (t.nextWorkout && !t.trainedToday && t.hour < 20) {
    return {
      icon: 'play-circle',
      title: `Today: ${t.nextWorkout}`,
      body: 'Your suggested weights are ready. Start with 2 light warm-up sets on the first exercise.',
      question: `How should I warm up for ${t.nextWorkout}?`,
    };
  }
  if (t.streak >= 3) {
    return {
      icon: 'flame',
      title: `${t.streak}-day streak`,
      body: 'Consistency is what drives results. Rest days count as training too: muscles grow while you recover.',
      question: 'How many rest days do I need per week?',
    };
  }
  return GENERAL[t.dayOfYear % GENERAL.length];
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}
