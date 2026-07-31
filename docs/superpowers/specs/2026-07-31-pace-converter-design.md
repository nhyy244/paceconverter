# Pace Ruler — v1 Design

**Date:** 2026-07-31
**Status:** Approved pending user review

## Summary

A mobile-first, fully static web app that converts running paces, modeled on the
ELK currency converter's "tape" UX. v1 shows exactly two columns — **min/km** and
**min/mi** — as one continuous vertical ruler: every visible row is a valid
conversion pair, and scrolling brings the pace range you care about into view.
There is no input field, no convert button, and no selected value ("pure ruler").

## Decisions log

| Decision | Choice |
|---|---|
| Audience | Runners generally (public, self-explanatory) |
| Layout | Two columns side by side, synced vertical scroll |
| Interaction model | Pure ruler (ELK style) — no center-line selection, no typing |
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
  pace.ts    — domain: conversion + formatting (pure functions)
  tape.ts    — tape generation: range config → row data → DOM
  main.ts    — bootstrap: build tape, set initial scroll position
  style.css  — mobile-first layout, ruler styling, dark/light
index.html
```

### Domain model (`pace.ts`)

- Canonical unit: **integer seconds per kilometer** (`secPerKm`).
- Conversion: `secPerMi = round(secPerKm × 1.609344)` (nearest integer second).
- Formatting: `m:ss` with unpadded minutes (`8:03`, `96:33`, `160:56`). No hours
  unit — pace is conventionally read in minutes even when large.
- Both functions are pure and independently testable.

### Tape (`tape.ts`)

- Row data derived from a range config: `{ minSecPerKm: 120, maxSecPerKm: 6000, stepSec: 5 }`
  → 1,177 rows. Config is a constant but kept as an explicit parameter so range
  or step changes are one-line edits.
- All rows are rendered eagerly into one native scroll container. No virtual
  scrolling: ~1,200 rows × 2 text cells is well within mobile rendering budgets,
  and native scroll gives momentum/feel for free.
- Each row is a CSS-grid pair `(min/km, min/mi)` — column sync is structural,
  not scripted. This "row as tuple" shape is the extension point for future
  columns.
- Rows where `secPerKm % 10 === 0` are **major** (full size/opacity); the 5 s
  in-between rows are **minor** (smaller, dimmed).

### Shell (`main.ts` + `index.html`)

- Sticky header with column labels `MIN/KM | MIN/MI`.
- On load, scroll so **5:00 min/km** is vertically centered.
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
  minor gray `#9C9C98`.
- Type: Archivo Black (header/display), Archivo (numerals + UI), tabular
  figures throughout (`font-variant-numeric: tabular-nums`) so the tape doesn't
  shimmy while scrolling. Fonts self-hosted (no CDN request on load).
- Columns as tape, no divider: the km column is white, the mile column carries
  the faint blue tint with deep-blue numerals — the shade change is both the
  separation and the "which unit am I reading" cue.
- Softness: no hard outer border — soft shadow, rounded plate corners, pins at
  the top corners only. The tape scrolls edge-to-edge under the sticky header.
- Mobile-first: full-viewport plate; desktop constrains to a centered
  max-width (~480 px).
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
- `tape.ts`: row count for the configured range, first/last row values, step
  spacing, major/minor classification.

No e2e tests in v1 — the DOM layer is a thin, deterministic render of tested data.

## Out of scope for v1 (explicit)

- Additional columns: speeds (km/h, mph), race times (5K/10K/half/marathon),
  custom distances — the P_i "members of a pace" concept from the project note.
- Column picker (add/remove/reorder), horizontal column swiping.
- Center-line selection and tap-to-type exact pace.
- Telemetry, PWA/offline, persistence of scroll position.

All of these layer onto the row-as-tuple model without reworking v1.
