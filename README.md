# Pace Converter

Running pace conversions as one long ruler. Every row is a pace: min/km beside
min/mi, then a finish time for each race distance from a 5K to a 300-mile ultra.
No inputs, no buttons — grab the tape, pull it to the pace you care about, and
read across; pan sideways for the longer races. Styled as a race bib. Fully
static; everything is computed client-side.

The four ultras (Tahoe 200, Moab 240, Bigfoot 200, Arizona Monster 300) carry an
info button with a summary and a link to the organizer's page. Their courses are
rerouted between editions, so `src/races.ts` records where each distance came
from — worth re-checking before each season.

## Develop

Node 20 or newer (Vite 7 requires it).

    npm install
    npm run dev        # dev server
    npm test           # unit tests (Vitest)
    npm run build      # type-check + production bundle in dist/
    npm run preview    # serve the built bundle locally

## Deploy

There is no backend and no build-time configuration — no environment variables,
no secrets, nothing to set up per environment.

**Vercel.** Import the repository; `vercel.json` supplies the framework preset,
the build command, and the output directory, so the defaults need no editing.
It also sets the caching and security headers: hashed assets under `/assets/`
are immutable for a year, `index.html` must revalidate, and a strict
`Content-Security-Policy` limits the page to its own origin. The app makes no
external requests at runtime — fonts are bundled — so `connect-src` is `'none'`.

**Anywhere else**, the Docker image serves the same build behind nginx with the
headers kept in step:

    docker build -t pace-converter .
    docker run --rm -p 8080:80 pace-converter
    # open http://localhost:8080

Adding an analytics script or any other third-party resource means loosening the
CSP in both `vercel.json` and `nginx.conf`; they are deliberately identical.

This catches same-origin beacons too, which is the easiest way to be caught out:
Vercel Analytics and Speed Insights load their script fine under `script-src
'self'` but POST to `/_vercel/insights/*`, so `connect-src 'none'` silently
discards every event. Enabling either means allowing that path.

## Design docs

- Spec: docs/superpowers/specs/2026-07-31-pace-converter-design.md
- Plan: docs/superpowers/plans/2026-07-31-pace-ruler-v1.md
