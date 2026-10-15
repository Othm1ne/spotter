export const Colors = {
  background: '#0B0B0D',
  surface: '#17171B',
  surfaceRaised: '#222228',
  border: '#2C2C33',
  text: '#F4F4F5',
  textSecondary: '#9A9AA3',
  accent: '#C6F432',
  accentText: '#0B0B0D',
  success: '#3DDC84',
  danger: '#FF5A5F',
  /** Primary muscles, matching the red highlight in the exercise GIFs. */
  muscle: '#D9534F',
} as const;

/** Activity calendar steps, rest day to big session: the accent blended over the surface. */
export const ActivityLevels = ['#26262D', '#546423', '#779128', '#9FC32D', '#C6F432'] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
