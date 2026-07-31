import { describe, expect, it } from 'vitest';
import { formatDistance, RACES } from './races';

describe('RACES', () => {
  it('runs from a 5K out to the 300-milers', () => {
    expect(RACES.map((race) => race.label)).toEqual([
      '5K',
      '10K',
      '15K',
      'HALF',
      'MARATHON',
      '50K',
      '100K',
      'TAHOE 200',
      'MOAB 240',
      'BIGFOOT 200',
      'ARIZONA 300',
    ]);

    // The standard distances climb; the ultras then follow in the order they
    // were asked for, which is not by course length — Bigfoot's course is
    // shorter than Moab's despite the bigger number in Moab's name.
    const standard = RACES.filter((race) => !race.info).map((race) => race.km);
    expect([...standard].sort((a, b) => a - b)).toEqual(standard);
    expect(Math.min(...RACES.filter((race) => race.info).map((race) => race.km))).toBeGreaterThan(
      Math.max(...standard),
    );
  });

  it('uses the official standard distances', () => {
    const km = Object.fromEntries(RACES.map((race) => [race.id, race.km]));
    expect(km['5k']).toBe(5);
    expect(km['10k']).toBe(10);
    expect(km['15k']).toBe(15);
    expect(km['half']).toBe(21.0975);
    expect(km['marathon']).toBe(42.195);
    expect(km['50k']).toBe(50);
    expect(km['100k']).toBe(100);
  });

  it('gives every race a unique id', () => {
    expect(new Set(RACES.map((race) => race.id)).size).toBe(RACES.length);
  });

  it('documents each ultra with a summary and an organizer link', () => {
    const ultras = RACES.filter((race) => race.info);
    expect(ultras.map((race) => race.id)).toEqual([
      'tahoe200',
      'moab240',
      'bigfoot200',
      'arizona300',
    ]);

    for (const { info } of ultras) {
      expect(info?.name).toBeTruthy();
      // Brief enough for a tooltip.
      expect(info?.summary.length).toBeLessThanOrEqual(90);
      expect(info?.url).toMatch(/^https:\/\/www\.destinationtrailrun\.com\//);
    }
  });

  it("converts each ultra's stated mileage, not the number in its name", () => {
    // A guard against a mi→km conversion slip, not a check that the mileages
    // are current — only the organizer's page can settle that.
    const km = Object.fromEntries(RACES.map((race) => [race.id, race.km]));
    expect(km['tahoe200']).toBeCloseTo(200.4 * 1.609344, 0);
    expect(km['moab240']).toBeCloseTo(241.8 * 1.609344, 0);
    expect(km['bigfoot200']).toBeCloseTo(200.1 * 1.609344, 0);
    expect(km['arizona300']).toBeCloseTo(300.5 * 1.609344, 0);

    // Every one of them is longer than the round number it's named for.
    expect(km['tahoe200']).toBeGreaterThan(200 * 1.609344);
    expect(km['moab240']).toBeGreaterThan(240 * 1.609344);
    expect(km['bigfoot200']).toBeGreaterThan(200 * 1.609344);
    expect(km['arizona300']).toBeGreaterThan(300 * 1.609344);
  });
});

describe('formatDistance', () => {
  it('drops the decimal on round distances', () => {
    expect(formatDistance(5)).toBe('5 km');
    expect(formatDistance(100)).toBe('100 km');
  });

  it('keeps one decimal where it matters', () => {
    expect(formatDistance(21.0975)).toBe('21.1 km');
    expect(formatDistance(42.195)).toBe('42.2 km');
    expect(formatDistance(483.6)).toBe('483.6 km');
  });
});
