import { describe, expect, it } from 'vitest';
import {
  computedField,
  distanceProblem,
  durationProblem,
  formatDistanceValue,
  paceProblem,
  TYPEABLE,
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

  /**
   * A phone's numeric keypad has no colon key, so a pace typed on one has to
   * arrive some other way. Both of these are what people actually reach for.
   */
  it('takes the decimal separator the keypad does have as a colon', () => {
    expect(parsePaceInput('5.30')).toBe(330);
    expect(parsePaceInput('5,30')).toBe(330);
  });

  it('reads bare digits, last two as seconds', () => {
    expect(parsePaceInput('530')).toBe(330);
    expect(parsePaceInput('1230')).toBe(750); // 12:30
  });

  it('still reads one or two bare digits as whole minutes', () => {
    // `45` is a 45-minute-per-km hike, not 45 seconds per km.
    expect(parsePaceInput('5')).toBe(300);
    expect(parsePaceInput('45')).toBe(2700);
    expect(parsePaceInput('4500')).toBe(2700);
  });

  it('rejects bare digits whose seconds field is impossible', () => {
    expect(parsePaceInput('5999')).toBeNull();
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

  it('takes the keypad separator as a colon here too', () => {
    expect(parseDurationInput('1.56.02')).toBe(6962);
    expect(parseDurationInput('56,02')).toBe(3362);
  });

  it('reads bare digits from the right', () => {
    expect(parseDurationInput('15602')).toBe(6962); // 1:56:02
    expect(parseDurationInput('5602')).toBe(3362); // 56:02
    expect(parseDurationInput('45')).toBe(2700); // 45 minutes, as before
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

describe('problems', () => {
  it('says nothing about an empty field', () => {
    expect(paceProblem('')).toBeNull();
    expect(durationProblem('  ')).toBeNull();
    expect(distanceProblem('')).toBeNull();
  });

  it('says nothing about a pace that reads fine', () => {
    for (const good of ['5:30', '5.30', '530', '5', '4:59']) {
      expect(paceProblem(good)).toBeNull();
    }
  });

  // The case worth speaking up about: no amount of further typing rescues it.
  it('calls out seconds over 59', () => {
    for (const bad of ['4:60', '4:70', '460', '4,99']) {
      expect(paceProblem(bad)).toBe('sixtieths');
    }
  });

  it('calls out an over-59 field in a time too', () => {
    expect(durationProblem('1:60:00')).toBe('sixtieths');
    expect(durationProblem('1:20:75')).toBe('sixtieths');
  });

  // These can still turn into something valid, so they wait for the field to
  // be left rather than nagging mid-word.
  it('treats a half-typed value as incomplete, not wrong', () => {
    expect(paceProblem('5:')).toBe('incomplete');
    expect(paceProblem('0')).toBe('incomplete');
    expect(distanceProblem('0')).toBe('incomplete');
  });

  it('says nothing about a trailing decimal point, which already reads as 5', () => {
    expect(distanceProblem('5.')).toBeNull();
  });

  it('calls out text that is not a number at all', () => {
    expect(paceProblem('abc')).toBe('unreadable');
    expect(distanceProblem('5km')).toBe('unreadable');
    expect(durationProblem('1:2:3:4')).toBe('unreadable');
  });
});

describe('TYPEABLE', () => {
  it('lets a pace take digits and either separator', () => {
    for (const ok of ['5', '5:30', '5.30', '5,30', '']) expect(TYPEABLE.pace.test(ok)).toBe(true);
  });

  it('keeps letters and signs out of every field', () => {
    for (const field of ['pace', 'time', 'distance'] as const) {
      for (const bad of ['a', '-', ' ', 'e', '/']) expect(TYPEABLE[field].test(bad)).toBe(false);
    }
  });

  it('keeps the colon out of a distance, which has no use for one', () => {
    expect(TYPEABLE.distance.test('21.1')).toBe(true);
    expect(TYPEABLE.distance.test('21:1')).toBe(false);
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
