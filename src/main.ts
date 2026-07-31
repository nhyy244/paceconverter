import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import './style.css';
import { buildRows } from './tape';
import { renderHeader, renderTape } from './tape-dom';
import { RACES } from './races';
import { enableDragScroll } from './drag';
import { enableInfoPanels } from './tooltip';
import { inject as injectAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

const plate = document.getElementById('plate');
const tape = document.getElementById('tape');
const head = document.getElementById('head');
if (!plate || !tape || !head) throw new Error('Missing plate, tape, or head container');

// The tape's width is one column per race plus the two pace columns; the CSS
// can't count the registry, so tell it.
plate.style.setProperty('--race-count', String(RACES.length));

head.append(renderHeader(RACES));
tape.append(renderTape(buildRows()));

// The tape opens at its start — the fastest pace — and is pulled from there.

// Touch is the browser's job — its panning already is this gesture and does it
// better. Binding anyway isn't free: a cancellable pointerdown listener on the
// scroller makes Safari wait to hear from it before it will scroll, which reads
// as lag on every swipe. So the binding goes on only where there's a pointer to
// use it.
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  enableDragScroll(tape);
}

enableInfoPanels(head, tape);

// The pinned pace column only needs an edge once columns are hidden behind it.
tape.addEventListener(
  'scroll',
  () => plate.classList.toggle('scrolled-x', tape.scrollLeft > 0),
  { passive: true },
);

// Vercel Web Analytics and Speed Insights. Both load their script from, and
// report to, this origin under /_vercel — which is why the CSP allows
// connect-src 'self' rather than 'none'. Skipped when served locally, where
// those endpoints don't exist and would just 404 on every load.
const servedLocally = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
if (import.meta.env.PROD && !servedLocally) {
  injectAnalytics();
  injectSpeedInsights();
}
