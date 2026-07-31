/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';
import { MAX_SEC_PER_KM, MIN_SEC_PER_KM, STEP_SEC } from './pace';
import { RACES } from './races';
import { renderHeader, renderTape } from './tape-dom';

describe('renderTape', () => {
  it('renders a cell per column, pace units first', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG).slice(0, 3));
    const rows = Array.from(frag.children) as HTMLElement[];

    expect(rows).toHaveLength(3);
    expect(rows[0].className).toBe('row major'); // 90 s
    expect(rows[1].className).toBe('row minor'); // 95 s
    expect(rows[0].dataset.secPerKm).toBe(String(MIN_SEC_PER_KM));

    const cells = Array.from(rows[0].children) as HTMLElement[];
    expect(cells).toHaveLength(2 + RACES.length);

    const [km, mi] = cells;
    expect(km.className).toBe('cell km');
    expect(km.textContent).toBe('1:30');
    expect(mi.className).toBe('cell mi');
    expect(mi.textContent).toBe('2:25');

    // 5K at 1:30/km, in the first race column.
    expect(cells[2].className).toBe('cell race');
    expect(cells[2].textContent).toBe('7:30');
  });

  it('marks up rows as table rows headed by the pace', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG).slice(0, 1));
    const row = frag.children[0] as HTMLElement;
    const cells = Array.from(row.children) as HTMLElement[];

    expect(row.getAttribute('role')).toBe('row');
    expect(cells[0].getAttribute('role')).toBe('rowheader');
    expect(cells.slice(1).every((cell) => cell.getAttribute('role') === 'cell')).toBe(true);
  });

  it('renders the full default tape', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG));
    expect(frag.children).toHaveLength((MAX_SEC_PER_KM - MIN_SEC_PER_KM) / STEP_SEC + 1);
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
    const buttons = Array.from(el.querySelectorAll('button.info')) as HTMLElement[];

    expect(buttons.map((button) => button.dataset.race)).toEqual([
      'tahoe200',
      'moab240',
      'bigfoot200',
      'arizona300',
    ]);
    for (const button of buttons) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-label')).toContain('About the');

      // A disclosure: the button names the panel it reveals.
      const id = button.getAttribute('aria-controls');
      expect(id).toBe(`tip-${button.dataset.race}`);
      expect(el.querySelector(`#${id}`)).toHaveProperty('className', 'tip');
    }
  });

  it('marks up the headings as table column headers', () => {
    const cells = Array.from(header().children);

    expect(cells.every((cell) => cell.getAttribute('role') === 'columnheader')).toBe(true);
  });

  it('builds each ultra panel closed, with a summary and the official link', () => {
    const el = header();
    const panels = Array.from(el.querySelectorAll('.tip')) as HTMLElement[];

    expect(panels).toHaveLength(4);
    for (const panel of panels) {
      expect(panel.hidden).toBe(true);
      expect(panel.querySelector('strong')?.textContent).toBeTruthy();
      expect(panel.querySelector('p')?.textContent).toBeTruthy();

      const link = panel.querySelector('a')!;
      expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.destinationtrailrun\.com\//);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    }

    const tahoe = el.querySelector<HTMLElement>('.tip[data-race="tahoe200"]')!;
    expect(tahoe.querySelector('strong')?.textContent).toBe('Tahoe 200 Endurance Run');
    expect(tahoe.querySelector('.tip-note')?.textContent).toBe(
      '322.5 km · course varies by edition',
    );
  });
});
