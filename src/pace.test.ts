import { describe, expect, it } from 'vitest';
import { kmToMiSeconds, formatPace } from './pace';

describe('kmToMiSeconds', () => {
  it('converts 5:00/km (300 s) to 8:03/mi (483 s)', () => {
    expect(kmToMiSeconds(300)).toBe(483); // 300 × 1.609344 = 482.8032
  });

  it('rounds down when the fraction is below .5', () => {
    expect(kmToMiSeconds(125)).toBe(201); // 125 × 1.609344 = 201.168
  });

  it('rounds up when the fraction is .5 or above', () => {
    expect(kmToMiSeconds(205)).toBe(330); // 205 × 1.609344 = 329.91552
  });

  it('converts both tape endpoints', () => {
    expect(kmToMiSeconds(120)).toBe(193); // 193.12128
    expect(kmToMiSeconds(6000)).toBe(9656); // 9656.064
  });
});

describe('formatPace', () => {
  it('pads seconds to two digits', () => {
    expect(formatPace(483)).toBe('8:03');
    expect(formatPace(305)).toBe('5:05');
  });

  it('formats exact minutes', () => {
    expect(formatPace(120)).toBe('2:00');
  });

  it('keeps large values in minutes — never hours', () => {
    expect(formatPace(6000)).toBe('100:00');
    expect(formatPace(9656)).toBe('160:56');
  });
});
