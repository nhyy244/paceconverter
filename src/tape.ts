import {
  kmToMiSeconds,
  formatPace,
  MIN_SEC_PER_KM,
  MAX_SEC_PER_KM,
  STEP_SEC,
} from './pace';

export interface TapeConfig {
  minSecPerKm: number;
  maxSecPerKm: number;
  stepSec: number;
}

export const DEFAULT_CONFIG: TapeConfig = {
  minSecPerKm: MIN_SEC_PER_KM,
  maxSecPerKm: MAX_SEC_PER_KM,
  stepSec: STEP_SEC,
};

export interface TapeRow {
  secPerKm: number;
  kmLabel: string;
  miLabel: string;
  /** 10 s rows are visually emphasized; 5 s rows are minor ticks. */
  major: boolean;
}

export function buildRows(config: TapeConfig = DEFAULT_CONFIG): TapeRow[] {
  const rows: TapeRow[] = [];
  for (let s = config.minSecPerKm; s <= config.maxSecPerKm; s += config.stepSec) {
    rows.push({
      secPerKm: s,
      kmLabel: formatPace(s),
      miLabel: formatPace(kmToMiSeconds(s)),
      major: s % 10 === 0,
    });
  }
  return rows;
}

/** Render rows as div.row > span.cell.km + span.cell.mi. Column sync is structural. */
export function renderTape(rows: TapeRow[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = row.major ? 'row major' : 'row minor';
    el.dataset.secPerKm = String(row.secPerKm);

    const km = document.createElement('span');
    km.className = 'cell km';
    km.textContent = row.kmLabel;

    const mi = document.createElement('span');
    mi.className = 'cell mi';
    mi.textContent = row.miLabel;

    el.append(km, mi);
    fragment.append(el);
  }
  return fragment;
}

/** Scroll offset that vertically centers a row; clamped so the tape never over-scrolls at the top. */
export function initialScrollTop(
  rowOffsetTop: number,
  rowHeight: number,
  viewportHeight: number,
): number {
  return Math.max(0, rowOffsetTop - (viewportHeight - rowHeight) / 2);
}

/**
 * Scroll offset that centers `row` inside `tape`'s viewport.
 *
 * `row.offsetTop` is relative to its nearest positioned ancestor, which may
 * not be `tape` itself (e.g. `tape` sits inside a `position: relative`
 * sibling of a header strip). Subtracting `tape.offsetTop` re-bases the row
 * offset onto the tape's own coordinate space before centering.
 */
export function centerRowInTape(tape: HTMLElement, row: HTMLElement): number {
  return initialScrollTop(
    row.offsetTop - tape.offsetTop,
    row.offsetHeight,
    tape.clientHeight,
  );
}
