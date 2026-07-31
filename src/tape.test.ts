import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';
import { formatPace, kmToMiSeconds, MAX_SEC_PER_KM, MIN_SEC_PER_KM, STEP_SEC } from './pace';
import { RACES } from './races';

/** Rows the configured range should produce, inclusive of both ends. */
const EXPECTED_ROWS = (MAX_SEC_PER_KM - MIN_SEC_PER_KM) / STEP_SEC + 1;

describe('buildRows', () => {
  const rows = buildRows(DEFAULT_CONFIG);

  it('creates one row per step across the whole range', () => {
    // Derived rather than hard-coded, so widening the range is a one-line
    // change to pace.ts and still catches an off-by-one here.
    expect(rows).toHaveLength(EXPECTED_ROWS);
    expect(Number.isInteger(EXPECTED_ROWS)).toBe(true);
  });

  it('starts and ends exactly on the range endpoints', () => {
    expect(rows[0]).toMatchObject({
      secPerKm: MIN_SEC_PER_KM,
      kmLabel: formatPace(MIN_SEC_PER_KM),
      miLabel: formatPace(kmToMiSeconds(MIN_SEC_PER_KM)),
    });
    expect(rows.at(-1)).toMatchObject({
      secPerKm: MAX_SEC_PER_KM,
      kmLabel: formatPace(MAX_SEC_PER_KM),
      miLabel: formatPace(kmToMiSeconds(MAX_SEC_PER_KM)),
      major: true,
    });

    // Spot-check the current range's actual labels, so a wrong constant shows up
    // as a failure and not just a self-consistent tautology.
    expect(rows[0].kmLabel).toBe('1:30');
    expect(rows[0].miLabel).toBe('2:25');
    expect(rows.at(-1)!.kmLabel).toBe('20:00');
    expect(rows.at(-1)!.miLabel).toBe('32:11');
  });

  it('steps by the configured interval', () => {
    expect(rows[1].secPerKm).toBe(MIN_SEC_PER_KM + STEP_SEC);
    expect(rows[2].secPerKm).toBe(MIN_SEC_PER_KM + 2 * STEP_SEC);
  });

  it('marks 10 s rows major and 5 s rows minor', () => {
    expect(rows[0].major).toBe(true); // 1:30
    expect(rows[1].major).toBe(false); // 1:35
    expect(rows[2].major).toBe(true); // 1:40
  });

  it('derives mile labels through the domain conversion', () => {
    const row500 = rows.find((r) => r.secPerKm === 300);
    expect(row500?.kmLabel).toBe('5:00');
    expect(row500?.miLabel).toBe('8:03');
  });

  it('gives every row a finish time for every race', () => {
    for (const row of [rows[0], rows[Math.floor(rows.length / 2)], rows.at(-1)!]) {
      expect(row.raceLabels).toHaveLength(RACES.length);
      expect(row.raceLabels.every((label) => label.length > 0)).toBe(true);
    }
  });

  it('derives race times from pace × distance', () => {
    const row500 = rows.find((r) => r.secPerKm === 300)!;
    const time = (id: string) =>
      row500.raceLabels[RACES.findIndex((race) => race.id === id)];

    expect(time('5k')).toBe('25:00'); // 5 km × 5:00
    expect(time('10k')).toBe('50:00');
    expect(time('half')).toBe('1:45:29'); // 21.0975 km → 6329.25 s
    expect(time('marathon')).toBe('3:30:59'); // 42.195 km → 12 658.5 s
    expect(time('100k')).toBe('8:20:00');
  });

  it('reports multi-day ultra times in days and hours', () => {
    const row500 = rows.find((r) => r.secPerKm === 300)!;
    const arizona = row500.raceLabels[RACES.findIndex((race) => race.id === 'arizona300')];

    // 483.6 km at 5:00/km is 145 080 s — nobody runs one at that pace, but the
    // tape has to render it, and it has to read as days.
    expect(arizona).toBe('1d 16h');
  });

  it('accepts a narrower race list', () => {
    const rowsWithOneRace = buildRows(DEFAULT_CONFIG, [{ id: '5k', label: '5K', km: 5 }]);
    expect(rowsWithOneRace[0].raceLabels).toEqual(['7:30']); // 5 km at 1:30/km
  });
});
