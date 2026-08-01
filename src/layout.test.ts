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

/**
 * The swap has one performance rule and it lives in the stylesheet: the
 * inactive view is hidden with visibility, never display. display: none throws
 * away the tape's layout boxes and makes every return pay for a relayout of
 * ~2,900 cells, which is exactly the stutter this is meant to avoid.
 */
describe('the view swap', () => {
  // These assert on what the stylesheet declares, not on what it says about
  // itself — the comments below discuss display: none at some length.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('hides the inactive view with visibility', () => {
    expect(declarations).toMatch(/\.plate\.calc-mode \.tape[\s\S]{0,200}?visibility:\s*hidden/);
  });

  it('never hides a view with display: none', () => {
    // Rules on the view elements themselves. Pseudo-elements are somebody
    // else's business — .tape::-webkit-scrollbar hides a scrollbar, not a view.
    const rules = (declarations.match(/[^{}]*\{[^}]*\}/g) ?? []).filter((rule) => {
      const selector = rule.slice(0, rule.indexOf('{'));
      return /\.(tape|calc|views)(?![\w-])/.test(selector) && !selector.includes('::');
    });

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/display:\s*none/);
  });

  it('animates only compositor-friendly properties', () => {
    const swap = (declarations.match(/transition:[^;]+;/g) ?? []).filter((line) =>
      /opacity/.test(line),
    );
    expect(swap.length).toBeGreaterThan(0);
    for (const line of swap) {
      expect(line).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\b/);
    }
  });

  /**
   * The tape holds the ultra columns' info panels, which are position: fixed.
   * A transformed ancestor would become their containing block and throw every
   * one of them off, so the tape only ever fades.
   */
  it('leaves the tape untransformed', () => {
    const rules = declarations.match(/\.plate[^{]*\.tape[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of rules) expect(rule).not.toMatch(/transform:/);
  });
});
