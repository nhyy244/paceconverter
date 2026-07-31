# Pace Ruler

Running pace conversions — min/km and min/mi side by side, as one long ruler.
No inputs, no buttons: grab the tape, pull it to the pace you care about, and
read across. Styled as a race bib. Fully static; everything is computed
client-side.

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
