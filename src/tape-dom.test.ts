/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';
import { RACES } from './races';
import {
  renderHeader,
  renderTape,
  initialScrollTop,
  centerRowInTape,
} from './tape-dom';

describe('renderTape', () => {
  it('renders a cell per column, pace units first', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG).slice(0, 3));
    const rows = Array.from(frag.children) as HTMLElement[];

    expect(rows).toHaveLength(3);
    expect(rows[0].className).toBe('row major'); // 120 s
    expect(rows[1].className).toBe('row minor'); // 125 s
    expect(rows[0].dataset.secPerKm).toBe('120');

    const cells = Array.from(rows[0].children) as HTMLElement[];
    expect(cells).toHaveLength(2 + RACES.length);

    const [km, mi] = cells;
    expect(km.className).toBe('cell km');
    expect(km.textContent).toBe('2:00');
    expect(mi.className).toBe('cell mi');
    expect(mi.textContent).toBe('3:13');

    // 5K at 2:00/km, in the first race column.
    expect(cells[2].className).toBe('cell race');
    expect(cells[2].textContent).toBe('10:00');
  });

  it('renders the full default tape', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG));
    expect(frag.children).toHaveLength(1177);
  });
});

describe('renderHeader', () => {
  function header(): HTMLElement {
    const el = document.createElement('div');
    el.append(renderHeader(RACES));
    return el;
  }

  it('heads the two pace columns, then one column per race', () => {
    const cells = Array.from(header().children) as HTMLElement[];

    expect(cells).toHaveLength(2 + RACES.length);
    expect(cells[0].textContent).toBe('MIN / KM');
    expect(cells[1].textContent).toBe('MIN / MI');
    expect(cells[0].className).toBe('cell km');
    expect(cells[1].className).toBe('cell mi');
  });

  it('labels each race with its name and distance', () => {
    const marathon = Array.from(header().querySelectorAll('.cell.race')).find((cell) =>
      cell.querySelector('.race-name')?.textContent === 'MARATHON',
    );

    expect(marathon?.querySelector('.race-dist')?.textContent).toBe('42.2 km');
  });

  it('gives only the ultras an info button, wired to their own panel', () => {
    const el = header();
    const buttons = Array.from(el.querySelectorAll('button.info'));

    expect(buttons.map((button) => (button as HTMLElement).dataset.race)).toEqual([
      'tahoe200',
      'moab240',
      'bigfoot200',
      'arizona300',
    ]);
    for (const button of buttons) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-label')).toContain('About the');
    }
  });

  it('builds each ultra panel closed, with a summary and the official link', () => {
    const el = header();
    const panels = Array.from(el.querySelectorAll('.tip')) as HTMLElement[];

    expect(panels).toHaveLength(4);
    for (const panel of panels) {
      expect(panel.hidden).toBe(true);
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.querySelector('strong')?.textContent).toBeTruthy();
      expect(panel.querySelector('p')?.textContent).toBeTruthy();

      const link = panel.querySelector('a')!;
      expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.destinationtrailrun\.com\//);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    }

    const tahoe = el.querySelector<HTMLElement>('.tip[data-race="tahoe200"]')!;
    expect(tahoe.getAttribute('aria-label')).toBe('Tahoe 200 Endurance Run');
    expect(tahoe.querySelector('.tip-note')?.textContent).toBe(
      '322.5 km · course varies by edition',
    );
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

  it('centers below the heading strip when given its height', () => {
    // The heading floats over the top 44 px, so the row belongs in the middle
    // of the remaining 756 px, not the middle of the viewport.
    const scrollTop = initialScrollTop(1000, 40, 800, 44);

    const rowTopOnScreen = 1000 - scrollTop;
    expect(rowTopOnScreen + 40 / 2).toBe(44 + (800 - 44) / 2);
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

  it('passes the heading inset through', () => {
    const tape = withOffsets(document.createElement('div'), {
      offsetTop: 0,
      clientHeight: 800,
    });
    const row = withOffsets(document.createElement('div'), {
      offsetTop: 1000,
      offsetHeight: 40,
    });

    expect(centerRowInTape(tape, row, 44)).toBe(initialScrollTop(1000, 40, 800, 44));
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
