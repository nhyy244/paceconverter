import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';

describe('buildRows', () => {
  const rows = buildRows(DEFAULT_CONFIG);

  it('creates one row per 5 s step from 2:00 to 100:00 min/km', () => {
    expect(rows).toHaveLength(1177); // (6000 - 120) / 5 + 1
  });

  it('starts and ends exactly on the range endpoints', () => {
    expect(rows[0]).toEqual({
      secPerKm: 120,
      kmLabel: '2:00',
      miLabel: '3:13',
      major: true,
    });
    expect(rows.at(-1)).toEqual({
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
});
