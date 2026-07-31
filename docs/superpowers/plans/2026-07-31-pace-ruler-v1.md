# Pace Ruler v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first static web app showing running pace conversions (min/km ↔ min/mi) as a scrollable two-column "pure ruler" tape, styled as a race bib.

**Architecture:** Fully client-side. Pure domain functions (`pace.ts`) feed a tape generator (`tape.ts`) that eagerly renders ~1,177 rows into one native scroll container; each row is a CSS-grid pair, so column sync is structural. `main.ts` wires it up and centers the view on 5:00 min/km. Built with Vite, served by nginx in Docker.

**Tech Stack:** Vite (vanilla TypeScript template), Vitest + happy-dom for tests, @fontsource self-hosted fonts, nginx:alpine Docker image. No framework, no backend, no runtime dependencies beyond fonts.

**Spec:** `docs/superpowers/specs/2026-07-31-pace-converter-design.md` — read it before starting.

## Global Constraints

- Tape range: `MIN_SEC_PER_KM = 120` (2:00/km) to `MAX_SEC_PER_KM = 6000` (100:00/km), `STEP_SEC = 5` → exactly 1,177 rows; both endpoints must appear as exact rows.
- Conversion factor: `KM_PER_MI = 1.609344`; convert then round to nearest integer second — rounding happens exactly once, in the conversion.
- Pace format: `m:ss`, unpadded minutes, zero-padded seconds (`8:03`, `100:00`, `160:56`). Never hours.
- Palette (light): bib blue `#1749C8`, plate white `#FFFFFF`, ink `#101010`, paper `#F5F4F1`, mile tint `#EDF2FD`, mile ink `#17307A`, minor `#73736E`, minor-mile `#4A5F94`.
- Palette (dark): blue `#2F5BD6`, plate `#17181C`, ink `#F0F0ED`, paper `#0C0D0F`, mile tint `#151B2A`, mile ink `#A7BCF0`, minor `#8F8F89`, minor-mile `#8CA3DE`.
- All text must meet WCAG AA contrast (≥ 4.5:1) in both schemes. The palette above is pre-checked — do not lighten the minor grays.
- Typography: Archivo Black (header), Archivo (numerals/UI), `font-variant-numeric: tabular-nums` everywhere. Fonts self-hosted via @fontsource — **no CDN/external requests at runtime**.
- No divider line between columns — separation comes from the mile column's tint.
- Mobile-first; desktop constrains the plate to a centered 480 px max width.
- Commit after every task with the message given in the task. All commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts` (stub), `src/style.css` (stub), `.gitignore` (already exists — verify, don't overwrite)

**Interfaces:**
- Consumes: nothing.
- Produces: a building Vite project; `index.html` DOM contract for later tasks: `<div id="tape" class="tape">` inside `<main class="plate">` under `<header class="head">`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "pace-ruler",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fontsource/archivo": "^5.2.5",
    "@fontsource/archivo-black": "^5.2.5"
  },
  "devDependencies": {
    "happy-dom": "^18.0.1",
    "typescript": "^5.9.2",
    "vite": "^7.0.0",
    "vitest": "^3.2.4"
  }
}
```

If `npm install` reports a newer major of vite/vitest as unavailable-compatible, keep the majors pinned here — do not upgrade majors mid-plan.

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // DOM environment is opted into per test file via @vitest-environment docblocks.
  },
});
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1749C8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#2F5BD6" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="Running pace converter — min/km and min/mi side by side, like a ruler." />
    <title>Pace Ruler — min/km ↔ min/mi</title>
  </head>
  <body>
    <main class="plate">
      <span class="pin" aria-hidden="true"></span>
      <span class="pin pin-right" aria-hidden="true"></span>
      <header class="head">
        <span>MIN / KM</span>
        <span>MIN / MI</span>
      </header>
      <div
        id="tape"
        class="tape"
        tabindex="0"
        aria-label="Pace conversion ruler from 2:00 to 100:00 minutes per kilometer. Scroll to browse."
      ></div>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write stubs**

`src/main.ts`:

```ts
import './style.css';
```

`src/style.css`:

```css
/* Race Bib styling arrives in Task 6. */
```

- [ ] **Step 6: Install and verify the build**

Run: `npm install && npm run build`
Expected: `vite build` completes, `dist/index.html` exists. (`npm test` would report "No test files found" — that's expected until Task 2.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/
git commit -m "chore: scaffold Vite + TypeScript project

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Domain module — conversion and formatting

**Files:**
- Create: `src/pace.ts`
- Test: `src/pace.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact, later tasks import these):
  - `KM_PER_MI: number` (= 1.609344), `MIN_SEC_PER_KM: number` (= 120), `MAX_SEC_PER_KM: number` (= 6000), `STEP_SEC: number` (= 5)
  - `kmToMiSeconds(secPerKm: number): number` — integer seconds per mile, nearest-second rounding
  - `formatPace(totalSeconds: number): string` — `m:ss`, unpadded minutes

- [ ] **Step 1: Write the failing tests**

`src/pace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { kmToMiSeconds, formatPace } from './pace';

describe('kmToMiSeconds', () => {
  it('converts 5:00/km (300 s) to 8:03/mi (483 s)', () => {
    expect(kmToMiSeconds(300)).toBe(483); // 300 × 1.609344 = 482.8032
  });

  it('rounds down when the fraction is below .5', () => {
    expect(kmToMiSeconds(125)).toBe(201); // 125 × 1.609344 = 201.168
  });

  it('rounds up when the fraction is .5 or above', () => {
    expect(kmToMiSeconds(205)).toBe(330); // 205 × 1.609344 = 329.91552
  });

  it('converts both tape endpoints', () => {
    expect(kmToMiSeconds(120)).toBe(193); // 193.12128
    expect(kmToMiSeconds(6000)).toBe(9656); // 9656.064
  });
});

describe('formatPace', () => {
  it('pads seconds to two digits', () => {
    expect(formatPace(483)).toBe('8:03');
    expect(formatPace(305)).toBe('5:05');
  });

  it('formats exact minutes', () => {
    expect(formatPace(120)).toBe('2:00');
  });

  it('keeps large values in minutes — never hours', () => {
    expect(formatPace(6000)).toBe('100:00');
    expect(formatPace(9656)).toBe('160:56');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./pace`.

- [ ] **Step 3: Write the implementation**

`src/pace.ts`:

```ts
/** Kilometers per mile — the single conversion constant. */
export const KM_PER_MI = 1.609344;

/** Tape range: 2:00 min/km … 100:00 min/km in 5 s steps. */
export const MIN_SEC_PER_KM = 120;
export const MAX_SEC_PER_KM = 6000;
export const STEP_SEC = 5;

/**
 * Convert a pace in seconds-per-km to seconds-per-mile.
 * Rounds to the nearest integer second — the only rounding in the app.
 */
export function kmToMiSeconds(secPerKm: number): number {
  return Math.round(secPerKm * KM_PER_MI);
}

/** Format integer seconds as m:ss with unpadded minutes: 483 → "8:03". */
export function formatPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pace.ts src/pace.test.ts
git commit -m "feat: add pace conversion and formatting domain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Tape row data

**Files:**
- Create: `src/tape.ts`
- Test: `src/tape.test.ts`

**Interfaces:**
- Consumes: `kmToMiSeconds`, `formatPace`, `MIN_SEC_PER_KM`, `MAX_SEC_PER_KM`, `STEP_SEC` from `./pace`.
- Produces (exact):
  - `interface TapeConfig { minSecPerKm: number; maxSecPerKm: number; stepSec: number }`
  - `DEFAULT_CONFIG: TapeConfig`
  - `interface TapeRow { secPerKm: number; kmLabel: string; miLabel: string; major: boolean }`
  - `buildRows(config?: TapeConfig): TapeRow[]`

- [ ] **Step 1: Write the failing tests**

`src/tape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG } from './tape';

describe('buildRows', () => {
  const rows = buildRows(DEFAULT_CONFIG);

  it('creates one row per 5 s step from 2:00 to 100:00 min/km', () => {
    expect(rows).toHaveLength(1177); // (6000 - 120) / 5 + 1
  });

  it('starts and ends exactly on the range endpoints', () => {
    expect(rows[0]).toEqual({
      secPerKm: 120,
      kmLabel: '2:00',
      miLabel: '3:13',
      major: true,
    });
    expect(rows.at(-1)).toEqual({
      secPerKm: 6000,
      kmLabel: '100:00',
      miLabel: '160:56',
      major: true,
    });
  });

  it('steps by 5 seconds', () => {
    expect(rows[1].secPerKm).toBe(125);
    expect(rows[2].secPerKm).toBe(130);
  });

  it('marks 10 s rows major and 5 s rows minor', () => {
    expect(rows[0].major).toBe(true); // 120
    expect(rows[1].major).toBe(false); // 125
    expect(rows[2].major).toBe(true); // 130
  });

  it('derives mile labels through the domain conversion', () => {
    const row500 = rows.find((r) => r.secPerKm === 300);
    expect(row500?.kmLabel).toBe('5:00');
    expect(row500?.miLabel).toBe('8:03');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./tape`. (Task 2's tests still PASS.)

- [ ] **Step 3: Write the implementation**

`src/tape.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/tape.ts src/tape.test.ts
git commit -m "feat: generate tape row data from range config

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Tape DOM rendering and scroll math

**Files:**
- Modify: `src/tape.ts` (append two functions)
- Create: `src/tape-dom.test.ts`

**Interfaces:**
- Consumes: `TapeRow` from Task 3.
- Produces (exact):
  - `renderTape(rows: TapeRow[]): DocumentFragment` — one `div.row.major|minor` per row with `data-sec-per-km`, containing `span.cell.km` and `span.cell.mi`
  - `initialScrollTop(rowOffsetTop: number, rowHeight: number, viewportHeight: number): number`

- [ ] **Step 1: Write the failing tests**

`src/tape-dom.test.ts` (separate file so only DOM tests pay for the DOM environment):

```ts
/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { buildRows, DEFAULT_CONFIG, renderTape, initialScrollTop } from './tape';

describe('renderTape', () => {
  it('renders a two-cell grid row per tape row', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG).slice(0, 3));
    const rows = Array.from(frag.children) as HTMLElement[];

    expect(rows).toHaveLength(3);
    expect(rows[0].className).toBe('row major'); // 120 s
    expect(rows[1].className).toBe('row minor'); // 125 s
    expect(rows[0].dataset.secPerKm).toBe('120');

    const [km, mi] = Array.from(rows[0].children) as HTMLElement[];
    expect(km.className).toBe('cell km');
    expect(km.textContent).toBe('2:00');
    expect(mi.className).toBe('cell mi');
    expect(mi.textContent).toBe('3:13');
  });

  it('renders the full default tape', () => {
    const frag = renderTape(buildRows(DEFAULT_CONFIG));
    expect(frag.children).toHaveLength(1177);
  });
});

describe('initialScrollTop', () => {
  it('centers the row in the viewport', () => {
    // row top 1000 px, row 40 px tall, viewport 800 px → 1000 - (800 - 40) / 2
    expect(initialScrollTop(1000, 40, 800)).toBe(620);
  });

  it('clamps to 0 for rows near the top of the tape', () => {
    expect(initialScrollTop(10, 40, 800)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `renderTape` and `initialScrollTop` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/tape.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/tape.ts src/tape-dom.test.ts
git commit -m "feat: render tape rows to DOM and add centering scroll math

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Bootstrap — wire the tape into the page

**Files:**
- Modify: `src/main.ts` (replace stub)

**Interfaces:**
- Consumes: `buildRows`, `renderTape`, `initialScrollTop` from `./tape`.
- Produces: a working (unstyled) app — `#tape` filled with 1,177 rows, initial scroll centered on 5:00 min/km.

- [ ] **Step 1: Write the implementation**

`src/main.ts`:

```ts
import './style.css';
import { buildRows, renderTape, initialScrollTop } from './tape';

/** The pace centered on first load — the crowd of the pace distribution. */
const HOME_SEC_PER_KM = 300; // 5:00 min/km

const tape = document.getElementById('tape');
if (!tape) throw new Error('Missing #tape container');

tape.append(renderTape(buildRows()));

const homeRow = tape.querySelector<HTMLElement>(
  `[data-sec-per-km="${HOME_SEC_PER_KM}"]`,
);
if (homeRow) {
  tape.scrollTop = initialScrollTop(
    homeRow.offsetTop,
    homeRow.offsetHeight,
    tape.clientHeight,
  );
}
```

- [ ] **Step 2: Verify types and tests still pass**

Run: `npm run build && npm test`
Expected: build PASS, 16 tests PASS.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev` (background), then `curl -s http://localhost:5173/ | grep -c tape`
Expected: curl finds the tape container. Then check in a real browser (or screenshot tooling if available): the page shows two columns of numbers, scrolled so ~5:00 / 8:03 is mid-viewport, and scrolling is smooth from 2:00 to exactly 100:00. Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: bootstrap tape and center initial view on 5:00 min/km

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Race Bib styling

**Files:**
- Modify: `src/style.css` (replace stub), `src/main.ts` (add font imports at top)

**Interfaces:**
- Consumes: the DOM contract — `.plate > .pin/.head/.tape`, `.row.major|minor > .cell.km|.cell.mi` (Tasks 1 & 4).
- Produces: the full approved visual identity, light + dark. No markup changes.

- [ ] **Step 1: Add self-hosted fonts**

At the very top of `src/main.ts` (before `./style.css`):

```ts
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
```

- [ ] **Step 2: Write the stylesheet**

`src/style.css`:

```css
/* ---- Race Bib palette (contrast-checked; see plan Global Constraints) ---- */
:root {
  --blue: #1749c8;
  --ink: #101010;
  --paper: #f5f4f1;
  --plate: #ffffff;
  --mi-tint: #edf2fd;
  --mi-ink: #17307a;
  --minor: #73736e;
  --minor-mi: #4a5f94;
  --head-text: #ffffff;
  --shadow: 0 2px 14px rgba(16, 16, 16, 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --blue: #2f5bd6;
    --ink: #f0f0ed;
    --paper: #0c0d0f;
    --plate: #17181c;
    --mi-tint: #151b2a;
    --mi-ink: #a7bcf0;
    --minor: #8f8f89;
    --minor-mi: #8ca3de;
    --shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
  }
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Archivo', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  display: flex;
  justify-content: center;
}

/* ---- The bib plate ---- */
.plate {
  position: relative;
  width: min(100%, 480px);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--plate);
  overflow: hidden;
}

/* Desktop: float the plate on the paper background */
@media (min-width: 520px) {
  body {
    padding: 24px 0;
  }
  .plate {
    height: calc(100dvh - 48px);
    border-radius: 16px;
    box-shadow: var(--shadow);
  }
}

/* ---- Safety pins (top corners of the header strip) ---- */
.pin {
  position: absolute;
  top: 10px;
  left: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.45);
  z-index: 2;
}

.pin-right {
  left: auto;
  right: 12px;
}

/* ---- Header strip ---- */
.head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--blue);
  color: var(--head-text);
  padding: 18px 0 12px;
  text-align: center;
  font-family: 'Archivo Black', 'Archivo', system-ui, sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
}

/* ---- The tape ---- */
.tape {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tape:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: -3px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  text-align: center;
}

/* The mile column's tint IS the column separation — no divider line. */
.cell {
  display: block;
}

.cell.mi {
  background: var(--mi-tint);
  color: var(--mi-ink);
}

.row.major .cell {
  padding: 10px 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.row.minor .cell {
  padding: 6px 0;
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--minor);
}

.row.minor .cell.mi {
  color: var(--minor-mi);
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Verify build, tests, and both color schemes**

Run: `npm run build && npm test`
Expected: PASS. Then `npm run dev` and check in a browser: bib-blue header with pin dots, white km column, blue-tinted mile column with no divider line, major/minor rhythm, centered plate with shadow at desktop width, dark scheme correct when the OS theme is dark (DevTools → emulate `prefers-color-scheme: dark`). Confirm no network request leaves localhost (fonts load from the bundle — check DevTools Network tab). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add src/style.css src/main.ts
git commit -m "feat: apply Race Bib visual identity with light and dark schemes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Docker image and README

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `.dockerignore`, `README.md`

**Interfaces:**
- Consumes: the `npm run build` output (`dist/`).
- Produces: a runnable `pace-ruler` image serving the app on port 80.

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: Write `nginx.conf`**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  gzip on;
  gzip_types text/css application/javascript image/svg+xml font/woff2;

  # Hashed bundle assets are immutable
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 3: Write `.dockerignore`**

```
node_modules
dist
.git
.superpowers
docs
README.md
```

- [ ] **Step 4: Write `README.md`**

```markdown
# Pace Ruler

Running pace conversions — min/km and min/mi side by side, as a scrollable
ruler. No inputs, no buttons: scroll to the pace you care about and read
across. Styled as a race bib. Fully static; everything is computed client-side.

## Develop

    npm install
    npm run dev        # dev server
    npm test           # unit tests (Vitest)
    npm run build      # type-check + production bundle in dist/

## Run with Docker

    docker build -t pace-ruler .
    docker run --rm -p 8080:80 pace-ruler
    # open http://localhost:8080

## Design docs

- Spec: docs/superpowers/specs/2026-07-31-pace-converter-design.md
- Plan: docs/superpowers/plans/2026-07-31-pace-ruler-v1.md
```

- [ ] **Step 5: Build and smoke-test the image**

Run:

```bash
docker build -t pace-ruler .
docker run --rm -d -p 8080:80 --name pace-ruler-test pace-ruler
curl -s http://localhost:8080/ | grep -c '"/assets/'
docker stop pace-ruler-test
```

Expected: `docker build` succeeds; curl output ≥ 1 (the built index references hashed assets). If Docker is unavailable in the environment, mark this step for the user to run and say so explicitly — do not claim it passed.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore README.md
git commit -m "feat: add Docker image and README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `npm test` — 16 tests pass
- [ ] `npm run build` — type-check + bundle succeed
- [ ] Browser: tape ends exactly at 2:00 and 100:00 min/km; 5:00/8:03 centered on load; no divider line; dark scheme correct; no external network requests
- [ ] `git log` — one commit per task
