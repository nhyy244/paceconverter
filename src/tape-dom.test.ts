/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import {
  buildRows,
  DEFAULT_CONFIG,
  renderTape,
  initialScrollTop,
  centerRowInTape,
} from './tape';

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

describe('centerRowInTape', () => {
  // Regression test for the header-height overshoot: `.tape` is not
  // `position: relative`, so a row's `offsetTop` is measured from the
  // nearest positioned ancestor (e.g. `.plate`), not from `.tape`. That
  // ancestor also contains the header strip above `.tape`, so row.offsetTop
  // includes the header's height. centerRowInTape must subtract
  // tape.offsetTop to re-base the row offset onto the tape's own
  // coordinate space before centering.
  function withOffsets(el: HTMLElement, values: Partial<Record<'offsetTop' | 'offsetHeight' | 'clientHeight', number>>) {
    for (const [prop, value] of Object.entries(values)) {
      Object.defineProperty(el, prop, { value, configurable: true });
    }
    return el;
  }

  it('measures the row offset relative to the tape, not the tape\'s offsetParent', () => {
    const tape = withOffsets(document.createElement('div'), {
      offsetTop: 44, // e.g. header strip height, if tape shares plate as offsetParent
      clientHeight: 700,
    });
    const row = withOffsets(document.createElement('div'), {
      offsetTop: 1304, // absolute offset measured from the same offsetParent as tape
      offsetHeight: 47,
    });

    const scrollTop = centerRowInTape(tape, row);

    // Relative row offset is 1304 - 44 = 1260; a naive (unsubtracted) offset
    // would produce a scrollTop 44 px too large — exactly the header height.
    expect(scrollTop).toBe(initialScrollTop(1260, 47, 700));
    expect(scrollTop).not.toBe(initialScrollTop(1304, 47, 700));
    expect(initialScrollTop(1304, 47, 700) - scrollTop).toBe(44);
  });

  it('matches initialScrollTop directly when tape.offsetTop is 0', () => {
    const tape = withOffsets(document.createElement('div'), {
      offsetTop: 0,
      clientHeight: 800,
    });
    const row = withOffsets(document.createElement('div'), {
      offsetTop: 1000,
      offsetHeight: 40,
    });

    expect(centerRowInTape(tape, row)).toBe(initialScrollTop(1000, 40, 800));
  });
});
