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
const SECONDS_PER_DAY = 86_400;

/**
 * Always `h:mm:ss`, or `m:ss` under an hour — a form that parses back. The
 * calculator's time field is an input, so a value it can't re-read is a value
 * the user would have to retype.
 */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);

  if (seconds < SECONDS_PER_HOUR) return formatPace(seconds);

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Format a finish time at the precision that distance deserves: `m:ss` for a
 * 5K, `h:mm:ss` for a marathon, and `Dd Hh` past a day — which is how anyone
 * running a 200-miler talks about their time anyway.
 */
export function formatDuration(totalSeconds: number): string {
  // Rounded before the branch, not inside it: 86,399.6 s is a day, and deciding
  // that after formatting would print "23:59:60".
  const seconds = Math.round(totalSeconds);

  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    const hours = Math.floor((seconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    return `${days}d ${hours}h`;
  }

  return formatClock(seconds);
}
