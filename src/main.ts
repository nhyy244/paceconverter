import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
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
