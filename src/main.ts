import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import './style.css';
import { buildRows, renderTape, centerRowInTape } from './tape';

/** The pace centered on first load — the crowd of the pace distribution. */
const HOME_SEC_PER_KM = 300; // 5:00 min/km

const tape = document.getElementById('tape');
if (!tape) throw new Error('Missing #tape container');

tape.append(renderTape(buildRows()));

/** Re-centers on `secPerKm`; safe to call repeatedly (e.g. after fonts swap in and row heights change). */
function centerOn(secPerKm: number): void {
  const row = tape!.querySelector<HTMLElement>(`[data-sec-per-km="${secPerKm}"]`);
  if (row) {
    tape!.scrollTop = centerRowInTape(tape!, row);
  }
}

centerOn(HOME_SEC_PER_KM);

// @fontsource uses font-display: swap — row heights change once Archivo
// finishes loading, so the centering computed above can drift. Re-center
// once fonts have settled.
document.fonts?.ready.then(() => centerOn(HOME_SEC_PER_KM));
