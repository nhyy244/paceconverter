# Pace calculator — design

A second view on the bib: a three-field calculator that converts between min/km
and min/mi and solves pace, distance and time against each other. Reached by a
button on the plate's corner that swaps the ruler for the calculator and back.

## Why

The ruler answers "what does 5:30/km look like" by letting you read across a row.
It can't answer "I ran 21.0975 km in 1:56:04 — what pace was that?", and it can't
take a distance that isn't one of the eleven races. The calculator covers both
without changing what the ruler is.

## Scope

In:

- Pace ↔ pace conversion (min/km ↔ min/mi), both directions.
- Solve any one of pace, distance, time from the other two.
- Distance entered in m, km or mi.
- A toggle button that swaps the two views, with motion that survives being
  mashed.

Out:

- Split tables, negative splits, elevation grade, heart rate.
- Persisting calculator state across reloads.
- Quick-fill chips for standard distances (considered, cut).

## Modules

Follows the existing split: a DOM-free module holding the arithmetic, a `-dom`
module that builds and wires its panel, and a behaviour module for the swap.

| File | Responsibility | Depends on |
| --- | --- | --- |
| `src/calc.ts` | Units, parsing, formatting, the solver. No DOM. | `pace.ts` |
| `src/calc-dom.ts` | Builds the calculator panel; wires its inputs to the solver. | `calc.ts` |
| `src/mode.ts` | Swaps the two views; owns the button's label and state. | — |
| `index.html` | `.plate-wrap`, the toggle button, an empty `#calc`. | — |
| `src/style.css` | Button, tooltip, panel, transition. | — |

`calc.ts` stays DOM-free for the same reason `pace.ts` does: the arithmetic is
the part worth testing exhaustively, and it tests faster without a DOM.

## `calc.ts` — the arithmetic

### Units

```ts
export type DistanceUnit = 'm' | 'km' | 'mi';
export type PaceUnit = 'km' | 'mi';
```

Kilometres are canonical, as everywhere else in the app; `KM_PER_MI` comes from
`pace.ts` so there is still exactly one conversion constant.

### Parsing

Each parser returns `null` rather than throwing — an empty or half-typed field is
the normal state of a form, not an error.

- `parsePaceInput(text)` → seconds. Accepts `m:ss` and bare minutes (`5` → 5:00).
  Rejects seconds ≥ 60, negatives, and anything with a stray character.
- `parseDurationInput(text)` → seconds. One part is minutes, two is `m:ss`,
  three is `h:mm:ss`. Same rejections.
- `parseDistanceInput(text)` → a number in the field's unit. Accepts `.` or `,`
  as the decimal separator, since a decimal comma is what half of Europe types.

**Typing a pace without a colon** (added 2026-08-01, after the first version
shipped). `inputmode="decimal"` gets a phone to show its numeric keypad — which
has no colon key, making `5:30` untypeable on a phone. The colon is not
negotiable as the *display* form, so the parsers widen instead:

- The decimal separator stands in for a colon in the pace and time fields:
  `5.30` and `5,30` both read as 5:30. There is nothing for a decimal point to
  mean in `m:ss`, so this is unambiguous. The distance field is the other way
  round and still reads `.` and `,` as a decimal point.
- Three or more bare digits group from the right, which is how a keypad gets
  used: `530` → 5:30, `15602` → 1:56:02. One or two digits stay whole minutes,
  so `45` remains a 45-minute 10K rather than becoming 45 seconds.
- On `focusout` the field is rewritten in canonical form, so `530` visibly
  becomes `5:30`. That keeps the panel consistent with the tape and teaches the
  shorthand without a line of help text. Rewriting happens on the way out, never
  mid-word, where it would fight the cursor. Unreadable text is left as typed.

### The solver

```ts
export type Field = 'pace' | 'distance' | 'time';

/** All three in canonical units: seconds per km, kilometres, seconds. */
export interface Values {
  pace: number | null;
  distance: number | null;
  time: number | null;
}

/** Returns `values` with `computed` filled in from the other two. */
export function solve(values: Values, computed: Field): Values;
```

- `time = secPerKm × km`
- `secPerKm = seconds / km` — only when `km > 0`
- `km = seconds / secPerKm` — only when `secPerKm > 0`

A guard that fails yields `null` for the computed field. The other two pass
through untouched, so a bad distance never corrupts the pace you typed.

### Which field is computed

The panel keeps a recency list of the three fields, most-recently-edited first.
Editing a field moves it to the front; the field at the back is the computed one.
Two inputs and one output, always, and the output is always the one you touched
longest ago — so it can never get stuck where you don't want it.

## `calc-dom.ts` — the panel

```
PACE       [ 5:30      ] [min/km ▾]   = 8:51 /mi
DISTANCE   [ 21.0975   ] [km ▾]
= TIME     [ 1:56:04   ]
```

- All three fields are `<input>` and always editable. The computed one is not
  read-only; typing into it just makes it an input and demotes another field.
- The computed field carries the `--mi-tint` background and an `=` on its label,
  so which way the arithmetic is flowing is visible without reading the numbers.
- The pace row's readout shows whichever pace unit is *not* selected, recomputed
  live. This is the min/km → min/mi conversion, and it works in both directions.
- Changing a unit converts the value in the field rather than reinterpreting it:
  switching 5:30 min/km to min/mi shows 8:51, it does not show 5:30 min/mi.
- Inputs are `inputmode="decimal"` so phones offer a numeric keypad.
- Unparseable input blanks the computed field. Never `NaN`, never a thrown error.

Structure and wiring live in one module because the panel is self-contained —
unlike the info tooltip, whose behaviour spans the header and the tape.

## `mode.ts` — the swap

State is a single class on `.plate`. There are no timers, no animation queue and
no JS-driven frames.

### Keeping it fast

The tape is roughly 2,900 elements. The requirement is that repeated switching
never degrades, so:

- The tape is built once at startup and **never unmounted, never re-rendered and
  never `display:none`d**. Rebuilding it per toggle is the one thing here that
  would actually be slow.
- Hiding uses `visibility: hidden` behind a delayed transition
  (`transition: opacity 200ms, visibility 0s 200ms`). The element keeps its
  layout boxes, so returning is a repaint, not a relayout of 2,900 cells.
  `display: none` would destroy those boxes and force the relayout on every
  return.
- The two views sit in a 1 × 1 CSS grid, both at `grid-area: 1 / 1`. Neither can
  shift the other, and both are sized identically without absolute positioning
  (which would interfere with the tape's sticky header and sticky first column).
- Only `opacity` and `transform` animate, so the swap stays on the compositor and
  costs no layout or paint per frame.
- No `will-change`: an opacity transition promotes its own layer for the duration,
  and a permanent `will-change` would pin a large layer in memory for nothing.
- Because state is one class and the motion is CSS transitions, mashing the
  button retargets the in-flight transition from its current computed value.
  Nothing queues, nothing restarts.

`visibility: hidden` also removes the hidden view from the tab order and from
hit-testing, so the calculator's inputs aren't focusable behind the tape and the
tape isn't scrollable behind the calculator.

The tape's scroll position survives a round trip for free, since it is never
unmounted.

### Focus

Switching to the calculator focuses the pace input, but only where
`(hover: hover) and (pointer: fine)` matches — the same guard `main.ts` already
uses for drag-scrolling. On a phone, auto-focus would throw up the keyboard over
the panel the user just asked to see.

Switching back leaves focus on the button.

### Accessibility

- `aria-label` on the button states the action and swaps with the mode:
  "Change to calculator" / "Change to ruler". Not `aria-pressed`, which would
  describe a stuck state rather than a mode change.
- `aria-controls` points at the plate's view container.
- The tooltip is decorative and `aria-hidden`; the label carries the same text.

## The button

### Placement

The plate sets `overflow: hidden`, which would clip anything straddling its
edge, so the plate gains a `.plate-wrap` parent that is not clipped. The wrapper
takes the `flex: 1; min-height: 0` the plate holds today; the plate fills it.

The button straddles the plate's top edge, centred 40 px in from the corner —
far enough that it clears the safety pin at 12 px, so both pins stay. Top-right
from the 760 px breakpoint up, top-left below it, which is the same breakpoint
the rest of the desktop layout already turns on.

38 px on desktop, 34 px on phones, where the corner is tighter.

### Look

A `--blue` disc with a white glyph and a 3 px ring in `--paper`, so the half of
the disc that overlaps the blue heading strip reads as a notch cut into the bib
rather than a sticker sitting on it.

The glyph is the two-arrow swap redrawn as a circular chase: two arcs of about
140° with round caps and chevron heads, rotationally symmetric about the centre.
Rounder and friendlier than a square-cornered S.

### Motion

- Hover: lifts 1 px, scales to 1.08, shadow deepens, glyph tilts about 12°.
- Press: scales to 0.92.
- Click: rotation accumulates +180° with `cubic-bezier(0.34, 1.56, 0.64, 1)`, so
  it overshoots and settles. Accumulating rather than alternating means it always
  spins forward and never rewinds — which is what makes it worth pressing twice.
- `prefers-reduced-motion: reduce` drops every transition to instant, matching the
  rule already in `style.css`.

The rotation is a CSS transition on the `rotate` property, with `mode.ts` setting
`button.style.rotate` from a counter it increments per press — not a keyframe
animation. A keyframe animation restarts from zero when re-triggered mid-flight;
a transition retargets from wherever the glyph currently is.

## Errors and edge cases

| Case | Behaviour |
| --- | --- |
| Empty field | Computed field blanks. No error text. |
| `7:75` | Rejected; computed field blanks. |
| Distance `0` while solving for pace | Blanks — a zero-distance pace is undefined. |
| Pace `0:00` while solving for distance | Blanks, same reason. |
| Very long time (300 mi at 20:00/km) | `161:12:00` — hours keep counting past a day. `formatClock` in `pace.ts` is now the only finish-time format, shared with the tape, so a time read off the ruler can be typed straight back into this field. |
| Unit changed with an unparseable value | Value is left exactly as typed rather than blanked. |

## Testing

| File | Covers |
| --- | --- |
| `calc.test.ts` | Every parser including rejections and decimal commas; unit conversion round trips; all three solve directions; the divide-by-zero guards. |
| `calc-dom.test.ts` | Pace + distance fills time; editing time demotes the stale field; the unit selector converts rather than reinterprets; the min/mi readout tracks the pace field; junk input blanks without throwing. |
| `mode.test.ts` | The class flips; label and tooltip swap; **the tape's element identity is stable across repeated toggles**, which is the perf guarantee stated as an assertion; rapid toggling settles in a consistent state. |

happy-dom, as the existing DOM tests use.

## Out of scope, deliberately

- Persisting the last calculation. It's a scratch tool.
- A URL for a given calculation. Worth considering later; it needs a decision
  about which field is computed, which the recency list doesn't serialise well.
- Quick-fill distance chips from `RACES`. Proposed and cut — the ruler is already
  the answer for standard distances.
