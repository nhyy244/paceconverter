export interface ModeElements {
  plate: HTMLElement;
  button: HTMLButtonElement;
  tape: HTMLElement;
  calc: HTMLElement;
}

/**
 * The label names the action, not the state. Someone pressing "Change to
 * calculator" should land on the calculator and be offered the way back.
 */
const LABELS = { ruler: 'Change to calculator', calculator: 'Change to ruler' } as const;

/**
 * Swaps the ruler for the calculator by toggling one class on the plate.
 *
 * Almost all of the work is the stylesheet's. Nothing here unmounts, rebuilds
 * or re-renders the tape — it's roughly 2,900 elements, and rebuilding it on
 * every press is what a swap like this usually gets wrong. Hiding is CSS too,
 * with visibility rather than display, so the tape keeps its layout boxes and
 * coming back is a repaint rather than a relayout of all of them. Its scroll
 * position survives for free, because it is never taken out of the document.
 *
 * There is no timer and no animation queue, so pressing the button repeatedly
 * only retargets whichever transition is already in flight.
 *
 * Returns a disposer that unbinds the listener.
 */
export function enableModeToggle({ plate, button, tape, calc }: ModeElements): () => void {
  let calculator = false;
  // Rotation accumulates rather than alternating between 0 and 180, so the
  // arrows always chase forward and never rewind.
  let turns = 0;

  function apply(): void {
    plate.classList.toggle('calc-mode', calculator);
    const label = calculator ? LABELS.calculator : LABELS.ruler;
    button.setAttribute('aria-label', label);
    button.dataset.tip = label;
  }

  function onClick(): void {
    calculator = !calculator;
    turns += 1;
    // A custom property rather than a keyframe animation: the transition on the
    // `rotate` this feeds retargets from wherever the glyph currently is, where
    // an animation would snap back to its first frame and start over.
    button.style.setProperty('--turn', `${turns * 180}deg`);

    // Focus can't stay in a view that's about to go invisible — the browser
    // drops it to the body, and the next Tab would start from the top of the
    // page. The button is where the user just was.
    const leaving = calculator ? tape : calc;
    if (leaving.contains(document.activeElement)) button.focus();

    apply();

    // Only where there's a pointer to have clicked with. On a phone this would
    // throw the keyboard up over the panel the user just asked to see — the
    // same guard main.ts uses before binding drag-scrolling.
    if (calculator && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      calc.querySelector<HTMLInputElement>('input')?.focus();
    }
  }

  button.hidden = false;
  apply();
  button.addEventListener('click', onClick);

  return () => button.removeEventListener('click', onClick);
}
