import { describe, expect, it } from 'vitest';
import {
  decayVelocity,
  flingVelocity,
  FLING_FRICTION_PER_MS,
  FLING_MAX_SPEED,
  FLING_STOP_SPEED,
} from './drag';

describe('flingVelocity', () => {
  it('measures px/ms across the sampled window', () => {
    // 60 px downward over 100 ms.
    expect(flingVelocity([{ y: 0, t: 0 }, { y: 60, t: 100 }])).toBeCloseTo(0.6);
  });

  it('is negative when the pointer travelled up', () => {
    expect(flingVelocity([{ y: 60, t: 0 }, { y: 0, t: 100 }])).toBeCloseTo(-0.6);
  });

  it('ignores samples older than the window', () => {
    // The 0 ms sample is outside a 100 ms window ending at 500 ms, so only the
    // final two samples count: 5 px over 50 ms.
    const velocity = flingVelocity(
      [
        { y: 0, t: 0 },
        { y: 100, t: 450 },
        { y: 105, t: 500 },
      ],
      100,
    );
    expect(velocity).toBeCloseTo(0.1);
  });

  it('returns no velocity when the drag came to rest before release', () => {
    expect(
      flingVelocity([
        { y: 40, t: 400 },
        { y: 40, t: 480 },
      ]),
    ).toBe(0);
  });

  it('returns no velocity for a press without movement', () => {
    expect(flingVelocity([{ y: 10, t: 0 }])).toBe(0);
    expect(flingVelocity([])).toBe(0);
  });

  it('caps the speed of samples that arrived a fraction of a millisecond apart', () => {
    // 50 px in 0.1 ms is 500 px/ms — an artefact of event coalescing, not a hand.
    expect(
      flingVelocity([
        { y: 0, t: 0 },
        { y: 50, t: 0.1 },
      ]),
    ).toBe(FLING_MAX_SPEED);
    expect(
      flingVelocity([
        { y: 50, t: 0 },
        { y: 0, t: 0.1 },
      ]),
    ).toBe(-FLING_MAX_SPEED);
  });

  it('leaves a hand-speed flick uncapped', () => {
    // 32 px over two frames is ~1 px/ms — a normal flick.
    expect(flingVelocity([{ y: 0, t: 0 }, { y: 32, t: 32 }])).toBeCloseTo(1);
  });

  it('returns no velocity when samples share a timestamp', () => {
    expect(
      flingVelocity([
        { y: 0, t: 7 },
        { y: 30, t: 7 },
      ]),
    ).toBe(0);
  });
});

describe('decayVelocity', () => {
  it('leaves velocity untouched across zero elapsed time', () => {
    expect(decayVelocity(1.5, 0)).toBe(1.5);
  });

  it('applies friction per millisecond', () => {
    expect(decayVelocity(1, 1)).toBeCloseTo(FLING_FRICTION_PER_MS);
    expect(decayVelocity(1, 10)).toBeCloseTo(Math.pow(FLING_FRICTION_PER_MS, 10));
  });

  it('preserves direction while shrinking magnitude', () => {
    const decayed = decayVelocity(-0.8, 50);
    expect(decayed).toBeLessThan(0);
    expect(Math.abs(decayed)).toBeLessThan(0.8);
  });

  it('drops a typical fling below the stop threshold in about a second', () => {
    expect(Math.abs(decayVelocity(2, 1000))).toBeLessThan(FLING_STOP_SPEED);
  });
});
