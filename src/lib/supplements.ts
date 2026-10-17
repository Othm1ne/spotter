/**
 * Hand-written supplement guide, based on position stands from the International Society of
 * Sports Nutrition and the IOC consensus on supplements (2018). Pure data and rules: no AI, so it
 * stays accurate and works offline. Doses are for healthy adults.
 */
import type { Profile } from './profile';

export type Tier = 'strong' | 'situational' | 'skip';

export type Supplement = {
  id: string;
  name: string;
  tier: Tier;
  icon: string;
  summary: string;
  benefits: string[];
  dose: (profile: Profile | null) => string;
  timing: string;
  safety: string[];
  /** Follow-up questions for the coach. */
  questions: string[];
};

export const TIERS: { value: Tier; title: string; subtitle: string }[] = [
  { value: 'strong', title: 'Worth it', subtitle: 'Strong evidence, safe, cheap' },
  { value: 'situational', title: 'Sometimes useful', subtitle: 'Only in the right situation' },
  { value: 'skip', title: 'Save your money', subtitle: 'Popular, but little or no benefit' },
];

export const SUPPLEMENTS: Supplement[] = [
  {
    id: 'creatine',
    name: 'Creatine monohydrate',
    tier: 'strong',
    icon: 'flash',
    summary: 'The most researched supplement for lifting: a few more reps per set, which adds up to more strength and muscle.',
    benefits: [
      'More strength and power in short, hard efforts',
      'More muscle gained over months of training',
      'Faster recovery between sets',
    ],
    dose: () => '3–5 g every day, training day or not. No loading phase needed; it just takes 3–4 weeks to fully kick in.',
    timing: 'Any time of day, with water or a meal. Consistency matters more than timing.',
    safety: [
      'Expect 1–2 kg of extra water stored in the muscles in the first weeks: that is not fat.',
      'Safe for healthy people in long-term studies. Talk to a doctor first if you have kidney disease.',
      'Buy plain creatine monohydrate: the fancier forms cost more and work no better.',
    ],
    questions: ['Should I take creatine on rest days?', 'Does creatine cause hair loss or bloating?', 'Do I need to cycle creatine?'],
  },
  {
    id: 'protein',
    name: 'Protein powder',
    tier: 'strong',
    icon: 'nutrition',
    summary: 'Just food in powder form: a convenient way to reach your daily protein when meals fall short.',
    benefits: ['Makes the daily protein target easy to hit', 'Quick after training or as a snack', 'Cheap per gram of protein'],
    dose: () => '20–40 g per serving, only as much as you need to reach your daily protein target. Food first.',
    timing: 'Whenever it helps you hit your total. Spreading protein over 3–5 meals is a little better than one big dose.',
    safety: [
      'Whey is fine for most people; pick a lactose-free isolate or a plant blend (pea + rice) if dairy bothers you.',
      'Choose brands with third-party testing (e.g. Informed Sport) to avoid contamination.',
    ],
    questions: ['Whey or plant protein: which is better for me?', 'How can I hit my protein without a shake?', 'Is a shake right after training necessary?'],
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    tier: 'strong',
    icon: 'cafe',
    summary: 'A proven performance booster: more strength, endurance and focus, and training feels easier.',
    benefits: ['Better endurance and a little more strength', 'More focus and less perceived effort', 'Coffee works as well as pills'],
    dose: (p) => {
      const kg = p?.weightKg;
      if (!kg) return '3 mg per kg of body weight is enough for most people; start lower if you are sensitive.';
      return `About ${Math.round(kg * 2)}–${Math.min(400, Math.round(kg * 3))} mg for you (2–3 mg per kg). A strong coffee has about 100 mg. Stay under 400 mg a day.`;
    },
    timing: '30–60 minutes before training. Avoid it in the 8 hours before bed: poor sleep costs more than caffeine gives.',
    safety: [
      'Skip it if you are pregnant, have heart problems or anxiety, or are under 18.',
      'Pre-workouts often hide 300+ mg per scoop: check the label.',
    ],
    questions: ['Is pre-workout worth it compared to coffee?', 'I train in the evening: should I still use caffeine?', 'Will caffeine stop working if I use it daily?'],
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D',
    tier: 'situational',
    icon: 'sunny',
    summary: 'Useful if you get little sun, especially in winter: low vitamin D is common and affects bones, muscles and immunity.',
    benefits: ['Fixes a deficiency, which is common from October to March', 'Supports bones, muscle function and immunity'],
    dose: () => '1,000–2,000 IU (25–50 µg) a day. A blood test tells you if you actually need it.',
    timing: 'With a meal that contains some fat.',
    safety: ['Do not go above 4,000 IU a day without a doctor: too much builds up in the body.'],
    questions: ['How do I know if I need vitamin D?', 'Should I take vitamin D in summer too?'],
  },
  {
    id: 'omega-3',
    name: 'Omega-3 (fish oil)',
    tier: 'situational',
    icon: 'fish',
    summary: 'Good for heart health if you rarely eat oily fish. Effects on muscle and fat loss are small.',
    benefits: ['Heart and general health', 'May slightly reduce muscle soreness'],
    dose: () => '1–2 g of EPA + DHA a day (read the label: a 1 g capsule often has only 300 mg). Or eat oily fish twice a week.',
    timing: 'With meals, to avoid fishy burps.',
    safety: ['Ask a doctor first if you take blood thinners.', 'Algae oil is a vegan alternative.'],
    questions: ['Fish or fish oil capsules: which is better?', 'Which foods give me omega-3 if I do not eat fish?'],
  },
  {
    id: 'beta-alanine',
    name: 'Beta-alanine',
    tier: 'situational',
    icon: 'timer',
    summary: 'Helps hard efforts lasting 1–4 minutes (high-rep sets, circuits, rowing). Little effect on heavy, low-rep lifting.',
    benefits: ['A little more endurance in 1–4 minute efforts'],
    dose: () => '3.2–6.4 g a day split into smaller doses, for at least 4 weeks.',
    timing: 'Any time; it works by building up, not on the day.',
    safety: ['The tingling skin feeling is harmless; smaller split doses avoid it.'],
    questions: ['Is beta-alanine useful for my training?'],
  },
  {
    id: 'magnesium',
    name: 'Magnesium',
    tier: 'situational',
    icon: 'moon',
    summary: 'Only useful if your diet is low in it (few nuts, seeds, greens, whole grains). Not a sleep pill otherwise.',
    benefits: ['Fixes a low intake', 'May help sleep and cramps when intake was low'],
    dose: () => '200–350 mg a day as glycinate or citrate.',
    timing: 'In the evening is fine.',
    safety: ['Higher doses can cause diarrhea, especially magnesium oxide.', 'Ask a doctor if you have kidney problems.'],
    questions: ['Which foods are high in magnesium?'],
  },
  {
    id: 'bcaa',
    name: 'BCAAs / EAAs',
    tier: 'skip',
    icon: 'close-circle',
    summary: 'If you eat enough protein, BCAAs add nothing: protein already contains them.',
    benefits: [],
    dose: () => 'Not needed. Put the money toward food or protein powder.',
    timing: '—',
    safety: [],
    questions: ['Why are BCAAs useless if I eat enough protein?'],
  },
  {
    id: 'fat-burners',
    name: 'Fat burners',
    tier: 'skip',
    icon: 'warning',
    summary: 'Mostly caffeine with extras. The effect on fat loss is tiny, and some contain risky or banned stimulants.',
    benefits: [],
    dose: () => 'Not recommended. A calorie deficit, protein and training do the work.',
    timing: '—',
    safety: ['Some products have been found to contain undeclared drugs.'],
    questions: ['What actually speeds up fat loss?'],
  },
  {
    id: 'test-boosters',
    name: 'Testosterone boosters',
    tier: 'skip',
    icon: 'close-circle',
    summary: 'Herbal "boosters" (tribulus, fenugreek…) do not raise testosterone in a way that builds muscle.',
    benefits: [],
    dose: () => 'Not recommended. Sleep, enough calories and training support your hormones.',
    timing: '—',
    safety: [],
    questions: ['How can I support my hormones naturally?'],
  },
  {
    id: 'glutamine',
    name: 'Glutamine',
    tier: 'skip',
    icon: 'close-circle',
    summary: 'No benefit for muscle growth or recovery in healthy people who eat enough protein.',
    benefits: [],
    dose: () => 'Not needed.',
    timing: '—',
    safety: [],
    questions: ['Is there anything that actually speeds up recovery?'],
  },
];

export type SupplementContext = {
  profile: Profile | null;
  /** Average daily protein over the last week, when enough days are logged. */
  avgProtein: number | null;
  proteinTarget: number | null;
  /** Whether oily fish shows up in the food log; null when there is too little logged. */
  eatsFish: boolean | null;
  month: number;
};

/** Why this supplement fits the user, or null when there is no specific reason. */
export function forYou(s: Supplement, ctx: SupplementContext): string | null {
  const goal = ctx.profile?.goal;
  switch (s.id) {
    case 'creatine':
      return goal && goal !== 'maintain' ? 'Fits your goal: the best-proven supplement for lifting' : null;
    case 'protein':
      if (ctx.avgProtein !== null && ctx.proteinTarget && ctx.avgProtein < ctx.proteinTarget * 0.9) {
        return `You average ${ctx.avgProtein} g of your ${ctx.proteinTarget} g protein: a shake would close the gap`;
      }
      return null;
    case 'vitamin-d':
      // October to March: little sun in Europe and North America.
      return ctx.month >= 9 || ctx.month <= 2 ? 'Winter months: less sun means vitamin D often runs low' : null;
    case 'omega-3':
      return ctx.eatsFish === false ? 'No oily fish in your log lately' : null;
    default:
      return null;
  }
}

/** Matches oily fish in food names (English and French). */
export const FISH = /salmon|saumon|tuna|thon|sardine|mackerel|maquereau|herring|hareng|trout|truite|anchov|anchois/i;
