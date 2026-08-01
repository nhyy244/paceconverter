import { KM_PER_MI } from './pace';

/** What the distance field can be entered in. */
export type DistanceUnit = 'm' | 'km' | 'mi';

/** What the pace field can be entered in. Metres per minute is not a pace. */
export type PaceUnit = 'km' | 'mi';

/** The three quantities, and the name of whichever one is being solved for. */
export type Field = 'pace' | 'distance' | 'time';

/** All three in canonical units: seconds per km, kilometres, seconds. */
export interface Values {
  pace: number | null;
  distance: number | null;
  time: number | null;
}

const KM_PER_DISTANCE_UNIT: Record<DistanceUnit, number> = {
  m: 0.001,
  km: 1,
  mi: KM_PER_MI,
};

export function toKm(value: number, unit: DistanceUnit): number {
  return value * KM_PER_DISTANCE_UNIT[unit];
}

export function fromKm(km: number, unit: DistanceUnit): number {
  return km / KM_PER_DISTANCE_UNIT[unit];
}

/**
 * Pace runs the opposite way round from distance: covering a longer unit takes
 * *more* seconds, so seconds-per-mile divides down to seconds-per-km.
 */
export function toSecPerKm(seconds: number, unit: PaceUnit): number {
  return unit === 'km' ? seconds : seconds / KM_PER_MI;
}

export function fromSecPerKm(secPerKm: number, unit: PaceUnit): number {
  return unit === 'km' ? secPerKm : secPerKm * KM_PER_MI;
}

/**
 * Split clock text into its parts. Every field after the first counts a
 * sixtieth, so anything over 59 there is a typo rather than a big number.
 */
function clockParts(text: string): number[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  const parts: number[] = [];
  for (const part of trimmed.split(':')) {
    if (!/^\d+$/.test(part)) return null;
    parts.push(Number(part));
  }

  if (parts.slice(1).some((part) => part > 59)) return null;
  return parts;
}

/** `5:30` → 330, `5` → 300. Null for anything that isn't a pace. */
export function parsePaceInput(text: string): number | null {
  const parts = clockParts(text);
  if (!parts || parts.length > 2) return null;

  const total = parts[0] * 60 + (parts[1] ?? 0);
  return total > 0 ? total : null;
}

/** `1:56:04` → 6964, `56:04` → 3364, `45` → 2700. */
export function parseDurationInput(text: string): number | null {
  const parts = clockParts(text);
  if (!parts || parts.length > 3) return null;

  // Read from the right: the last field is always the smallest unit present.
  const total = parts.reduceRight(
    (sum, part, index) => sum + part * 60 ** (parts.length - 1 - index),
    0,
  );
  // A single bare field is minutes, not seconds — nobody gives a race time in
  // seconds, and `45` for a 45-minute 10K is the common case.
  const seconds = parts.length === 1 ? total * 60 : total;
  return seconds > 0 ? seconds : null;
}

/** `21,0975` → 21.0975. A decimal comma is what half of Europe types. */
export function parseDistanceInput(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Returns `values` with `computed` filled in from the other two. */
export function solve(values: Values, computed: Field): Values {
  const { pace, distance, time } = values;

  switch (computed) {
    case 'time':
      return { ...values, time: pace !== null && distance !== null ? pace * distance : null };
    // A falsy distance or pace is either absent or zero, and neither divides.
    case 'pace':
      return { ...values, pace: time !== null && distance ? time / distance : null };
    case 'distance':
      return { ...values, distance: time !== null && pace ? time / pace : null };
  }
}

/** The three fields, most recently edited first. */
export type Recency = [Field, Field, Field];

/** Two fields are inputs; the one touched longest ago is the answer. */
export function computedField(order: Recency): Field {
  return order[2];
}

export function touch(order: Recency, field: Field): Recency {
  return [field, ...order.filter((other) => other !== field)] as Recency;
}

/**
 * Enough decimals for a half marathon's 21.0975 km to survive a unit change,
 * without printing the floating-point tail that division leaves behind.
 */
export function formatDistanceValue(value: number): string {
  return String(Number(value.toFixed(3)));
}
