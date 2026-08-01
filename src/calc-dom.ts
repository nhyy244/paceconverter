import {
  computedField,
  formatDistanceValue,
  fromKm,
  fromSecPerKm,
  parseDistanceInput,
  parseDurationInput,
  parsePaceInput,
  solve,
  toKm,
  toSecPerKm,
  touch,
  type DistanceUnit,
  type Field,
  type PaceUnit,
  type Recency,
  type Values,
} from './calc';
import { formatClock, formatPace } from './pace';

const PACE_UNITS: Array<[PaceUnit, string]> = [
  ['km', 'min/km'],
  ['mi', 'min/mi'],
];

const DISTANCE_UNITS: Array<[DistanceUnit, string]> = [
  ['m', 'm'],
  ['km', 'km'],
  ['mi', 'mi'],
];

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function input(field: Field, placeholder: string): HTMLInputElement {
  const el = element('input', 'field-input');
  el.id = `calc-${field}`;
  // A pace is `5:30`, so this can't be type=number. inputmode still gets a
  // phone to offer the keypad rather than the alphabet.
  el.type = 'text';
  el.inputMode = 'decimal';
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.placeholder = placeholder;
  return el;
}

function unitSelect(
  field: Field,
  options: Array<[string, string]>,
  initial: string,
): HTMLSelectElement {
  const select = element('select', 'field-unit');
  select.id = `calc-${field}-unit`;
  select.setAttribute('aria-label', `${field} unit`);
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  // Stated rather than left to the first option: the units are listed smallest
  // first, which would open the distance field in metres.
  select.value = initial;
  return select;
}

function row(field: Field, label: string, controls: HTMLElement[]): HTMLElement {
  const wrapper = element('div', 'field');
  wrapper.dataset.field = field;

  const caption = element('label', 'field-label');
  caption.htmlFor = `calc-${field}`;
  caption.textContent = label;

  const line = element('div', 'field-controls');
  line.append(...controls);

  wrapper.append(caption, line);
  return wrapper;
}

/** The panel's structure. `enableCalculator` gives it its behaviour. */
export function renderCalculator(): HTMLElement {
  const panel = element('div', 'calc-inner');

  const head = element('div', 'calc-head');
  head.textContent = 'CALCULATOR';

  const body = element('div', 'calc-body');

  const pace = row('pace', 'PACE', [input('pace', '5:30'), unitSelect('pace', PACE_UNITS, 'km')]);
  // The pace in the unit the user isn't entering it in. This is the
  // min/km → min/mi conversion, and it reads whichever way round the unit is.
  const alt = element('p', 'field-note');
  alt.id = 'calc-pace-alt';
  pace.append(alt);

  body.append(
    pace,
    row('distance', 'DISTANCE', [
      input('distance', '21.0975'),
      unitSelect('distance', DISTANCE_UNITS, 'km'),
    ]),
    row('time', 'TIME', [input('time', '1:56:02')]),
  );

  panel.append(head, body);
  return panel;
}

/** Pace text in a given unit → seconds per km. */
function readPace(text: string, unit: PaceUnit): number | null {
  const seconds = parsePaceInput(text);
  return seconds === null ? null : toSecPerKm(seconds, unit);
}

/** Distance text in a given unit → kilometres. */
function readDistance(text: string, unit: DistanceUnit): number | null {
  const value = parseDistanceInput(text);
  return value === null ? null : toKm(value, unit);
}

/**
 * Wires the panel's three fields together. Two of them are inputs and the third
 * is the answer; editing the answer demotes whichever other field was touched
 * longest ago, so the answer can always be moved but never gets stuck.
 *
 * Returns a disposer that unbinds everything.
 */
export function enableCalculator(panel: HTMLElement): () => void {
  const fields = {
    pace: panel.querySelector<HTMLInputElement>('#calc-pace')!,
    distance: panel.querySelector<HTMLInputElement>('#calc-distance')!,
    time: panel.querySelector<HTMLInputElement>('#calc-time')!,
  } as const;
  const paceUnit = panel.querySelector<HTMLSelectElement>('#calc-pace-unit')!;
  const distanceUnit = panel.querySelector<HTMLSelectElement>('#calc-distance-unit')!;
  const alt = panel.querySelector<HTMLElement>('#calc-pace-alt')!;
  const rows = panel.querySelectorAll<HTMLElement>('.field');

  // Time is the answer to begin with: a pace and a distance is what people
  // arrive with, and how long it takes is what they came to find out.
  let order: Recency = ['distance', 'pace', 'time'];

  // A unit change has to read the field in the unit it was typed in, which the
  // select no longer reports by the time the event fires.
  let previousPaceUnit = paceUnit.value as PaceUnit;
  let previousDistanceUnit = distanceUnit.value as DistanceUnit;

  /** Read a field into canonical units, or null if it can't be read. */
  function read(field: Field): number | null {
    if (field === 'pace') return readPace(fields.pace.value, paceUnit.value as PaceUnit);
    if (field === 'distance') {
      return readDistance(fields.distance.value, distanceUnit.value as DistanceUnit);
    }
    return parseDurationInput(fields.time.value);
  }

  /** Canonical value → what that field should read. */
  function display(field: Field, value: number | null): string {
    if (value === null) return '';
    if (field === 'pace') {
      return formatPace(Math.round(fromSecPerKm(value, paceUnit.value as PaceUnit)));
    }
    if (field === 'distance') {
      return formatDistanceValue(fromKm(value, distanceUnit.value as DistanceUnit));
    }
    return formatClock(value);
  }

  function recalculate(): void {
    const answer = computedField(order);

    const known: Values = { pace: null, distance: null, time: null };
    for (const field of order) {
      if (field !== answer) known[field] = read(field);
    }

    const solved = solve(known, answer);
    fields[answer].value = display(answer, solved[answer]);

    for (const el of rows) el.classList.toggle('computed', el.dataset.field === answer);

    // The readout is the pace in the unit the field isn't using — whether that
    // pace was typed or worked out.
    const other: PaceUnit = paceUnit.value === 'km' ? 'mi' : 'km';
    alt.textContent =
      solved.pace === null
        ? ''
        : `= ${formatPace(Math.round(fromSecPerKm(solved.pace, other)))} min/${other}`;
  }

  function onInput(event: Event): void {
    const target = event.target as HTMLElement;
    // A <select> fires input as well as change. Changing a unit isn't editing
    // the field, and must not move it to the front of the recency order.
    if (target instanceof HTMLSelectElement) return;

    const field = target.closest<HTMLElement>('.field')?.dataset.field as Field | undefined;
    if (!field) return;

    order = touch(order, field);
    recalculate();
  }

  /**
   * Rewrite a field in canonical form once it's left alone. A phone keypad has
   * no colon, so a pace arrives as `530` or `5.30`; showing it back as `5:30`
   * both matches the rest of the app and teaches the shorthand without needing
   * a line of help text. Text that can't be read is left exactly as typed.
   *
   * On the way out, not while typing: rewriting mid-word would fight the cursor.
   */
  function onFocusOut(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const field = target.closest<HTMLElement>('.field')?.dataset.field as Field | undefined;
    if (!field) return;

    // Display-only: the canonical value is unchanged, so nothing is recomputed
    // and the recency order stays where it was.
    const canonical = read(field);
    if (canonical !== null) target.value = display(field, canonical);
  }

  function onUnitChange(event: Event): void {
    const forPace = event.target === paceUnit;

    // Convert what's shown rather than rereading it: switching 5:30 min/km to
    // min/mi has to give 8:51, not 5:30 of a different unit. So read it in the
    // unit it was typed in, then redisplay it in the new one. Text that can't
    // be read is left exactly as typed — rewriting it would be the rude thing
    // to do to someone mid-word.
    const canonical = forPace
      ? readPace(fields.pace.value, previousPaceUnit)
      : readDistance(fields.distance.value, previousDistanceUnit);

    previousPaceUnit = paceUnit.value as PaceUnit;
    previousDistanceUnit = distanceUnit.value as DistanceUnit;

    const field: Field = forPace ? 'pace' : 'distance';
    if (canonical !== null) fields[field].value = display(field, canonical);
    recalculate();
  }

  panel.addEventListener('input', onInput);
  // focusout, not blur: blur doesn't bubble to the panel.
  panel.addEventListener('focusout', onFocusOut);
  paceUnit.addEventListener('change', onUnitChange);
  distanceUnit.addEventListener('change', onUnitChange);
  recalculate();

  return () => {
    panel.removeEventListener('input', onInput);
    panel.removeEventListener('focusout', onFocusOut);
    paceUnit.removeEventListener('change', onUnitChange);
    distanceUnit.removeEventListener('change', onUnitChange);
  };
}
