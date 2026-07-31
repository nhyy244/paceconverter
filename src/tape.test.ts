import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';
import { RACES } from './races';

describe('buildRows', () => {
  const rows = buildRows(DEFAULT_CONFIG);

  it('creates one row per 5 s step from 2:00 to 100:00 min/km', () => {
    expect(rows).toHaveLength(1177); // (6000 - 120) / 5 + 1
  });

  it('starts and ends exactly on the range endpoints', () => {
    expect(rows[0]).toMatchObject({
      secPerKm: 120,
      kmLabel: '2:00',
      miLabel: '3:13',
      major: true,
    });
    expect(rows.at(-1)).toMatchObject({
      secPerKm: 6000,
      kmLabel: '100:00',
      miLabel: '160:56',
      major: true,
    });
  });

  it('steps by 5 seconds', () => {
    expect(rows[1].secPerKm).toBe(125);
    expect(rows[2].secPerKm).toBe(130);
  });

  it('marks 10 s rows major and 5 s rows minor', () => {
    expect(rows[0].major).toBe(true); // 120
    expect(rows[1].major).toBe(false); // 125
    expect(rows[2].major).toBe(true); // 130
  });

  it('derives mile labels through the domain conversion', () => {
    const row500 = rows.find((r) => r.secPerKm === 300);
    expect(row500?.kmLabel).toBe('5:00');
    expect(row500?.miLabel).toBe('8:03');
  });

  it('gives every row a finish time for every race', () => {
    for (const row of [rows[0], rows[588], rows.at(-1)!]) {
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
    expect(rowsWithOneRace[0].raceLabels).toEqual(['10:00']); // 5 km at 2:00/km
  });
});
