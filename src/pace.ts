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

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

/**
 * Format a finish time at the precision that distance deserves: `m:ss` for a
 * 5K, `h:mm:ss` for a marathon, and `Dd Hh` past a day — which is how anyone
 * running a 200-miler talks about their time anyway.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);

  if (seconds < SECONDS_PER_HOUR) return formatPace(seconds);

  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    const hours = Math.floor((seconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    return `${days}d ${hours}h`;
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
