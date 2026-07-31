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

The canonical domain is **paceconverter.run**; it appears in `<link rel="canonical">`
and the Open Graph tags in `index.html`, so a different domain means editing those.

`public/og.png` is the link-preview card — a 1200×630 screenshot of the app
itself, parked on 4:30–5:10 min/km so a runner recognises the numbers at a
glance. Regenerate it after any visual change by loading the built app at that
size and capturing it; nothing automates this, so it will drift if the design
moves on.

**Vercel.** Import the repository; `vercel.json` supplies the framework preset,
the build command, and the output directory, so the defaults need no editing.
It also sets the caching and security headers: hashed assets under `/assets/`
are immutable for a year, `index.html` must revalidate, and a strict
`Content-Security-Policy` limits the page to its own origin. Nothing is fetched
from a third party at runtime — the fonts are bundled.

**Analytics.** Vercel Web Analytics and Speed Insights are injected in
production builds (skipped when served from localhost, where `/_vercel` doesn't
exist). Both need switching on per project under **Analytics** and **Speed
Insights** in the Vercel dashboard before any data appears — the code alone
isn't enough. Both load and report over this origin under `/_vercel`, which is
why the CSP's `connect-src` is `'self'`: at `'none'` the scripts would load and
every beacon would be silently dropped.

**Anywhere else**, the Docker image serves the same build behind nginx with the
headers kept in step:

    docker build -t pace-converter .
    docker run --rm -p 8080:80 pace-converter
    # open http://localhost:8080

Adding any third-party resource means loosening the CSP in both `vercel.json`
and `nginx.conf`; they are deliberately identical. Note that a same-origin
beacon counts — that is how the analytics packages report, and why `connect-src`
had to move off `'none'`.

Self-hosting outside Vercel serves the same build, but the two `/_vercel` script
requests will 404 harmlessly; drop the inject calls at the foot of `main.ts` to
be rid of them.

## Design docs

- Spec: docs/superpowers/specs/2026-07-31-pace-converter-design.md
- Plan: docs/superpowers/plans/2026-07-31-pace-ruler-v1.md
