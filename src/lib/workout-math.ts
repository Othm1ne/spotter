export type SetValues = { weight: number | null; reps: number | null };

/** Estimated one-rep max (Epley). Returns null for sets that can't be estimated. */
export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function setVolume({ weight, reps }: SetValues): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}

export function formatWeight(kg: number | null): string {
  if (kg === null) return '-';
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)}`;
}

export function formatVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

/** "1:05:09" or "05:09" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Parses user input like "82,5" or "82.5"; empty or invalid gives null. */
export function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(n) || n < 0 ? null : n;
}

export function defaultWorkoutName(date: Date): string {
  const h = date.getHours();
  if (h < 11) return 'Morning workout';
  if (h < 17) return 'Afternoon workout';
  return 'Evening workout';
}

/** A workout still open after this long was most likely forgotten. */
export const STALE_WORKOUT_MS = 3 * 60 * 60 * 1000;

export function isStaleWorkout(startedAt: number, now: number): boolean {
  return now - startedAt > STALE_WORKOUT_MS;
}

/** "36 h" or "45 min" */
export function formatElapsed(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes >= 120 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}
