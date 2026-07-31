# Pace Ruler

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
