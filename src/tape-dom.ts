import { formatDistance, type Race } from './races';
import type { TapeRow } from './tape';

function cell(className: string, text?: string): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * The column headings: the two pace units, then one per race with its distance
 * underneath. Ultras also get an info button and the panel it opens.
 */
export function renderHeader(races: Race[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(cell('cell km', 'MIN / KM'), cell('cell mi', 'MIN / MI'));

  for (const race of races) {
    const heading = cell('cell race');
    // Distance and info button share a line, so the button can't collide with
    // the pins or the heading text.
    const meta = cell('race-meta');
    meta.append(cell('race-dist', formatDistance(race.km)));
    if (race.info) meta.append(infoButton(race), infoPanel(race));

    heading.append(cell('race-name', race.label), meta);
    fragment.append(heading);
  }

  return fragment;
}

function infoButton(race: Race): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'info';
  button.dataset.race = race.id;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `About the ${race.info?.name}`);
  // Drawn in CSS so it stays crisp and doesn't depend on a glyph.
  button.append(cell('info-mark', 'i'));
  return button;
}

function infoPanel(race: Race): HTMLElement {
  const info = race.info!;
  const panel = document.createElement('div');
  panel.className = 'tip';
  panel.dataset.race = race.id;
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', info.name);

  const name = document.createElement('strong');
  name.textContent = info.name;

  const summary = document.createElement('p');
  summary.textContent = info.summary;

  // The organizer reroutes these courses between editions, so the distance the
  // times are built from is worth stating rather than implying.
  const distance = cell('tip-note', `${formatDistance(race.km)} · course varies by edition`);

  const link = document.createElement('a');
  link.href = info.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Official race page';

  panel.append(name, summary, distance, link);
  return panel;
}

/** Render rows as div.row > span.cell per column. Column sync is structural. */
export function renderTape(rows: TapeRow[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = row.major ? 'row major' : 'row minor';
    el.dataset.secPerKm = String(row.secPerKm);

    el.append(cell('cell km', row.kmLabel), cell('cell mi', row.miLabel));
    for (const label of row.raceLabels) el.append(cell('cell race', label));

    fragment.append(el);
  }
  return fragment;
}

/**
 * Scroll offset that vertically centers a row in the area below `topInset` —
 * the height of the heading strip, which floats over the top of the tape.
 * Clamped so the tape never over-scrolls at the top.
 */
export function initialScrollTop(
  rowOffsetTop: number,
  rowHeight: number,
  viewportHeight: number,
  topInset = 0,
): number {
  const visibleHeight = viewportHeight - topInset;
  return Math.max(0, rowOffsetTop - topInset - (visibleHeight - rowHeight) / 2);
}

/**
 * Scroll offset that centers `row` inside `tape`'s viewport.
 *
 * `row.offsetTop` is relative to its nearest positioned ancestor, which may
 * not be `tape` itself (e.g. `tape` sits inside a `position: relative` plate).
 * Subtracting `tape.offsetTop` re-bases the row offset onto the tape's own
 * coordinate space before centering.
 */
export function centerRowInTape(tape: HTMLElement, row: HTMLElement, topInset = 0): number {
  return initialScrollTop(
    row.offsetTop - tape.offsetTop,
    row.offsetHeight,
    tape.clientHeight,
    topInset,
  );
}
