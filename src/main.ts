import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import './style.css';
import { buildRows } from './tape';
import { renderHeader, renderTape, centerRowInTape } from './tape-dom';
import { RACES } from './races';
import { enableDragScroll } from './drag';
import { enableInfoPanels } from './tooltip';

/** The pace centered on first load — the crowd of the pace distribution. */
const HOME_SEC_PER_KM = 300; // 5:00 min/km

const plate = document.getElementById('plate');
const tape = document.getElementById('tape');
const head = document.getElementById('head');
if (!plate || !tape || !head) throw new Error('Missing plate, tape, or head container');

head.append(renderHeader(RACES));
tape.append(renderTape(buildRows()));

/** Re-centers on `secPerKm`; safe to call repeatedly (e.g. after fonts swap in and row heights change). */
function centerOn(secPerKm: number): void {
  const row = tape!.querySelector<HTMLElement>(`[data-sec-per-km="${secPerKm}"]`);
  if (row) {
    tape!.scrollTop = centerRowInTape(tape!, row, head!.offsetHeight);
  }
}

centerOn(HOME_SEC_PER_KM);

enableDragScroll(tape);
enableInfoPanels(head, tape);

// The pinned pace column only needs an edge once columns are hidden behind it.
tape.addEventListener(
  'scroll',
  () => plate.classList.toggle('scrolled-x', tape.scrollLeft > 0),
  { passive: true },
);

let userHasTakenOver = false;
const markTakeover = (): void => {
  userHasTakenOver = true;
};
for (const gesture of ['pointerdown', 'wheel', 'keydown'] as const) {
  tape.addEventListener(gesture, markTakeover, { once: true, passive: true });
}

// @fontsource uses font-display: swap — row heights change once Archivo
// finishes loading, so the centering computed above can drift. Re-center
// once fonts have settled, unless the tape is already in the user's hands.
document.fonts?.ready.then(() => {
  if (!userHasTakenOver) centerOn(HOME_SEC_PER_KM);
});
