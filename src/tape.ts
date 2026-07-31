import {
  kmToMiSeconds,
  formatPace,
  formatDuration,
  MIN_SEC_PER_KM,
  MAX_SEC_PER_KM,
  STEP_SEC,
} from './pace';
import { RACES, type Race } from './races';

export interface TapeConfig {
  minSecPerKm: number;
  maxSecPerKm: number;
  stepSec: number;
}

export const DEFAULT_CONFIG: TapeConfig = {
  minSecPerKm: MIN_SEC_PER_KM,
  maxSecPerKm: MAX_SEC_PER_KM,
  stepSec: STEP_SEC,
};

export interface TapeRow {
  secPerKm: number;
  kmLabel: string;
  miLabel: string;
  /** Finish times, one per race, in registry order. */
  raceLabels: string[];
  /** 10 s rows are visually emphasized; 5 s rows are minor ticks. */
  major: boolean;
}

export function buildRows(
  config: TapeConfig = DEFAULT_CONFIG,
  races: Race[] = RACES,
): TapeRow[] {
  const rows: TapeRow[] = [];
  for (let s = config.minSecPerKm; s <= config.maxSecPerKm; s += config.stepSec) {
    rows.push({
      secPerKm: s,
      kmLabel: formatPace(s),
      miLabel: formatPace(kmToMiSeconds(s)),
      raceLabels: races.map((race) => formatDuration(s * race.km)),
      major: s % 10 === 0,
    });
  }
  return rows;
}
