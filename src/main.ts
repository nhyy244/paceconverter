import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/bebas-neue/400.css';
import './style.css';
import { buildRows } from './tape';
import { renderHeader, renderTape } from './tape-dom';
import { RACES } from './races';
import { enableDragScroll } from './drag';
import { enableInfoPanels } from './tooltip';

const plate = document.getElementById('plate');
const tape = document.getElementById('tape');
const head = document.getElementById('head');
if (!plate || !tape || !head) throw new Error('Missing plate, tape, or head container');

head.append(renderHeader(RACES));
tape.append(renderTape(buildRows()));

// The tape opens at its start — the fastest pace — and is pulled from there.

enableDragScroll(tape);
enableInfoPanels(head, tape);

// The pinned pace column only needs an edge once columns are hidden behind it.
tape.addEventListener(
  'scroll',
  () => plate.classList.toggle('scrolled-x', tape.scrollLeft > 0),
  { passive: true },
);
