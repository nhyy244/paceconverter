import { describe, expect, it } from 'vitest';
import {
  computedField,
  formatDistanceValue,
  fromKm,
  fromSecPerKm,
  parseDistanceInput,
  parseDurationInput,
  parsePaceInput,
  solve,
  toKm,
  toSecPerKm,
  touch,
  type Recency,
} from './calc';

describe('parsePaceInput', () => {
  it('reads m:ss', () => {
    expect(parsePaceInput('5:30')).toBe(330);
  });

  it('reads bare minutes as a whole number of them', () => {
    expect(parsePaceInput('5')).toBe(300);
  });

  it('ignores surrounding space', () => {
    expect(parsePaceInput('  4:05 ')).toBe(245);
  });

  it('rejects sixty seconds and over', () => {
    expect(parsePaceInput('7:75')).toBeNull();
  });

  it('rejects an hours field — a pace is not that slow', () => {
    expect(parsePaceInput('1:05:30')).toBeNull();
  });

  it('rejects letters, signs and empty text', () => {
    for (const bad of ['abc', '-5:30', '5:3a', '', '   ', '5:']) {
      expect(parsePaceInput(bad)).toBeNull();
    }
  });

  it('rejects zero, which is not a pace', () => {
    expect(parsePaceInput('0:00')).toBeNull();
  });
});

describe('parseDurationInput', () => {
  it('reads h:mm:ss', () => {
    expect(parseDurationInput('1:56:04')).toBe(6964);
  });

  it('reads m:ss', () => {
    expect(parseDurationInput('56:04')).toBe(3364);
  });

  it('reads bare minutes', () => {
    expect(parseDurationInput('45')).toBe(2700);
  });

  it('allows an hours field past 24, so a 200-miler can be typed in', () => {
    expect(parseDurationInput('161:12:00')).toBe(580_320);
  });

  it('rejects a fourth field', () => {
    expect(parseDurationInput('1:2:3:4')).toBeNull();
  });

  it('rejects sixty in a sixtieths field', () => {
    expect(parseDurationInput('1:60:00')).toBeNull();
  });
});

describe('parseDistanceInput', () => {
  it('reads a decimal point', () => {
    expect(parseDistanceInput('21.0975')).toBe(21.0975);
  });

  it('reads a decimal comma, which is what half of Europe types', () => {
    expect(parseDistanceInput('21,0975')).toBe(21.0975);
  });

  it('reads a whole number', () => {
    expect(parseDistanceInput('5')).toBe(5);
  });

  it('tolerates a trailing separator mid-typing', () => {
    expect(parseDistanceInput('5.')).toBe(5);
  });

  it('rejects zero, negatives and junk', () => {
    for (const bad of ['0', '-5', 'abc', '', '5km']) {
      expect(parseDistanceInput(bad)).toBeNull();
    }
  });
});

describe('unit conversion', () => {
  it('treats kilometres as canonical', () => {
    expect(toKm(5, 'km')).toBe(5);
  });

  it('reads metres', () => {
    expect(toKm(5000, 'm')).toBeCloseTo(5, 10);
  });

  it('reads miles', () => {
    expect(toKm(1, 'mi')).toBeCloseTo(1.609344, 10);
  });

  it('round-trips a distance through any unit', () => {
    for (const unit of ['m', 'km', 'mi'] as const) {
      expect(fromKm(toKm(42.195, unit), unit)).toBeCloseTo(42.195, 9);
    }
  });

  it('converts a min/mi pace to seconds per km', () => {
    expect(toSecPerKm(531, 'mi')).toBeCloseTo(330, 0);
  });

  it('converts seconds per km back out to min/mi', () => {
    expect(fromSecPerKm(330, 'mi')).toBeCloseTo(531, 0);
  });

  it('round-trips a pace through either unit', () => {
    for (const unit of ['km', 'mi'] as const) {
      expect(toSecPerKm(fromSecPerKm(330, unit), unit)).toBeCloseTo(330, 9);
    }
  });
});

describe('solve', () => {
  const half = { pace: 330, distance: 21.0975, time: null };

  it('multiplies pace by distance for a time', () => {
    expect(solve(half, 'time').time).toBeCloseTo(6962.175, 3);
  });

  it('divides time by distance for a pace', () => {
    const solved = solve({ pace: null, distance: 21.0975, time: 6962.175 }, 'pace');
    expect(solved.pace).toBeCloseTo(330, 6);
  });

  it('divides time by pace for a distance', () => {
    const solved = solve({ pace: 330, distance: null, time: 6962.175 }, 'distance');
    expect(solved.distance).toBeCloseTo(21.0975, 6);
  });

  it('leaves the computed field null when an input is missing', () => {
    expect(solve({ pace: 330, distance: null, time: null }, 'time').time).toBeNull();
  });

  it('refuses to divide by a zero distance', () => {
    expect(solve({ pace: null, distance: 0, time: 3600 }, 'pace').pace).toBeNull();
  });

  it('refuses to divide by a zero pace', () => {
    expect(solve({ pace: 0, distance: null, time: 3600 }, 'distance').distance).toBeNull();
  });

  it('passes the two inputs through untouched', () => {
    const solved = solve({ pace: 330, distance: null, time: null }, 'time');
    expect(solved.pace).toBe(330);
    expect(solved.distance).toBeNull();
  });
});

describe('recency', () => {
  const start: Recency = ['distance', 'pace', 'time'];

  it('computes whichever field was touched longest ago', () => {
    expect(computedField(start)).toBe('time');
  });

  it('moves a touched field to the front', () => {
    expect(touch(start, 'time')).toEqual(['time', 'distance', 'pace']);
  });

  it('demotes the stalest field when another is touched', () => {
    expect(computedField(touch(start, 'time'))).toBe('pace');
  });

  it('leaves the order alone when the newest field is touched again', () => {
    expect(touch(start, 'distance')).toEqual(start);
  });
});

describe('formatDistanceValue', () => {
  it('drops a whole number to no decimals', () => {
    expect(formatDistanceValue(5)).toBe('5');
  });

  it('keeps the precision a course distance needs', () => {
    expect(formatDistanceValue(21.0975)).toBe('21.098');
  });

  it('does not print floating-point noise', () => {
    expect(formatDistanceValue(0.1 + 0.2)).toBe('0.3');
  });
});
