export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  left: number;
  top: number;
}

/** Gap between the button and the panel it opens. */
const OFFSET = 6;

/** Smallest gap left between the panel and the edge of the screen. */
const MARGIN = 8;

/**
 * Where to put a panel opened from `anchor`: centred under it, nudged back
 * inside the viewport, and flipped above the anchor when there isn't room
 * below.
 */
export function panelPosition(anchor: Box, panel: Size, viewport: Size): Point {
  const centred = anchor.left + anchor.width / 2 - panel.width / 2;
  const rightmost = viewport.width - panel.width - MARGIN;
  const left = rightmost < MARGIN ? MARGIN : Math.min(Math.max(centred, MARGIN), rightmost);

  const below = anchor.bottom + OFFSET;
  const fitsBelow = below + panel.height <= viewport.height - MARGIN;
  const above = anchor.top - OFFSET - panel.height;
  const top = fitsBelow ? below : Math.max(above, MARGIN);

  return { left, top };
}

/**
 * Wires each info button in `container` to the panel that follows it. One panel
 * is open at a time; it closes on Escape, on a press anywhere else, and when
 * the tape moves out from under it.
 *
 * Returns a disposer that unbinds everything and closes what's open.
 */
export function enableInfoPanels(container: HTMLElement, scroller: HTMLElement): () => void {
  let openButton: HTMLButtonElement | null = null;

  function panelFor(button: HTMLButtonElement): HTMLElement | null {
    return button.parentElement?.querySelector<HTMLElement>(
      `.tip[data-race="${button.dataset.race}"]`,
    ) ?? null;
  }

  function close(): void {
    if (!openButton) return;
    const panel = panelFor(openButton);
    if (panel) panel.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
    openButton = null;
  }

  function open(button: HTMLButtonElement): void {
    const panel = panelFor(button);
    if (!panel) return;
    close();

    // Measure after it's rendered but before it's placed, so the panel's own
    // size is known.
    panel.hidden = false;
    panel.style.left = '0px';
    panel.style.top = '0px';

    const position = panelPosition(button.getBoundingClientRect(), panel.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;

    button.setAttribute('aria-expanded', 'true');
    openButton = button;
  }

  function onClick(event: MouseEvent): void {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button.info');
    if (!button) return;
    event.preventDefault();
    if (button === openButton) close();
    else open(button);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!openButton) return;
    const target = event.target as Element | null;
    if (target?.closest('.tip') || target?.closest('button.info')) return;
    close();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !openButton) return;
    const button = openButton;
    close();
    button.focus();
  }

  container.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown);
  // The panel is anchored to a spot on screen, and the tape can move under it.
  scroller.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);

  return () => {
    close();
    container.removeEventListener('click', onClick);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown);
    scroller.removeEventListener('scroll', close);
    window.removeEventListener('resize', close);
  };
}
