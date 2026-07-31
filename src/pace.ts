/** Kilometers per mile — the single conversion constant. */
export const KM_PER_MI = 1.609344;

/** Tape range: 2:00 min/km … 100:00 min/km in 5 s steps. */
export const MIN_SEC_PER_KM = 120;
export const MAX_SEC_PER_KM = 6000;
export const STEP_SEC = 5;

/**
 * Convert a pace in seconds-per-km to seconds-per-mile.
 * Rounds to the nearest integer second — the only rounding in the app.
 */
export function kmToMiSeconds(secPerKm: number): number {
  return Math.round(secPerKm * KM_PER_MI);
}

/** Format integer seconds as m:ss with unpadded minutes: 483 → "8:03". */
export function formatPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
