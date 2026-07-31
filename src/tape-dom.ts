import { formatDistance, type Race, type RaceInfo } from './races';
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

  const km = cell('cell km', 'MIN / KM');
  km.setAttribute('role', 'columnheader');
  const mi = cell('cell mi', 'MIN / MI');
  mi.setAttribute('role', 'columnheader');
  fragment.append(km, mi);

  for (const race of races) {
    const heading = cell('cell race');
    heading.setAttribute('role', 'columnheader');

    // Distance and info button share a line, so the button can't collide with
    // the pins or the heading text.
    const meta = cell('race-meta');
    meta.append(cell('race-dist', formatDistance(race.km)));
    if (race.info) {
      meta.append(infoButton(race.id, race.info), infoPanel(race.id, race.info, race.km));
    }

    heading.append(cell('race-name', race.label), meta);
    fragment.append(heading);
  }

  return fragment;
}

/** The id tying an info button to the panel it discloses. */
function panelId(raceId: string): string {
  return `tip-${raceId}`;
}

function infoButton(raceId: string, info: RaceInfo): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'info';
  button.dataset.race = raceId;
  button.textContent = 'i';
  // A disclosure, not a dialog: pressing it reveals the panel in place and
  // leaves focus where it was.
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', panelId(raceId));
  button.setAttribute('aria-label', `About the ${info.name}`);
  return button;
}

function infoPanel(raceId: string, info: RaceInfo, km: number): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'tip';
  panel.id = panelId(raceId);
  panel.dataset.race = raceId;
  panel.hidden = true;

  const name = document.createElement('strong');
  name.textContent = info.name;

  const summary = document.createElement('p');
  summary.textContent = info.summary;

  // The organizer reroutes these courses between editions, so the distance the
  // times are built from is worth stating rather than implying.
  const distance = cell('tip-note', `${formatDistance(km)} · course varies by edition`);

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
    el.setAttribute('role', 'row');

    // The pace names the row; every other cell is a value read against it.
    const km = cell('cell km', row.kmLabel);
    km.setAttribute('role', 'rowheader');
    const mi = cell('cell mi', row.miLabel);
    mi.setAttribute('role', 'cell');
    el.append(km, mi);

    for (const label of row.raceLabels) {
      const race = cell('cell race', label);
      race.setAttribute('role', 'cell');
      el.append(race);
    }

    fragment.append(el);
  }
  return fragment;
}
