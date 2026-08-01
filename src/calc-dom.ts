import {
  computedField,
  distanceProblem,
  durationProblem,
  formatDistanceValue,
  fromKm,
  fromSecPerKm,
  paceProblem,
  parseDistanceInput,
  parseDurationInput,
  parsePaceInput,
  solve,
  toKm,
  toSecPerKm,
  touch,
  TYPEABLE,
  type DistanceUnit,
  type Field,
  type PaceUnit,
  type Problem,
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

/**
 * A nudge, not a telling-off. Lower case, no exclamation, and it says what the
 * field wants rather than what the user did — `seconds go from 00 to 59` is a
 * fact about clocks, where `invalid seconds` is a verdict about them.
 */
const MESSAGES: Record<Field, { sixtieths: string; shape: string }> = {
  pace: {
    sixtieths: 'seconds go from 00 to 59',
    shape: 'a pace looks like 5:30',
  },
  time: {
    sixtieths: 'minutes and seconds go from 00 to 59',
    shape: 'a time looks like 1:56:02',
  },
  distance: {
    sixtieths: '',
    shape: 'a distance looks like 21.1',
  },
};

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

/**
 * The line under each field. It says the one useful thing it can: what's wrong
 * with what's been typed, or — for the pace — the same pace in the other unit.
 * The space is held open so nothing shifts as the message comes and goes.
 */
function note(field: Field): HTMLElement {
  const el = document.createElement('p');
  el.className = 'field-note';
  el.id = noteId(field);
  // Polite, not assertive: a nudge that waits its turn rather than interrupting.
  el.setAttribute('aria-live', 'polite');
  return el;
}

function noteId(field: Field): string {
  return `calc-${field}-note`;
}

function row(field: Field, label: string, controls: HTMLElement[]): HTMLElement {
  const wrapper = element('div', 'field');
  wrapper.dataset.field = field;

  const caption = element('label', 'field-label');
  caption.htmlFor = `calc-${field}`;
  caption.textContent = label;

  const line = element('div', 'field-controls');
  line.append(...controls);

  const hint = note(field);
  const input = controls[0];
  input.setAttribute('aria-describedby', hint.id);

  wrapper.append(caption, line, hint);
  return wrapper;
}

/** The panel's structure. `enableCalculator` gives it its behaviour. */
export function renderCalculator(): HTMLElement {
  const panel = element('div', 'calc-inner');

  const head = element('div', 'calc-head');
  head.textContent = 'CALCULATOR';

  const body = element('div', 'calc-body');

  body.append(
    row('pace', 'PACE', [input('pace', '5:30'), unitSelect('pace', PACE_UNITS, 'km')]),
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
  const notes = {
    pace: panel.querySelector<HTMLElement>('#calc-pace-note')!,
    distance: panel.querySelector<HTMLElement>('#calc-distance-note')!,
    time: panel.querySelector<HTMLElement>('#calc-time-note')!,
  } as const;
  const paceUnit = panel.querySelector<HTMLSelectElement>('#calc-pace-unit')!;
  const distanceUnit = panel.querySelector<HTMLSelectElement>('#calc-distance-unit')!;
  const rows = panel.querySelectorAll<HTMLElement>('.field');

  // Fields the user has finished with. A problem that more typing could fix
  // waits until then; nobody wants to be corrected mid-word.
  const settled = new Set<Field>();

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

  function problemFor(field: Field): Problem | null {
    if (field === 'pace') return paceProblem(fields.pace.value);
    if (field === 'distance') return distanceProblem(fields.distance.value);
    return durationProblem(fields.time.value);
  }

  /**
   * What to say under a field, if anything. A `sixtieths` slip is said at once
   * — no amount of further typing turns 4:60 into a pace — while everything
   * else waits until the field is left.
   */
  function message(field: Field): string {
    const problem = problemFor(field);
    if (!problem) return '';
    if (problem !== 'sixtieths' && !settled.has(field)) return '';
    return MESSAGES[field][problem === 'sixtieths' ? 'sixtieths' : 'shape'];
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

    // The pace's line does double duty: the same pace in the other unit when
    // there is one, and why there isn't when there isn't.
    const other: PaceUnit = paceUnit.value === 'km' ? 'mi' : 'km';
    const conversion =
      solved.pace === null
        ? ''
        : `= ${formatPace(Math.round(fromSecPerKm(solved.pace, other)))} min/${other}`;

    for (const field of ['pace', 'distance', 'time'] as const) {
      // The answer is generated, never typed, so it is never at fault.
      const problem = field === answer ? '' : message(field);
      notes[field].textContent = problem || (field === 'pace' ? conversion : '');
      notes[field].classList.toggle('is-problem', problem !== '');
    }
  }

  function fieldOf(target: EventTarget | null): Field | undefined {
    if (!(target instanceof HTMLElement)) return undefined;
    return target.closest<HTMLElement>('.field')?.dataset.field as Field | undefined;
  }

  /**
   * Refuse anything that isn't a number or a separator that field uses, rather
   * than accepting letters and then explaining they were wrong. Covers pasting
   * and dropping as well as typing, since all three arrive as `beforeinput`.
   *
   * A phone's keypad already offers nothing else, so this is really the desktop
   * keyboard's guard rail.
   */
  function onBeforeInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const field = fieldOf(target);
    if (!field) return;

    const { inputType, data, dataTransfer } = event as InputEvent;
    // Deleting, undoing and moving about are none of our business.
    if (!inputType.startsWith('insert')) return;

    const incoming = data ?? dataTransfer?.getData('text') ?? '';
    if (incoming !== '' && !TYPEABLE[field].test(incoming)) event.preventDefault();
  }

  function onInput(event: Event): void {
    // A <select> fires input as well as change. Changing a unit isn't editing
    // the field, and must not move it to the front of the recency order.
    if (event.target instanceof HTMLSelectElement) return;

    const field = fieldOf(event.target);
    if (!field) return;

    // Typing again means they're mid-thought: hold back anything but a slip
    // that further typing can't fix.
    settled.delete(field);
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

    const field = fieldOf(target);
    if (!field) return;

    // Display-only: the canonical value is unchanged, so the recency order and
    // every computed value stay exactly where they were.
    const canonical = read(field);
    if (canonical !== null) target.value = display(field, canonical);

    // Now that they've moved on, a half-finished value is worth mentioning.
    settled.add(field);
    recalculate();
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

  panel.addEventListener('beforeinput', onBeforeInput);
  panel.addEventListener('input', onInput);
  // focusout, not blur: blur doesn't bubble to the panel.
  panel.addEventListener('focusout', onFocusOut);
  paceUnit.addEventListener('change', onUnitChange);
  distanceUnit.addEventListener('change', onUnitChange);
  recalculate();

  return () => {
    panel.removeEventListener('beforeinput', onBeforeInput);
    panel.removeEventListener('input', onInput);
    panel.removeEventListener('focusout', onFocusOut);
    paceUnit.removeEventListener('change', onUnitChange);
    distanceUnit.removeEventListener('change', onUnitChange);
  };
}
