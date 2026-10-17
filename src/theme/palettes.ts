/**
 * Color palettes for dark and light mode: electric blue accent. Chart colors (macros, activity
 * ramp) are validated per mode for contrast and color-blind separation; always pair them with
 * text labels.
 */
export type Palette = {
  dark: boolean;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  /** Text and icons drawn on the accent color. */
  accentText: string;
  /** Tinted background for pills and selected states. */
  accentSoft: string;
  success: string;
  danger: string;
  warning: string;
  /** Primary muscles, matching the red highlight in the exercise GIFs. */
  muscle: string;
  water: string;
  macros: { protein: string; carbs: string; fat: string };
  /** Supplement evidence tiers: worth it, sometimes useful, skip. */
  tiers: { strong: string; situational: string; skip: string };
  /** Hero gradient for premium cards. */
  hero: readonly [string, string];
  /** Activity calendar, rest day to big session. */
  activity: readonly [string, string, string, string, string];
  /** Text on the hero gradient. */
  onHero: string;
  /** Soft accent glow behind screen titles, fading to transparent. */
  glow: readonly [string, string];
  /** Chart bars below the goal. */
  chartDim: string;
};

export const dark: Palette = {
  dark: true,
  background: '#08090D',
  surface: '#12141B',
  surfaceRaised: '#1C1F2A',
  border: '#262A37',
  text: '#F3F5FA',
  textSecondary: '#8D93A6',
  accent: '#5B7CFF',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(91, 124, 255, 0.16)',
  success: '#34D399',
  danger: '#FF5C6C',
  warning: '#FFB547',
  muscle: '#E0525C',
  water: '#4FA8F0',
  macros: { protein: '#22A88E', carbs: '#C97B14', fat: '#DB4D7B' },
  tiers: { strong: '#34D399', situational: '#FFB547', skip: '#8D93A6' },
  hero: ['#4F6BFF', '#9B5BFF'],
  activity: ['#1C1F2A', '#33479F', '#4560D2', '#6680F7', '#A5B4FF'],
  onHero: '#FFFFFF',
  glow: ['rgba(91, 124, 255, 0.20)', 'rgba(8, 9, 13, 0)'],
  chartDim: '#3A3F52',
};

export const light: Palette = {
  dark: false,
  background: '#F3F4F8',
  surface: '#FFFFFF',
  surfaceRaised: '#ECEEF4',
  border: '#DFE2EA',
  text: '#0E1120',
  textSecondary: '#5F6578',
  accent: '#3D5EF0',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(61, 94, 240, 0.10)',
  success: '#0F9D68',
  danger: '#E2374A',
  warning: '#B86E00',
  muscle: '#D2414B',
  water: '#1F7FCC',
  macros: { protein: '#13866F', carbs: '#B76A0A', fat: '#C93A69' },
  tiers: { strong: '#0F9D68', situational: '#B86E00', skip: '#5F6578' },
  hero: ['#3D5EF0', '#8A4DF5'],
  activity: ['#E6E9F1', '#9FAEF7', '#7890F3', '#5470EE', '#2F4BD6'],
  onHero: '#FFFFFF',
  glow: ['rgba(61, 94, 240, 0.12)', 'rgba(243, 244, 248, 0)'],
  chartDim: '#C5CAD8',
};
