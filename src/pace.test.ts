import { describe, expect, it } from 'vitest';
import {
  kmToMiSeconds,
  formatPace,
  formatDuration,
  MAX_SEC_PER_KM,
  MIN_SEC_PER_KM,
} from './pace';

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
    expect(kmToMiSeconds(MIN_SEC_PER_KM)).toBe(145); // 90 × 1.609344 = 144.84096
    expect(kmToMiSeconds(MAX_SEC_PER_KM)).toBe(5794); // 3600 × 1.609344 = 5793.6384
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

describe('formatDuration', () => {
  it('uses m:ss below an hour', () => {
    expect(formatDuration(1500)).toBe('25:00'); // 5K at 5:00/km
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('switches to h:mm:ss at an hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(12_659)).toBe('3:30:59'); // marathon at 5:00/km
    expect(formatDuration(86_399)).toBe('23:59:59');
  });

  it('switches to days and hours at a day', () => {
    expect(formatDuration(86_400)).toBe('1d 0h');
    expect(formatDuration(180_000)).toBe('2d 2h');
    // The slowest row on the longest course: 60:00/km over 483.6 km.
    expect(formatDuration(MAX_SEC_PER_KM * 483.6)).toBe('20d 3h');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(1499.6)).toBe('25:00');
    expect(formatDuration(3600.4)).toBe('1:00:00');
  });

  it('rounds before choosing the format, so no unit ever reads 60', () => {
    // Rounding after the branch would give "59:60" and "23:59:60".
    expect(formatDuration(3599.5)).toBe('1:00:00');
    expect(formatDuration(86_399.6)).toBe('1d 0h');
  });
});
