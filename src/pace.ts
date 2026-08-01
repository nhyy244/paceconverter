/** Kilometers per mile — the single conversion constant. */
export const KM_PER_MI = 1.609344;

/** Tape range: 1:30 min/km … 20:00 min/km in 5 s steps. */
export const MIN_SEC_PER_KM = 90;
export const MAX_SEC_PER_KM = 1200;
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

const SECONDS_PER_HOUR = 3600;

/**
 * Format a finish time: `m:ss` for a 5K, `h:mm:ss` for a marathon, and hours
 * that keep counting past a day for the ultras — 161:12:00, not 6d 17h.
 *
 * An ultra is timed in hours. That is how the results are published and how
 * runners talk about them, and a day-and-hour reading throws away the minutes
 * along the way. It also means every time on the tape parses back, which the
 * calculator's time field depends on.
 */
export function formatClock(totalSeconds: number): string {
  // Rounded before the branch, not inside it: rounding after would let 3,599.5
  // print as "59:60".
  const seconds = Math.round(totalSeconds);

  if (seconds < SECONDS_PER_HOUR) return formatPace(seconds);

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
