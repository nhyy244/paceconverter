import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RACES } from './races';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

/**
 * The tape's width is stated in CSS, because the heading and the rows have to
 * agree on it exactly — see the `--tape-width` comment. That makes the race
 * count a value the stylesheet has to know, so it's worth pinning.
 */
describe('--tape-width', () => {
  it('counts the two pace columns and one column per race', () => {
    expect(css).toContain(
      '--tape-width: calc(2 * var(--pace-col) + var(--race-count) * var(--race-col))',
    );
  });

  it('falls back to the current race count if the script never runs', () => {
    const fallback = css.match(/--race-count:\s*(\d+);/);
    expect(fallback).not.toBeNull();
    expect(Number(fallback![1])).toBe(RACES.length);
  });
});
