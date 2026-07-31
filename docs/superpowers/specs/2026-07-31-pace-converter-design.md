# Pace Ruler — v1 Design

**Date:** 2026-07-31
**Status:** Approved pending user review

## Summary

A mobile-first, fully static web app that converts running paces, modeled on the
ELK currency converter's "tape" UX. Every row of the tape is one pace, read
across thirteen columns: **min/km**, **min/mi**, and a finish time for each of
eleven race distances from a 5K to a 300-mile ultra. You pull the tape by hand
to bring the pace range you care about into view, and pan sideways for the
longer races. There is no input field, no convert button, and no selected value
("pure ruler").

## Decisions log

| Decision | Choice |
|---|---|
| Audience | Runners generally (public, self-explanatory) |
| Layout | Thirteen columns; min/km pinned, the rest pan sideways |
| Columns | min/km, min/mi, then 5K, 10K, 15K, half, marathon, 50K, 100K, Tahoe 200, Moab 240, Bigfoot 200, Arizona 300 |
| Interaction model | Pure ruler (ELK style) — no center-line selection, no typing |
| Gesture | Grab the tape and pull in any direction; no visible scrollbar |
| Unit switching | None. Considered click-to-toggle km/mi and dropped it: a race time is a fact about the distance, so a toggle would only relabel distances |
| Tape range | 2:00 → 100:00 min/km, hard stops at both ends |
| Tape steps | Uniform 5 s steps (~1,177 rows); 10 s rows styled "major", 5 s rows "minor" |
| Stack | Vite + vanilla TypeScript (chosen over Angular for load performance) |
| Backend | None — all computation client-side |
| Deployment | Docker: multi-stage build, nginx:alpine serving static `dist/` |
| Telemetry | None in v1 |

## Architecture

Static client-side app. No framework, no routing, no network calls, no persisted
state. Vite builds a single small bundle (~5–10 kB gz); nginx serves it.

```
src/
  pace.ts     — domain: conversion + duration formatting (pure functions)
  races.ts    — the race registry: distances, and info for the ultras
  tape.ts     — row data: range config × races → rows (pure)
  tape-dom.ts — rendering rows and headings, plus centering arithmetic
  drag.ts     — grab-and-pull gesture: fling physics + pointer binding
  tooltip.ts  — info panels: placement arithmetic + open/close behaviour
  main.ts     — bootstrap: build the tape, centre it, bind the gesture and panels
  style.css   — mobile-first layout, ruler styling, dark/light
index.html
```

### Domain model (`pace.ts`)

- Canonical unit: **integer seconds per kilometer** (`secPerKm`).
- Conversion: `secPerMi = round(secPerKm × 1.609344)` (nearest integer second).
- Pace formatting: `m:ss` with unpadded minutes (`8:03`, `96:33`, `160:56`). No
  hours unit — pace is conventionally read in minutes even when large.
- Finish-time formatting scales to the distance: `m:ss` under an hour, `h:mm:ss`
  under a day, `Dd Hh` beyond — which is how a 200-miler's time is quoted anyway.
  The slowest row on the longest course reads `33d 14h`.
- All functions are pure and independently testable.

### Races (`races.ts`)

Eleven distances, canonical in km. The standard ones are exact by definition
(the half and full marathon are the World Athletics figures).

The four ultras — Tahoe 200, Moab 240, Bigfoot 200 and Arizona Monster 300 — are
Destination Trail events, and their real courses are both longer than their names
suggest and **rerouted between editions**. The organizer publishes more than one
figure for some of them, so each km value converts the mileage printed on the
exact page its info panel links to: anyone who follows the link sees the same
number, which would not be true of the per-edition pages. The mileage is recorded
beside each entry in `races.ts`, and the panel states that the course varies
rather than implying a fixed distance. Worth re-checking before each season.

### Tape (`tape.ts`)

- Row data derived from a range config: `{ minSecPerKm: 120, maxSecPerKm: 6000, stepSec: 5 }`
  → 1,177 rows. Config is a constant but kept as an explicit parameter so range
  or step changes are one-line edits.
- All rows are rendered eagerly into one native scroll container. No virtual
  scrolling: ~1,200 rows × 13 text cells is well within mobile rendering budgets,
  and native scroll gives momentum/feel for free.
- Each row is a flex row of fixed-width cells — `(min/km, min/mi, …races)`. Every
  row and the heading share the same widths, so columns line up with no scroll
  syncing anywhere. This "row as tuple" shape is what made the race columns a
  data change rather than a layout rewrite.
- Rows where `secPerKm % 10 === 0` are **major** (full size/opacity); the 5 s
  in-between rows are **minor** (smaller, dimmed).

### Columns (`tape-dom.ts` + CSS)

Thirteen columns don't fit a phone, so the tape scrolls on both axes inside one
container and stickiness does the rest — no second scroller, no synchronisation:

- `min/km` is `position: sticky; left: 0`, so the pace you're reading stays put
  while the race columns pan past it. It grows a hairline right edge only once
  something is hidden behind it.
- The heading strip is `position: sticky; top: 0` *inside* the scroller, so it
  pans horizontally with the columns while staying fixed vertically. Centering
  therefore takes the strip's height as a top inset.
- Race columns alternate a barely-there tint so the eye can track one row across
  thirteen of them.
- At rest the view shows min/km beside min/mi — exactly the two-column app that
  came before — and the races are a swipe away.

### Info panels (`tooltip.ts`)

Each ultra's heading carries a small circled `i` beside its distance, inline
rather than absolutely positioned so it cannot collide with the safety pins.

- The panel gives the organizer's event name, a one-line description, the
  distance with its by-edition caveat, and a link to the official page.
- It is `position: fixed`, which is what keeps the tape's `overflow` from
  clipping it, and placed by pure arithmetic: centred under the button, nudged
  back inside the viewport, flipped above when there's no room below.
- It is a **disclosure, not a dialog**: `aria-expanded` plus `aria-controls` on
  the button, and focus stays put. An earlier `role="dialog"` was wrong, since
  nothing moved focus into it.
- One panel at a time. It closes on Escape (returning focus to its button), on a
  press anywhere else, on resize, and when the tape moves under it — it is
  anchored to a point on screen, not to the column.
- Buttons, links **and the panels themselves** are excluded from the drag
  gesture: suppressing the pointer default would rob controls of focus, and
  pressing a panel to read it would otherwise pan the tape and dismiss it.
- The `i` is upright, not italic: slanted at 9 px it read as a diagonal line
  through the circle rather than a letter.
- The circle is 16 px but its hit area is 28 × 30 px, extended leftward across
  the distance label — anything spilling rightward is painted over by the next
  column.

The tape carries table semantics (`role="table"`, with the pace cell as each
row's `rowheader`). Thirteen unlabelled columns of numbers were navigable enough
at two columns and are not at thirteen.

### Gesture (`drag.ts`)

The tape is moved by grabbing it, never by a scrollbar — the scrollbar is
hidden and the cursor is `grab`/`grabbing`.

- **Touch is left to the browser.** Native panning already *is* this gesture and
  does it better: OS-matched momentum and rubber-banding at the ends.
- **Mouse and pen** get the same feel from a pointer binding: press records the
  scroll offset, movement re-derives it from the total distance pulled, and
  release hands the tracked velocity to a friction-decayed coast.
- Release velocity comes from the samples of the last 100 ms, so a drag that
  came to rest doesn't fling; it is capped at 4 px/ms because coalesced pointer
  events can arrive a fraction of a millisecond apart.
- A coast is abandoned as soon as the tape is grabbed, scrolled, or keyed again.
- The physics are pure functions; only a thin binding touches the DOM.

### Shell (`main.ts` + `index.html`)

- The heading strip sits inside the scroller and sticks to its top, so it pans
  with the columns but never scrolls away vertically.
- On load, scroll so **5:00 min/km** is vertically centered below that strip.
- Tabular numerals (`font-variant-numeric: tabular-nums`) so the tape doesn't
  shimmy while scrolling.

## UI / visual

UI/UX quality is the headline requirement: intuitive, beautiful, professional,
with a "running" identity.

**Visual direction: "Race Bib" (approved via mockups).** The app reads as a race
bib: a white plate with heavy black tabular numerals, a race-organizer blue
header strip, and safety-pin dots at the plate's top corners.

- Palette: bib blue `#1749C8`, plate white `#FFFFFF`, ink `#101010`,
  background paper `#F5F4F1`, mile tint `#EDF2FD`, mile ink `#17307A`,
  minor gray `#73736E`, minor mile blue `#4A5F94`, race-column tint `#FAF9F6`,
  pinned edge `rgba(16,16,16,.14)`, link `#1749C8` (`#A7BCF0` in dark).
  All AA-checked in both themes, including minor gray on the race tint (4.53:1)
  and the panel link on the dark plate (9.37:1). `--blue` is a *background*
  token and fails as body text on the dark plate, which is why links carry their
  own `--link`.
- Type: Archivo Black (header/display), Archivo (numerals + UI), tabular
  figures throughout (`font-variant-numeric: tabular-nums`) so the tape doesn't
  shimmy while scrolling. Fonts self-hosted (no CDN request on load).
- Columns as tape, no divider: the km column is white, the mile column carries
  the faint blue tint with deep-blue numerals — the shade change is both the
  separation and the "which unit am I reading" cue.
- Softness: no hard outer border — soft shadow, rounded plate corners, pins at
  the top corners only. The tape scrolls edge-to-edge under the heading strip,
  whose top padding is what keeps the pins clear of the narrow `MIN / KM` label.
- Mobile-first: full-viewport plate; desktop constrains to a centered
  max-width of 720 px — wider than the two-column version's 480 px, because
  there are now thirteen columns worth showing.
- Dark variant via `prefers-color-scheme` derived from the same palette
  (paper → near-black, plate → dark ink surface, tint/blue adjusted for
  contrast); no manual toggle in v1. All text meets WCAG AA contrast in both.
- Visual references (approved mockups):
  `.superpowers/brainstorm/3909-1785493882/content/two-column-v3.html` (layout, option A)
  and `visual-direction-v2.html` (identity, option B).

## Error handling

There are no user inputs and no I/O, so no runtime error paths. Correctness
concentrates in the domain math:

- Rounding happens once, on the converted integer seconds — formatting integer
  seconds to `m:ss` can never produce `:60`.
- Range endpoints (2:00 and 100:00) must appear as exact rows.

## Testing

Vitest, colocated unit tests:

- `pace.ts`: conversion known-values (5:00/km → 8:03/mi), rounding behavior,
  formatting edges (`0:0x` seconds padding, large minutes like `160:56`).
- `races.ts`: the standard distances, unique ids, ultras carrying their info and
  organizer links, and each ultra's km matching its recorded mileage — a guard
  against a conversion slip, not a check that the mileage is current, which only
  the organizer's page can settle.
- `tape.ts`: row count for the configured range, first/last row values, step
  spacing, major/minor classification, and a finish time per race per row.
- `tape-dom.ts` (happy-dom): row and heading markup, info buttons only on the
  ultras, panels built closed with their links, and the centering arithmetic
  including the heading inset.
- `drag.ts`: release velocity from samples — direction, both axes, window, rest,
  the coalesced-event cap — and friction decay, as pure functions; then the
  pointer binding under happy-dom, including the coast, driven by an injected
  clock because a headless browser's virtual clock never services
  `requestAnimationFrame`.
- `tooltip.ts`: placement arithmetic (centring, both edge clamps, the flip
  above, the wider-than-screen fallback) as pure functions, and open/close
  behaviour under happy-dom.

No e2e tests. Anything that depends on real layout is verified by hand in a real
browser before release, because happy-dom has no layout engine and so no test
here can reach it: that 5:00 lands centered once fonts have swapped in, that a
pull moves the tape the distance the pointer travelled, that the pinned column
and heading actually stick, and that an info panel lands on screen at a phone
width without being clipped by the tape's overflow.

## Still out of scope (explicit)

Race-distance columns were the P_i "members of a pace" concept from the project
note, and they have now landed. What remains:

- Speed columns (km/h, mph) for treadmill runners.
- User-chosen custom distances, and a column picker to add, remove, or reorder
  columns. The ultras are currently ordered as requested rather than by course
  length, which a picker would make moot.
- Center-line selection and tap-to-type an exact pace.
- Click-to-toggle km/mi units — considered and dropped; see the decisions log.
- Telemetry, PWA/offline, persistence of scroll position.

All of these layer onto the row-as-tuple model without reworking what exists.
