import { describe, expect, it } from 'vitest';
import { panelPosition } from './tooltip';

/** An anchor box of the given size at the given spot. */
function anchor(left: number, top: number, width = 15, height = 15) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

const viewport = { width: 400, height: 800 };

describe('panelPosition', () => {
  it('centres the panel under the button', () => {
    const { left, top } = panelPosition(anchor(200, 100), { width: 100, height: 120 }, viewport);

    expect(left).toBe(200 + 15 / 2 - 50);
    expect(top).toBe(115 + 6);
  });

  it('keeps the panel on screen when the button is near the right edge', () => {
    const { left } = panelPosition(anchor(390, 100), { width: 240, height: 120 }, viewport);

    expect(left).toBe(400 - 240 - 8);
  });

  it('keeps the panel on screen when the button is near the left edge', () => {
    const { left } = panelPosition(anchor(2, 100), { width: 240, height: 120 }, viewport);

    expect(left).toBe(8);
  });

  it('flips above the button when there is no room below', () => {
    const { top } = panelPosition(anchor(200, 700), { width: 240, height: 200 }, viewport);

    // 715 + 200 would run off the bottom, so it sits above instead.
    expect(top).toBe(700 - 6 - 200);
  });

  it('clamps to the top when it fits neither below nor fully above', () => {
    const { top } = panelPosition(anchor(200, 40), { width: 240, height: 780 }, viewport);

    expect(top).toBe(8);
  });

  it('falls back to the margin when the panel is wider than the screen', () => {
    const { left } = panelPosition(anchor(200, 100), { width: 500, height: 120 }, viewport);

    expect(left).toBe(8);
  });
});
