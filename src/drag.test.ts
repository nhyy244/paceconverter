import { describe, expect, it } from 'vitest';
import {
  decayVelocity,
  flingVelocity,
  FLING_FRICTION_PER_MS,
  FLING_MAX_SPEED,
  FLING_STOP_SPEED,
} from './drag';

/** A sample that only moves vertically, which most of these cases care about. */
const down = (y: number, t: number) => ({ x: 0, y, t });

describe('flingVelocity', () => {
  it('measures px/ms across the sampled window', () => {
    // 60 px downward over 100 ms.
    expect(flingVelocity([down(0, 0), down(60, 100)]).y).toBeCloseTo(0.6);
  });

  it('is negative when the pointer travelled up', () => {
    expect(flingVelocity([down(60, 0), down(0, 100)]).y).toBeCloseTo(-0.6);
  });

  it('measures both axes independently', () => {
    const velocity = flingVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 40, y: -20, t: 100 },
    ]);

    expect(velocity.x).toBeCloseTo(0.4);
    expect(velocity.y).toBeCloseTo(-0.2);
  });

  it('ignores samples older than the window', () => {
    // The 0 ms sample is outside a 100 ms window ending at 500 ms, so only the
    // final two samples count: 5 px over 50 ms.
    const velocity = flingVelocity([down(0, 0), down(100, 450), down(105, 500)], 100);
    expect(velocity.y).toBeCloseTo(0.1);
  });

  it('returns no velocity when the drag came to rest before release', () => {
    expect(flingVelocity([down(40, 400), down(40, 480)])).toEqual({ x: 0, y: 0 });
  });

  it('returns no velocity for a press without movement', () => {
    expect(flingVelocity([down(10, 0)])).toEqual({ x: 0, y: 0 });
    expect(flingVelocity([])).toEqual({ x: 0, y: 0 });
  });

  it('caps the speed of samples that arrived a fraction of a millisecond apart', () => {
    // 50 px in 0.1 ms is 500 px/ms — an artefact of event coalescing, not a hand.
    expect(flingVelocity([down(0, 0), down(50, 0.1)]).y).toBe(FLING_MAX_SPEED);
    expect(flingVelocity([down(50, 0), down(0, 0.1)]).y).toBe(-FLING_MAX_SPEED);
  });

  it('leaves a hand-speed flick uncapped', () => {
    // 32 px over two frames is ~1 px/ms — a normal flick.
    expect(flingVelocity([down(0, 0), down(32, 32)]).y).toBeCloseTo(1);
  });

  it('returns no velocity when samples share a timestamp', () => {
    expect(flingVelocity([down(0, 7), down(30, 7)])).toEqual({ x: 0, y: 0 });
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
