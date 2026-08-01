# Pace Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calculator view — pace, distance and time, any two filling the third — reached by a playful swap button on the plate's corner.

**Architecture:** A DOM-free `calc.ts` holds the arithmetic, `calc-dom.ts` builds and wires the panel, and `mode.ts` swaps the views by toggling one class on `.plate`. The tape is built once and never unmounted; the inactive view is hidden with `visibility`, not `display`, so switching costs a repaint rather than a relayout of ~2,900 cells.

**Tech Stack:** Vite 7, TypeScript 5.9, vitest 3 + happy-dom. No new dependencies.

Spec: `docs/superpowers/specs/2026-08-01-pace-calculator-design.md`.

## Global Constraints

- No new runtime dependencies.
- `calc.ts` imports no DOM types and touches no globals — same rule `pace.ts` follows.
- `KM_PER_MI` in `pace.ts` stays the app's only conversion constant.
- Every `enableX()` returns a disposer that unbinds what it bound, matching `enableInfoPanels` and `enableDragScroll`.
- Parsers return `null` for unusable input. Nothing throws, and `NaN` never reaches the DOM.
- Kilometres and seconds are canonical everywhere; units are a display concern.
- Comments explain *why*, in the register the existing files use. No comment restates its line.
- `npm test` and `npm run build` (which runs `tsc --noEmit`) must both pass before every commit.

---

### Task 1: The arithmetic

**Files:**
- Modify: `src/pace.ts` (extract `formatClock` out of `formatDuration`)
- Create: `src/calc.ts`
- Test: `src/calc.test.ts`, and add to `src/pace.test.ts`

**Interfaces:**
- Consumes: `KM_PER_MI`, `formatPace` from `pace.ts`.
- Produces: `DistanceUnit`, `PaceUnit`, `Field`, `Values`, `Recency`, `toKm`, `fromKm`, `toSecPerKm`, `fromSecPerKm`, `parsePaceInput`, `parseDurationInput`, `parseDistanceInput`, `solve`, `touch`, `computedField`, `formatDistanceValue`; plus `formatClock` from `pace.ts`.

**Why `formatClock`:** `formatDuration` prints `2d 4h` past a day, which is right for a table cell but wrong for an input — the time field has to be able to re-read its own value. `formatClock` always gives `h:mm:ss` (or `m:ss` under an hour), which round-trips through `parseDurationInput`. Extracting it also removes the duplicate h:mm:ss branch rather than adding one.

- [ ] **Step 1: Write the failing tests for `formatClock`**

Append to `src/pace.test.ts`:

```ts
describe('formatClock', () => {
  it('gives m:ss under an hour, like a pace', () => {
    expect(formatClock(3364)).toBe('56:04');
  });

  it('gives h:mm:ss at an hour and beyond', () => {
    expect(formatClock(6964)).toBe('1:56:04');
  });

  it('keeps counting hours past a day, so the value can be typed back in', () => {
    expect(formatClock(580_320)).toBe('161:12:00');
  });
});
```

Add `formatClock` to the existing import from `./pace` at the top of the file.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/pace.test.ts`
Expected: FAIL — `formatClock is not a function`.

- [ ] **Step 3: Extract `formatClock` in `src/pace.ts`**

Replace the body of `formatDuration` (lines 32-46) with:

```ts
/**
 * Always `h:mm:ss`, or `m:ss` under an hour — a form that parses back. The
 * calculator's time field is an input, so a value it can't re-read is a value
 * the user has to retype.
 */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);

  if (seconds < SECONDS_PER_HOUR) return formatPace(seconds);

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Format a finish time at the precision that distance deserves: `m:ss` for a
 * 5K, `h:mm:ss` for a marathon, and `Dd Hh` past a day — which is how anyone
 * running a 200-miler talks about their time anyway.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);

  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    const hours = Math.floor((seconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    return `${days}d ${hours}h`;
  }

  return formatClock(seconds);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/pace.test.ts`
Expected: PASS — the existing `formatDuration` tests included, unchanged.

- [ ] **Step 5: Write the failing tests for `calc.ts`**

Create `src/calc.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
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
  type Recency,
} from './calc';

describe('parsePaceInput', () => {
  it('reads m:ss', () => {
    expect(parsePaceInput('5:30')).toBe(330);
  });

  it('reads bare minutes as a whole number of them', () => {
    expect(parsePaceInput('5')).toBe(300);
  });

  it('ignores surrounding space', () => {
    expect(parsePaceInput('  4:05 ')).toBe(245);
  });

  it('rejects sixty seconds and over', () => {
    expect(parsePaceInput('7:75')).toBeNull();
  });

  it('rejects an hours field — a pace is not that slow', () => {
    expect(parsePaceInput('1:05:30')).toBeNull();
  });

  it('rejects letters, signs and empty text', () => {
    for (const bad of ['abc', '-5:30', '5:3a', '', '   ', '5:']) {
      expect(parsePaceInput(bad)).toBeNull();
    }
  });

  it('rejects zero, which is not a pace', () => {
    expect(parsePaceInput('0:00')).toBeNull();
  });
});

describe('parseDurationInput', () => {
  it('reads h:mm:ss', () => {
    expect(parseDurationInput('1:56:04')).toBe(6964);
  });

  it('reads m:ss', () => {
    expect(parseDurationInput('56:04')).toBe(3364);
  });

  it('reads bare minutes', () => {
    expect(parseDurationInput('45')).toBe(2700);
  });

  it('allows an hours field past 24, so a 200-miler can be typed in', () => {
    expect(parseDurationInput('161:12:00')).toBe(580_320);
  });

  it('rejects a fourth field', () => {
    expect(parseDurationInput('1:2:3:4')).toBeNull();
  });

  it('rejects sixty in a sixtieths field', () => {
    expect(parseDurationInput('1:60:00')).toBeNull();
  });
});

describe('parseDistanceInput', () => {
  it('reads a decimal point', () => {
    expect(parseDistanceInput('21.0975')).toBe(21.0975);
  });

  it('reads a decimal comma, which is what half of Europe types', () => {
    expect(parseDistanceInput('21,0975')).toBe(21.0975);
  });

  it('reads a whole number', () => {
    expect(parseDistanceInput('5')).toBe(5);
  });

  it('tolerates a trailing separator mid-typing', () => {
    expect(parseDistanceInput('5.')).toBe(5);
  });

  it('rejects zero, negatives and junk', () => {
    for (const bad of ['0', '-5', 'abc', '', '5km']) {
      expect(parseDistanceInput(bad)).toBeNull();
    }
  });
});

describe('unit conversion', () => {
  it('treats kilometres as canonical', () => {
    expect(toKm(5, 'km')).toBe(5);
  });

  it('reads metres', () => {
    expect(toKm(5000, 'm')).toBeCloseTo(5, 10);
  });

  it('reads miles', () => {
    expect(toKm(1, 'mi')).toBeCloseTo(1.609344, 10);
  });

  it('round-trips a distance through any unit', () => {
    for (const unit of ['m', 'km', 'mi'] as const) {
      expect(fromKm(toKm(42.195, unit), unit)).toBeCloseTo(42.195, 9);
    }
  });

  it('converts a min/mi pace to seconds per km', () => {
    expect(toSecPerKm(531, 'mi')).toBeCloseTo(330, 0);
  });

  it('converts seconds per km back out to min/mi', () => {
    expect(fromSecPerKm(330, 'mi')).toBeCloseTo(531, 0);
  });

  it('round-trips a pace through either unit', () => {
    for (const unit of ['km', 'mi'] as const) {
      expect(toSecPerKm(fromSecPerKm(330, unit), unit)).toBeCloseTo(330, 9);
    }
  });
});

describe('solve', () => {
  const half = { pace: 330, distance: 21.0975, time: null };

  it('multiplies pace by distance for a time', () => {
    expect(solve(half, 'time').time).toBeCloseTo(6962.175, 3);
  });

  it('divides time by distance for a pace', () => {
    const solved = solve({ pace: null, distance: 21.0975, time: 6962.175 }, 'pace');
    expect(solved.pace).toBeCloseTo(330, 6);
  });

  it('divides time by pace for a distance', () => {
    const solved = solve({ pace: 330, distance: null, time: 6962.175 }, 'distance');
    expect(solved.distance).toBeCloseTo(21.0975, 6);
  });

  it('leaves the computed field null when an input is missing', () => {
    expect(solve({ pace: 330, distance: null, time: null }, 'time').time).toBeNull();
  });

  it('refuses to divide by a zero distance', () => {
    expect(solve({ pace: null, distance: 0, time: 3600 }, 'pace').pace).toBeNull();
  });

  it('refuses to divide by a zero pace', () => {
    expect(solve({ pace: 0, distance: null, time: 3600 }, 'distance').distance).toBeNull();
  });

  it('passes the two inputs through untouched', () => {
    const solved = solve({ pace: 330, distance: null, time: null }, 'time');
    expect(solved.pace).toBe(330);
    expect(solved.distance).toBeNull();
  });
});

describe('recency', () => {
  const start: Recency = ['distance', 'pace', 'time'];

  it('computes whichever field was touched longest ago', () => {
    expect(computedField(start)).toBe('time');
  });

  it('moves a touched field to the front', () => {
    expect(touch(start, 'time')).toEqual(['time', 'distance', 'pace']);
  });

  it('demotes the stalest field when another is touched', () => {
    expect(computedField(touch(start, 'time'))).toBe('pace');
  });

  it('leaves the order alone when the newest field is touched again', () => {
    expect(touch(start, 'distance')).toEqual(start);
  });
});

describe('formatDistanceValue', () => {
  it('drops a whole number to no decimals', () => {
    expect(formatDistanceValue(5)).toBe('5');
  });

  it('keeps the precision a course distance needs', () => {
    expect(formatDistanceValue(21.0975)).toBe('21.098');
  });

  it('does not print floating-point noise', () => {
    expect(formatDistanceValue(0.1 + 0.2)).toBe('0.3');
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run src/calc.test.ts`
Expected: FAIL — cannot resolve `./calc`.

- [ ] **Step 7: Write `src/calc.ts`**

```ts
import { KM_PER_MI } from './pace';

/** What the distance field can be entered in. */
export type DistanceUnit = 'm' | 'km' | 'mi';

/** What the pace field can be entered in. Metres per minute is not a pace. */
export type PaceUnit = 'km' | 'mi';

/** The three quantities, and the name of whichever one is being solved for. */
export type Field = 'pace' | 'distance' | 'time';

/** All three in canonical units: seconds per km, kilometres, seconds. */
export interface Values {
  pace: number | null;
  distance: number | null;
  time: number | null;
}

const KM_PER_DISTANCE_UNIT: Record<DistanceUnit, number> = {
  m: 0.001,
  km: 1,
  mi: KM_PER_MI,
};

export function toKm(value: number, unit: DistanceUnit): number {
  return value * KM_PER_DISTANCE_UNIT[unit];
}

export function fromKm(km: number, unit: DistanceUnit): number {
  return km / KM_PER_DISTANCE_UNIT[unit];
}

/**
 * Pace runs the other way round from distance: covering a longer unit takes
 * *more* seconds, so seconds-per-mile divides down to seconds-per-km.
 */
export function toSecPerKm(seconds: number, unit: PaceUnit): number {
  return unit === 'km' ? seconds : seconds / KM_PER_MI;
}

export function fromSecPerKm(secPerKm: number, unit: PaceUnit): number {
  return unit === 'km' ? secPerKm : secPerKm * KM_PER_MI;
}

/**
 * Split clock text into its parts. Every field after the first counts a
 * sixtieth, so anything over 59 there is a typo rather than a big number.
 */
function clockParts(text: string): number[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  const parts: number[] = [];
  for (const part of trimmed.split(':')) {
    if (!/^\d+$/.test(part)) return null;
    parts.push(Number(part));
  }

  if (parts.slice(1).some((part) => part > 59)) return null;
  return parts;
}

/** `5:30` → 330, `5` → 300. Null for anything that isn't a pace. */
export function parsePaceInput(text: string): number | null {
  const parts = clockParts(text);
  if (!parts || parts.length > 2) return null;

  const total = parts[0] * 60 + (parts[1] ?? 0);
  return total > 0 ? total : null;
}

/** `1:56:04` → 6964, `56:04` → 3364, `45` → 2700. */
export function parseDurationInput(text: string): number | null {
  const parts = clockParts(text);
  if (!parts || parts.length > 3) return null;

  // Read from the right: the last field is always the smallest unit present.
  const total = parts.reduceRight(
    (sum, part, index) => sum + part * 60 ** (parts.length - 1 - index),
    0,
  );
  // One bare field is minutes, not seconds — nobody types a race time in
  // seconds, and `45` for a 45-minute 10K is the common case.
  const seconds = parts.length === 1 ? total * 60 : total;
  return seconds > 0 ? seconds : null;
}

/** `21,0975` → 21.0975. A decimal comma is what half of Europe types. */
export function parseDistanceInput(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Returns `values` with `computed` filled in from the other two. */
export function solve(values: Values, computed: Field): Values {
  const { pace, distance, time } = values;

  switch (computed) {
    case 'time':
      return { ...values, time: pace !== null && distance !== null ? pace * distance : null };
    // A falsy distance or pace is either absent or zero, and neither divides.
    case 'pace':
      return { ...values, pace: time !== null && distance ? time / distance : null };
    case 'distance':
      return { ...values, distance: time !== null && pace ? time / pace : null };
  }
}

/** The three fields, most recently edited first. */
export type Recency = [Field, Field, Field];

/** Two fields are inputs; the one touched longest ago is the answer. */
export function computedField(order: Recency): Field {
  return order[2];
}

export function touch(order: Recency, field: Field): Recency {
  return [field, ...order.filter((other) => other !== field)] as Recency;
}

/**
 * Enough decimals for a half marathon's 21.0975 km to survive a unit change,
 * without printing the floating-point tail that division leaves behind.
 */
export function formatDistanceValue(value: number): string {
  return String(Number(value.toFixed(3)));
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run src/calc.test.ts src/pace.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck and commit**

```bash
npm run build
git add src/calc.ts src/calc.test.ts src/pace.ts src/pace.test.ts
git commit -m "feat: add the pace calculator's arithmetic"
```

---

### Task 2: The calculator panel

**Files:**
- Create: `src/calc-dom.ts`
- Test: `src/calc-dom.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced, plus `formatPace` and `formatClock` from `pace.ts`.
- Produces: `renderCalculator(): HTMLElement` and `enableCalculator(panel: HTMLElement): () => void`.

**Structure it builds** (ids matter — the tests and `mode.ts` use them):

```
div.calc-head            "CALCULATOR"
div.calc-body
  div.field[data-field=pace]
    label.field-label[for=calc-pace]        "PACE"
    div.field-controls
      input.field-input#calc-pace
      select.field-unit#calc-pace-unit      min/km | min/mi
    p.field-note#calc-pace-alt              "= 8:51 min/mi"
  div.field[data-field=distance]
    label.field-label[for=calc-distance]    "DISTANCE"
    div.field-controls
      input.field-input#calc-distance
      select.field-unit#calc-distance-unit  m | km | mi
  div.field[data-field=time]
    label.field-label[for=calc-time]        "TIME"
    div.field-controls
      input.field-input#calc-time
```

- [ ] **Step 1: Write the failing tests**

Create `src/calc-dom.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { enableCalculator, renderCalculator } from './calc-dom';

let panel: HTMLElement;
let dispose: () => void;

function field(name: string): HTMLInputElement {
  return panel.querySelector<HTMLInputElement>(`#calc-${name}`)!;
}

function unit(name: string): HTMLSelectElement {
  return panel.querySelector<HTMLSelectElement>(`#calc-${name}-unit`)!;
}

function type(name: string, value: string): void {
  const input = field(name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(name: string, value: string): void {
  const select = unit(name);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function computed(): string | undefined {
  return panel.querySelector<HTMLElement>('.field.computed')?.dataset.field;
}

beforeEach(() => {
  document.body.replaceChildren();
  panel = renderCalculator();
  document.body.append(panel);
  dispose = enableCalculator(panel);
  return () => dispose();
});

describe('the panel', () => {
  it('offers all three distance units', () => {
    const values = [...unit('distance').options].map((option) => option.value);
    expect(values).toEqual(['m', 'km', 'mi']);
  });

  it('offers both pace units', () => {
    const values = [...unit('pace').options].map((option) => option.value);
    expect(values).toEqual(['km', 'mi']);
  });

  it('starts with time as the answer, the way people arrive at a pace tool', () => {
    expect(computed()).toBe('time');
  });

  it('asks phones for a numeric keypad', () => {
    for (const name of ['pace', 'distance', 'time']) {
      expect(field(name).getAttribute('inputmode')).toBe('decimal');
    }
  });
});

describe('solving', () => {
  it('fills the time from a pace and a distance', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    expect(field('time').value).toBe('1:56:02');
  });

  it('fills the pace once the time is typed instead', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    type('time', '1:56:02');
    expect(computed()).toBe('pace');
    expect(field('pace').value).toBe('5:30');
  });

  it('fills the distance when pace and time are the two newest fields', () => {
    type('distance', '10');
    type('time', '55:00');
    type('pace', '5:30');
    expect(computed()).toBe('distance');
    expect(field('distance').value).toBe('10');
  });

  it('counts a marathon in hours', () => {
    type('pace', '5:00');
    type('distance', '42.195');
    expect(field('time').value).toBe('3:30:59');
  });

  it('keeps a 300-mile time readable and re-typable', () => {
    type('pace', '20:00');
    choose('distance', 'mi');
    type('distance', '300.5');
    expect(field('time').value).toBe('161:11:52');
  });
});

describe('the min/mi readout', () => {
  it('shows the other unit alongside a min/km pace', () => {
    type('pace', '5:30');
    expect(panel.querySelector('#calc-pace-alt')!.textContent).toBe('= 8:51 min/mi');
  });

  it('flips to min/km when the field is set to miles', () => {
    type('pace', '8:51');
    choose('pace', 'mi');
    expect(panel.querySelector('#calc-pace-alt')!.textContent).toBe('= 5:30 min/km');
  });

  it('tracks a pace the calculator worked out rather than one that was typed', () => {
    type('distance', '10');
    type('time', '55:00');
    expect(panel.querySelector('#calc-pace-alt')!.textContent).toBe('= 8:51 min/mi');
  });

  it('empties when there is no pace to show', () => {
    expect(panel.querySelector('#calc-pace-alt')!.textContent).toBe('');
  });
});

describe('changing units', () => {
  it('converts the value rather than reinterpreting it', () => {
    type('pace', '5:30');
    choose('pace', 'mi');
    expect(field('pace').value).toBe('8:51');
  });

  it('converts a distance to metres', () => {
    type('distance', '5');
    choose('distance', 'm');
    expect(field('distance').value).toBe('5000');
  });

  it('converts a distance to miles', () => {
    type('distance', '42.195');
    choose('distance', 'mi');
    expect(field('distance').value).toBe('26.219');
  });

  it('holds the answer steady while its inputs change unit', () => {
    type('pace', '5:30');
    type('distance', '10');
    const before = field('time').value;
    choose('distance', 'm');
    expect(field('time').value).toBe(before);
  });

  it('leaves an unparseable value exactly as typed', () => {
    type('distance', 'soon');
    choose('distance', 'mi');
    expect(field('distance').value).toBe('soon');
  });
});

describe('bad input', () => {
  it('blanks the answer rather than showing NaN', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    type('distance', 'wat');
    expect(field('time').value).toBe('');
  });

  it('recovers once the input is valid again', () => {
    type('pace', '5:30');
    type('distance', 'wat');
    type('distance', '10');
    expect(field('time').value).toBe('55:00');
  });

  it('survives an empty field', () => {
    type('pace', '5:30');
    type('pace', '');
    expect(field('time').value).toBe('');
  });
});

describe('dispose', () => {
  it('stops recalculating', () => {
    type('pace', '5:30');
    type('distance', '10');
    dispose();
    type('distance', '20');
    expect(field('time').value).toBe('55:00');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/calc-dom.test.ts`
Expected: FAIL — cannot resolve `./calc-dom`.

- [ ] **Step 3: Write `src/calc-dom.ts`**

```ts
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
  el.type = 'text';
  // A pace is `5:30`, so the field can't be type=number; inputmode still gets
  // a phone to offer the keypad rather than the alphabet.
  el.inputMode = 'decimal';
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.placeholder = placeholder;
  return el;
}

function unitSelect(field: Field, options: Array<[string, string]>): HTMLSelectElement {
  const select = element('select', 'field-unit');
  select.id = `calc-${field}-unit`;
  select.setAttribute('aria-label', `${field} unit`);
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
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
  const panel = element('div', 'calc');

  const head = element('div', 'calc-head');
  head.textContent = 'CALCULATOR';

  const body = element('div', 'calc-body');

  const pace = row('pace', 'PACE', [
    input('pace', '5:30'),
    unitSelect('pace', PACE_UNITS),
  ]);
  // The pace the user isn't entering in. This is the min/km → min/mi
  // conversion, and it reads whichever way round the unit is set.
  const alt = element('p', 'field-note');
  alt.id = 'calc-pace-alt';
  pace.append(alt);

  body.append(
    pace,
    row('distance', 'DISTANCE', [
      input('distance', '21.0975'),
      unitSelect('distance', DISTANCE_UNITS),
    ]),
    row('time', 'TIME', [input('time', '1:56:02')]),
  );

  panel.append(head, body);
  return panel;
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

  function paceIn(): PaceUnit {
    return paceUnit.value as PaceUnit;
  }

  function distanceIn(): DistanceUnit {
    return distanceUnit.value as DistanceUnit;
  }

  /** Read a field into canonical units, or null if it can't be read. */
  function read(field: Field): number | null {
    if (field === 'pace') {
      const seconds = parsePaceInput(fields.pace.value);
      return seconds === null ? null : toSecPerKm(seconds, paceIn());
    }
    if (field === 'distance') {
      const value = parseDistanceInput(fields.distance.value);
      return value === null ? null : toKm(value, distanceIn());
    }
    return parseDurationInput(fields.time.value);
  }

  /** Canonical value → what that field should read. */
  function display(field: Field, value: number | null): string {
    if (value === null) return '';
    if (field === 'pace') return formatPace(Math.round(fromSecPerKm(value, paceIn())));
    if (field === 'distance') return formatDistanceValue(fromKm(value, distanceIn()));
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
    const other: PaceUnit = paceIn() === 'km' ? 'mi' : 'km';
    alt.textContent =
      solved.pace === null
        ? ''
        : `= ${formatPace(Math.round(fromSecPerKm(solved.pace, other)))} min/${other}`;
  }

  function onInput(event: Event): void {
    const target = event.target as HTMLElement;
    const field = target.closest<HTMLElement>('.field')?.dataset.field as Field | undefined;
    if (!field) return;
    order = touch(order, field);
    recalculate();
  }

  function onUnitChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const field: Field = select === paceUnit ? 'pace' : 'distance';

    // Convert what's shown rather than rereading it: switching 5:30 min/km to
    // min/mi has to give 8:51, not 5:30 of a different unit. Read it in the
    // unit it was typed in, then redisplay it in the new one. Unparseable text
    // is left exactly as typed — retyping it would be the rude thing to do.
    const previous = field === 'pace' ? previousPaceUnit : previousDistanceUnit;
    const canonical =
      field === 'pace'
        ? (() => {
            const seconds = parsePaceInput(fields.pace.value);
            return seconds === null ? null : toSecPerKm(seconds, previous as PaceUnit);
          })()
        : (() => {
            const value = parseDistanceInput(fields.distance.value);
            return value === null ? null : toKm(value, previous as DistanceUnit);
          })();

    previousPaceUnit = paceIn();
    previousDistanceUnit = distanceIn();

    if (canonical !== null) fields[field].value = display(field, canonical);
    recalculate();
  }

  panel.addEventListener('input', onInput);
  paceUnit.addEventListener('change', onUnitChange);
  distanceUnit.addEventListener('change', onUnitChange);
  recalculate();

  return () => {
    panel.removeEventListener('input', onInput);
    paceUnit.removeEventListener('change', onUnitChange);
    distanceUnit.removeEventListener('change', onUnitChange);
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/calc-dom.test.ts`
Expected: PASS. If a rounding expectation is off by a second, verify the arithmetic by hand before changing the test — the expected values above were computed from `KM_PER_MI = 1.609344`.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run build
git add src/calc-dom.ts src/calc-dom.test.ts
git commit -m "feat: build and wire the calculator panel"
```

---

### Task 3: The swap

**Files:**
- Modify: `index.html` (wrap the plate, add the button and the views grid)
- Create: `src/mode.ts`
- Test: `src/mode.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `renderCalculator`, `enableCalculator` from Task 2.
- Produces: `enableModeToggle(elements: ModeElements): () => void`, and the class `calc-mode` on `.plate`, which Task 4 styles.

- [ ] **Step 1: Restructure `index.html`**

Replace lines 29-46 (`<main class="plate" …>` through `</main>`) with:

```html
      <div class="plate-wrap">
        <main class="plate" id="plate">
          <span class="pin" aria-hidden="true"></span>
          <span class="pin pin-right" aria-hidden="true"></span>
          <div class="views">
            <div
              id="tape"
              class="tape"
              role="table"
              tabindex="0"
              aria-label="Pace ruler from 1:30 to 20:00 minutes per kilometer, with finish times for each race distance. Drag it in any direction, or use the arrow keys."
            >
              <header class="head" id="head" role="row"></header>
            </div>
            <div id="calc" class="calc"></div>
          </div>
          <noscript>
            <p class="fallback">
              The ruler is built in the browser, so it needs JavaScript enabled.
            </p>
          </noscript>
        </main>
        <!-- Outside the plate, which clips its own overflow so the tape's corners
             stay rounded — and would clip a button straddling its edge. Hidden
             until the script that gives it a view to swap to has run. -->
        <button
          id="swap"
          class="swap"
          type="button"
          hidden
          aria-controls="tape calc"
          aria-label="Change to calculator"
          data-tip="Change to calculator"
        >
          <span class="swap-disc">
            <svg class="swap-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <g
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5.03 12.61A7 7 0 0 1 18.76 10.19" />
                <path d="M16.16 8.01 18.76 10.19 19.92 6.99" />
                <path d="M18.97 11.39A7 7 0 0 1 5.24 13.81" />
                <path d="M7.84 15.99 5.24 13.81 4.08 17.01" />
              </g>
            </svg>
          </span>
        </button>
      </div>
```

The two arcs are 170° of a radius-7 circle centred at (12, 12), each with a chevron head, rotationally symmetric about the centre — two arrows chasing each other round.

- [ ] **Step 2: Write the failing tests**

Create `src/mode.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { enableModeToggle } from './mode';

let plate: HTMLElement;
let button: HTMLButtonElement;
let tape: HTMLElement;
let calc: HTMLElement;
let dispose: () => void;

beforeEach(() => {
  document.body.innerHTML = `
    <div class="plate-wrap">
      <main class="plate" id="plate">
        <div class="views">
          <div id="tape" class="tape"><header id="head"></header></div>
          <div id="calc" class="calc"><input id="calc-pace" /></div>
        </div>
      </main>
      <button id="swap" class="swap" type="button" hidden
              aria-label="Change to calculator" data-tip="Change to calculator"></button>
    </div>`;

  plate = document.getElementById('plate')!;
  button = document.getElementById('swap') as HTMLButtonElement;
  tape = document.getElementById('tape')!;
  calc = document.getElementById('calc')!;
  dispose = enableModeToggle({ plate, button, tape, calc });
  return () => dispose();
});

describe('enabling', () => {
  it('reveals the button, which is useless until the script runs', () => {
    expect(button.hidden).toBe(false);
  });

  it('starts on the ruler', () => {
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });
});

describe('toggling', () => {
  it('switches to the calculator', () => {
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(true);
  });

  it('switches back', () => {
    button.click();
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });

  it('says what the next press will do, not what mode it is in', () => {
    expect(button.getAttribute('aria-label')).toBe('Change to calculator');
    button.click();
    expect(button.getAttribute('aria-label')).toBe('Change to ruler');
  });

  it('keeps the tooltip and the label saying the same thing', () => {
    button.click();
    expect(button.dataset.tip).toBe(button.getAttribute('aria-label'));
  });
});

describe('the glyph', () => {
  it('spins half a turn per press', () => {
    button.click();
    expect(button.style.getPropertyValue('--turn')).toBe('180deg');
  });

  it('keeps spinning the same way instead of rewinding', () => {
    button.click();
    button.click();
    button.click();
    expect(button.style.getPropertyValue('--turn')).toBe('540deg');
  });
});

describe('staying fast', () => {
  // The tape is ~2,900 elements. Rebuilding it per switch, or letting
  // display: none throw away its layout boxes, is the one thing here that
  // would actually be slow — so the swap must never touch it structurally.
  it('never replaces the tape', () => {
    const before = document.getElementById('tape');
    for (let i = 0; i < 20; i += 1) button.click();
    expect(document.getElementById('tape')).toBe(before);
  });

  it('leaves what the tape holds alone', () => {
    const head = document.getElementById('head');
    for (let i = 0; i < 20; i += 1) button.click();
    expect(document.getElementById('head')).toBe(head);
    expect(head!.parentElement).toBe(tape);
  });

  it('sets no inline display on either view', () => {
    for (let i = 0; i < 20; i += 1) button.click();
    expect(tape.style.display).toBe('');
    expect(calc.style.display).toBe('');
  });

  it('settles consistently however many times it is pressed', () => {
    for (let i = 0; i < 21; i += 1) button.click();
    expect(plate.classList.contains('calc-mode')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Change to ruler');
  });
});

describe('dispose', () => {
  it('stops toggling', () => {
    dispose();
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run src/mode.test.ts`
Expected: FAIL — cannot resolve `./mode`.

- [ ] **Step 4: Write `src/mode.ts`**

```ts
export interface ModeElements {
  plate: HTMLElement;
  button: HTMLButtonElement;
  tape: HTMLElement;
  calc: HTMLElement;
}

/**
 * The label names the action, not the state. A screen reader user pressing
 * "Change to calculator" should land on the calculator, and the button should
 * then offer the way back.
 */
const LABELS = { ruler: 'Change to calculator', calculator: 'Change to ruler' } as const;

/**
 * Swaps the ruler for the calculator by toggling one class on the plate.
 *
 * All the work is CSS. Nothing here unmounts, rebuilds or re-renders the tape —
 * it's roughly 2,900 elements, and rebuilding it per press is what a swap like
 * this usually gets wrong. Hiding is the stylesheet's job too, with visibility
 * rather than display, so the tape keeps its layout boxes and coming back is a
 * repaint rather than a relayout of all of them.
 *
 * There's no timer and no animation queue, so pressing the button repeatedly
 * just retargets whatever transition is in flight.
 *
 * Returns a disposer that unbinds the listener.
 */
export function enableModeToggle({ plate, button, tape, calc }: ModeElements): () => void {
  let calculator = false;
  // Rotation accumulates rather than alternating between 0 and 180, so the
  // glyph always spins forward and never rewinds.
  let turns = 0;

  function apply(): void {
    plate.classList.toggle('calc-mode', calculator);
    const label = calculator ? LABELS.calculator : LABELS.ruler;
    button.setAttribute('aria-label', label);
    button.dataset.tip = label;
  }

  function onClick(): void {
    calculator = !calculator;
    turns += 1;
    // A custom property rather than a keyframe animation: a transition on the
    // `rotate` this feeds retargets from wherever the glyph currently is, where
    // an animation would snap back to its first frame and restart.
    button.style.setProperty('--turn', `${turns * 180}deg`);
    apply();

    // Only where there's a pointer. On a phone this would throw the keyboard up
    // over the panel the user just asked to see. Same guard main.ts uses for
    // drag-scrolling.
    if (calculator && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      calc.querySelector<HTMLInputElement>('input')?.focus();
    }
  }

  // The tape is named only so the toggle's contract is explicit: it is the view
  // that must survive every switch untouched.
  void tape;

  button.hidden = false;
  apply();
  button.addEventListener('click', onClick);

  return () => button.removeEventListener('click', onClick);
}
```

If `void tape;` reads as noise once written, drop `tape` from `ModeElements` and from the `main.ts` call and the test's `enableModeToggle({ … })` — the swap genuinely doesn't need it. Keep the tests either way.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run src/mode.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire it up in `src/main.ts`**

Add to the imports:

```ts
import { enableCalculator, renderCalculator } from './calc-dom';
import { enableModeToggle } from './mode';
```

Replace the element lookup block (lines 13-16) with:

```ts
const plate = document.getElementById('plate');
const tape = document.getElementById('tape');
const head = document.getElementById('head');
const calc = document.getElementById('calc');
const swap = document.getElementById('swap') as HTMLButtonElement | null;
if (!plate || !tape || !head || !calc || !swap) {
  throw new Error('Missing plate, tape, head, calc, or swap container');
}
```

And after the `enableInfoPanels(head, tape);` line, add:

```ts
calc.append(renderCalculator());
enableCalculator(calc);
enableModeToggle({ plate, button: swap, tape, calc });
```

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `npm test && npm run build`
Expected: PASS, and a clean `tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add index.html src/mode.ts src/mode.test.ts src/main.ts
git commit -m "feat: swap the ruler for the calculator without rebuilding it"
```

---

### Task 4: The button and the panel, styled

**Files:**
- Modify: `src/style.css`
- Test: `src/layout.test.ts`

**Interfaces:**
- Consumes: the `calc-mode` class and the markup from Task 3, the `.field.computed` class from Task 2.
- Produces: nothing other modules read.

- [ ] **Step 1: Write the failing tests for the CSS invariants**

Append to `src/layout.test.ts`:

```ts
/**
 * The swap has one performance rule, and it lives in the stylesheet: the
 * inactive view is hidden with visibility, never display. display: none throws
 * away the tape's layout boxes and forces a relayout of ~2,900 cells every time
 * it comes back, which is exactly the stutter this is meant to avoid.
 */
describe('the view swap', () => {
  it('hides the inactive view with visibility', () => {
    expect(css).toMatch(/\.plate\.calc-mode \.tape[\s\S]{0,200}?visibility:\s*hidden/);
  });

  it('never hides a view with display: none', () => {
    const rules = css.match(/\.(tape|calc|views)[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of rules) expect(rule).not.toMatch(/display:\s*none/);
  });

  it('animates only compositor-friendly properties', () => {
    const transitions = css.match(/transition:[^;]+;/g) ?? [];
    const swap = transitions.filter((line) => /opacity/.test(line));
    expect(swap.length).toBeGreaterThan(0);
    for (const line of swap) {
      expect(line).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\b/);
    }
  });

  it('leaves the tape untransformed, so the fixed info panels stay anchored', () => {
    const tapeRules = css.match(/\.plate[^{]*\.tape[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of tapeRules) expect(rule).not.toMatch(/transform:/);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/layout.test.ts`
Expected: FAIL on the first test — no `.plate.calc-mode .tape` rule yet.

- [ ] **Step 3: Give the plate a wrapper**

In `.plate` (line 115-140), remove `width: min(100%, 480px);` and `flex: 1;` and `min-height: 0;`, replacing them with `width: 100%;` and `height: 100%;`. Add this rule immediately before `.plate`:

```css
/* ---- The plate's wrapper ----
   The plate clips its own overflow so the tape's corners stay rounded, which
   would also clip a button straddling its edge. The toggle hangs off this
   instead, and the wrapper takes the plate's old place in the page's column.

   The toggle's geometry is stated once here: how far its centre sits in from
   the corner, and how big the disc is. */
.plate-wrap {
  position: relative;
  width: min(100%, 480px);
  flex: 1;
  min-height: 0;
  --swap-x: 44px;
  --swap-size: 34px;
}
```

In the 760px media query, change the `.masthead, .footnote, .plate` selector to `.masthead, .footnote, .plate-wrap`, and add to that block:

```css
  .plate-wrap {
    /* Roomier disc, and it moves to the other corner — see .swap. */
    --swap-x: 40px;
    --swap-size: 38px;
  }
```

- [ ] **Step 4: Stack the two views**

Add after the `.fallback` rule (line 218):

```css
/* ---- The two views ----
   One grid cell holds both, so neither can shift the other and swapping costs
   no layout at all. */
.views {
  flex: 1;
  min-height: 0;
  display: grid;
}

.views > * {
  grid-area: 1 / 1;
  min-height: 0;
}

.tape,
.calc {
  /* visibility is delayed to the end of the fade: the view stays paintable
     while it fades, then drops out of hit-testing and the tab order the instant
     it finishes.

     visibility, and never display: none. The tape is ~2,900 elements, and
     display: none destroys its layout boxes, so every return would pay for a
     full relayout of them. visibility keeps the boxes — coming back is a
     repaint. It also means the tape's scroll position survives a round trip for
     free, because nothing is ever unmounted. */
  transition:
    opacity 190ms ease,
    transform 190ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 190ms;
}

.plate.calc-mode .tape,
.plate:not(.calc-mode) .calc {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.plate:not(.calc-mode) .tape,
.plate.calc-mode .calc {
  opacity: 1;
  visibility: visible;
  /* Coming in, visibility flips at once rather than waiting out the fade. */
  transition-delay: 0s;
}

/* Only the calculator moves. The tape can't: it holds the info panels, which
   are position: fixed, and a transformed ancestor would become their containing
   block and throw every one of them off. */
.calc {
  transform: translateY(8px);
}

.plate.calc-mode .calc {
  transform: none;
}

/* The gradient softens the row the plate's bottom edge cuts through. There's no
   such row on a form. */
.plate.calc-mode::after {
  opacity: 0;
}
```

Then remove `flex: 1;` from `.tape` (line 222) — it's a grid item now, and the declaration would only mislead.

- [ ] **Step 5: Style the toggle**

Add after the `.pin-right` rule (line 208):

```css
/* ---- The view toggle ----
   Straddling the plate's top edge, far enough in from the corner to clear the
   safety pin. Top-left on a phone, where the right thumb is nowhere near it;
   top-right from the desktop breakpoint up. */
.swap {
  position: absolute;
  top: calc(var(--swap-size) / -2);
  left: calc(var(--swap-x) - var(--swap-size) / 2);
  width: var(--swap-size);
  height: var(--swap-size);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  /* Over the heading strip and the pins both. */
  z-index: 7;
}

.swap[hidden] {
  display: none;
}

/* The disc is 34 px; a thumb gets 46. */
.swap::before {
  content: '';
  position: absolute;
  inset: -6px;
}

/* The disc is a child rather than the button itself so it can grow on hover
   without dragging the tooltip's text along and blurring it. */
.swap-disc {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--blue);
  color: var(--head-text);
  /* A ring in the page's own colour, so the half of the disc lying over the
     blue heading strip reads as a notch cut into the bib rather than a sticker
     sitting on top of it. */
  box-shadow:
    0 0 0 3px var(--paper),
    var(--shadow);
  transition:
    transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 180ms ease;
}

.swap:hover .swap-disc {
  transform: translateY(-1px) scale(1.08);
  box-shadow:
    0 0 0 3px var(--paper),
    var(--tip-shadow);
}

.swap:active .swap-disc {
  transform: scale(0.92);
}

.swap:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 3px;
  border-radius: 50%;
}

.swap-glyph {
  width: calc(var(--swap-size) * 0.56);
  height: calc(var(--swap-size) * 0.56);
  /* mode.ts adds half a turn per press and never subtracts, so the arrows always
     chase forward. The overshoot is the whole point of the button. */
  rotate: var(--turn, 0deg);
  transition: rotate 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* A nudge on hover — enough to suggest which way it's about to go. */
.swap:hover .swap-glyph {
  rotate: calc(var(--turn, 0deg) + 12deg);
}

/* ---- The toggle's tooltip ----
   A pseudo-element, so it costs no JavaScript and nothing to keep in sync: the
   text comes straight off the attribute mode.ts already sets alongside the
   label. It sits outside the plate's clipping, on the wrapper. */
.swap::after {
  content: attr(data-tip);
  position: absolute;
  top: calc(100% + 9px);
  left: 0;
  padding: 5px 9px;
  border-radius: 7px;
  background: var(--ink);
  color: var(--paper);
  font-family: 'Archivo', system-ui, sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
  opacity: 0;
  scale: 0.94;
  pointer-events: none;
  transition:
    opacity 140ms ease,
    scale 140ms ease;
}

.swap:hover::after,
.swap:focus-visible::after {
  opacity: 1;
  scale: 1;
}

@media (min-width: 760px) {
  .swap {
    left: auto;
    right: calc(var(--swap-x) - var(--swap-size) / 2);
  }

  /* Anchored to the far side, so it opens back towards the page rather than off
     the edge of it. */
  .swap::after {
    left: auto;
    right: 0;
  }
}
```

- [ ] **Step 6: Style the calculator panel**

Add after the `.tip` rules, before the reduced-motion block (line 491):

```css
/* ---- The calculator ---- */
.calc {
  overflow: auto;
  overscroll-behavior: none;
  display: flex;
  flex-direction: column;
}

/* Matches .head .cell's metrics exactly, so the blue strip doesn't jump height
   when the views swap. */
.calc-head {
  padding: 21px 4px 10px;
  background: var(--blue);
  color: var(--head-text);
  font-family: 'Archivo Black', 'Archivo', system-ui, sans-serif;
  font-size: 0.6rem;
  line-height: 1.1;
  letter-spacing: 0.1em;
  text-align: center;
}

.calc-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 18px 16px 22px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-family: 'Archivo Black', 'Archivo', system-ui, sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--minor);
}

.field-controls {
  display: flex;
  gap: 8px;
}

.field-input,
.field-unit {
  padding: 10px 12px;
  border: 1px solid var(--pin-edge);
  border-radius: 10px;
  background: var(--plate);
  color: var(--ink);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.field-input {
  flex: 1;
  /* Without this the input's default intrinsic width stops the row shrinking to
     a narrow phone. */
  min-width: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.field-unit {
  flex: none;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.field-input:focus-visible,
.field-unit:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}

/* The field being solved for. Tinted like the mile column, which is already the
   app's colour for "this one was worked out, not measured". */
.field.computed .field-input {
  border-color: transparent;
  background: var(--mi-tint);
  color: var(--mi-ink);
}

.field.computed .field-label::before {
  content: '= ';
}

.field-note {
  margin: 0;
  min-height: 1.1em;
  color: var(--minor-mi);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 760px) {
  .calc-body {
    /* A form doesn't want to be 1180 px wide. */
    width: min(100%, 420px);
    margin: 0 auto;
    gap: 18px;
    padding: 26px 16px 30px;
  }
}
```

- [ ] **Step 7: Extend the reduced-motion block**

Replace the block at line 491:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }

  /* The swap still happens; it just stops being a performance. Delays go too,
     or the outgoing view would linger for its visibility delay with nothing
     fading. */
  .tape,
  .calc,
  .swap-disc,
  .swap-glyph,
  .swap::after {
    transition-duration: 1ms !important;
    transition-delay: 0s !important;
  }
}
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: PASS, including the four new `layout.test.ts` assertions.

- [ ] **Step 9: Check it in a browser**

Run: `npm run dev`, then look at it at a phone width and a desktop width.

Confirm:
- The disc straddles the plate's top edge, top-left narrow and top-right wide, clear of both pins.
- Hovering grows the disc and tilts the arrows; the tooltip reads "Change to calculator".
- Pressing squishes it, the arrows spin forward with an overshoot, and the calculator fades in.
- Pressing it repeatedly and fast stays smooth — no stutter, no flicker, no drift.
- Coming back to the ruler, the tape is exactly where it was left, scroll position included.
- Typing a pace and a distance fills the time; typing over the time moves the answer to the pace.
- An ultra column's info panel still opens in the right place.

- [ ] **Step 10: Typecheck and commit**

```bash
npm run build
git add src/style.css src/layout.test.ts
git commit -m "feat: style the swap toggle and the calculator panel"
```

---

## Self-Review

**Spec coverage.** Pace ↔ pace conversion: Task 1 (`toSecPerKm`/`fromSecPerKm`) and Task 2 (the unit select and the readout). Three-way solve: Task 1 `solve` and `touch`, Task 2's recency wiring. Distance in m/km/mi: Task 1's unit table, Task 2's select. Toggle button, placement, motion: Tasks 3 and 4. The perf guarantees: Task 3's `staying fast` tests and Task 4's CSS-invariant tests. Focus behaviour, `aria-label`, `aria-controls`: Task 3. Reduced motion: Task 4 Step 7. Every edge case in the spec's table has a test in Task 1 or Task 2.

**One spec correction.** The spec's edge-case table said very long times would use `formatDuration`'s `Dd Hh`. They can't: the time field is an input and must be able to re-read its own value. Task 1 adds `formatClock` for this and the spec has been amended to match.

**Placeholder scan.** No TBDs; every code step carries the code, every test step the tests, every command the exact invocation.

**Type consistency.** `Values`, `Field`, `Recency`, `DistanceUnit`, `PaceUnit` are defined in Task 1 and used under those names in Task 2. `renderCalculator` / `enableCalculator` are named identically in Tasks 2 and 3. `ModeElements` and the `calc-mode` class match between Tasks 3 and 4. Element ids (`plate`, `tape`, `head`, `calc`, `swap`, `calc-pace`, `calc-pace-unit`, `calc-pace-alt`, `calc-distance`, `calc-distance-unit`, `calc-time`) are consistent across the markup, the wiring and the tests. The `--swap-x` / `--swap-size` custom properties are declared in Task 4 Step 3 and consumed in Step 5.
