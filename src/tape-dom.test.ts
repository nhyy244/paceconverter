/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG, renderTape, initialScrollTop } from './tape';

describe('renderTape', () => {
  it('renders a two-cell grid row per tape row', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG).slice(0, 3));
    const rows = Array.from(frag.children) as HTMLElement[];

    expect(rows).toHaveLength(3);
    expect(rows[0].className).toBe('row major'); // 120 s
    expect(rows[1].className).toBe('row minor'); // 125 s
    expect(rows[0].dataset.secPerKm).toBe('120');

    const [km, mi] = Array.from(rows[0].children) as HTMLElement[];
    expect(km.className).toBe('cell km');
    expect(km.textContent).toBe('2:00');
    expect(mi.className).toBe('cell mi');
    expect(mi.textContent).toBe('3:13');
  });

  it('renders the full default tape', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG));
    expect(frag.children).toHaveLength(1177);
  });
});

describe('initialScrollTop', () => {
  it('centers the row in the viewport', () => {
    // row top 1000 px, row 40 px tall, viewport 800 px → 1000 - (800 - 40) / 2
    expect(initialScrollTop(1000, 40, 800)).toBe(620);
  });

  it('clamps to 0 for rows near the top of the tape', () => {
    expect(initialScrollTop(10, 40, 800)).toBe(0);
  });
});
