/** A (position, time) sample of the pointer taken during a drag. */
export interface Sample {
  /** Pointer's viewport X, in px. */
  x: number;
  /** Pointer's viewport Y, in px. */
  y: number;
  /** Event timestamp, in ms. */
  t: number;
}

/** Pointer speed in px/ms along each axis, positive right and down. */
export interface Velocity {
  x: number;
  y: number;
}

/** Fraction of velocity surviving each millisecond after release. */
export const FLING_FRICTION_PER_MS = 0.995;

/** Below this speed, in px/ms, a fling is over. */
export const FLING_STOP_SPEED = 0.02;

/** Samples older than this, in ms, don't count toward release velocity. */
export const FLING_WINDOW_MS = 100;

/**
 * Ceiling on release speed, in px/ms — far above a hand's ~2 px/ms. Coalesced
 * pointer events can arrive a fraction of a millisecond apart, and dividing by
 * that would otherwise fling the tape to an end from an ordinary flick.
 */
export const FLING_MAX_SPEED = 4;

/** How many recent samples to keep while dragging. */
const MAX_SAMPLES = 8;

function clampSpeed(speed: number): number {
  return Math.max(-FLING_MAX_SPEED, Math.min(FLING_MAX_SPEED, speed));
}

/**
 * Release velocity, positive right and down.
 *
 * Only samples from the last `windowMs` count, so a drag that came to rest
 * before the user let go doesn't fling.
 */
export function flingVelocity(samples: Sample[], windowMs = FLING_WINDOW_MS): Velocity {
  const still = { x: 0, y: 0 };
  const last = samples[samples.length - 1];
  if (!last) return still;

  const first = samples.find((sample) => last.t - sample.t <= windowMs);
  if (!first || first === last) return still;

  const elapsed = last.t - first.t;
  if (elapsed <= 0) return still;

  return {
    x: clampSpeed((last.x - first.x) / elapsed),
    y: clampSpeed((last.y - first.y) / elapsed),
  };
}

/** Velocity remaining after `dtMs` of friction. */
export function decayVelocity(velocity: number, dtMs: number): number {
  return velocity * Math.pow(FLING_FRICTION_PER_MS, dtMs);
}

/** True once a fling has slowed to a stop along both axes. */
function spent(velocity: Velocity): boolean {
  return Math.abs(velocity.x) < FLING_STOP_SPEED && Math.abs(velocity.y) < FLING_STOP_SPEED;
}

/**
 * Makes `el` behave like a physical tape: press it, pull in any direction, and
 * it follows the pointer; let go mid-pull and it coasts to a stop.
 *
 * Touch is deliberately left to the browser, whose own panning is already this
 * gesture and does it better — OS-matched momentum and rubber-banding at the
 * ends. This binding brings the same feel to mouse and pen.
 *
 * Returns a disposer that unbinds the listeners and stops any fling in flight.
 */
export function enableDragScroll(el: HTMLElement): () => void {
  let activePointer: number | null = null;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let samples: Sample[] = [];
  let flingFrame: number | null = null;

  function stopFling(): void {
    if (flingFrame !== null) {
      cancelAnimationFrame(flingFrame);
      flingFrame = null;
    }
  }

  function startFling(velocity: Velocity): void {
    if (spent(velocity)) return;
    let remaining = velocity;
    let previous = performance.now();

    const step = (now: number): void => {
      const dt = now - previous;
      previous = now;

      const beforeLeft = el.scrollLeft;
      const beforeTop = el.scrollTop;
      el.scrollLeft = beforeLeft - remaining.x * dt;
      el.scrollTop = beforeTop - remaining.y * dt;
      remaining = {
        x: decayVelocity(remaining.x, dt),
        y: decayVelocity(remaining.y, dt),
      };

      // Stops both when the fling runs out and when the tape hits its ends.
      const stillMoving = el.scrollLeft !== beforeLeft || el.scrollTop !== beforeTop;
      flingFrame = stillMoving && !spent(remaining) ? requestAnimationFrame(step) : null;
    };

    flingFrame = requestAnimationFrame(step);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    // Controls are for pressing, not for grabbing — suppressing the default
    // below would rob them of focus. Info panels are excluded too: pressing one
    // to read it must not pan the tape, which would dismiss it.
    if ((event.target as Element | null)?.closest('button, a, .tip')) return;

    stopFling();
    activePointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = el.scrollLeft;
    startScrollTop = el.scrollTop;
    samples = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }];
    el.classList.add('dragging');
    // Capture keeps the drag alive when the pointer leaves the tape. It's an
    // improvement, not a requirement, and it rejects pointers the browser no
    // longer considers active — so a failure here must not abandon the drag.
    try {
      el.setPointerCapture?.(event.pointerId);
    } catch {
      /* dragging still works without capture */
    }
    // Keeps the drag from turning into a text selection.
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointer) return;
    el.scrollLeft = startScrollLeft - (event.clientX - startX);
    el.scrollTop = startScrollTop - (event.clientY - startY);
    samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    if (samples.length > MAX_SAMPLES) samples.shift();
  }

  function endDrag(event: PointerEvent, fling: boolean): void {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    el.classList.remove('dragging');
    if (fling) startFling(flingVelocity(samples));
    samples = [];
  }

  const onPointerUp = (event: PointerEvent): void => endDrag(event, true);
  const onPointerCancel = (event: PointerEvent): void => endDrag(event, false);

  // Only pointerdown can cancel a gesture, so it's the only listener that has
  // to be non-passive. Registering the others passively tells the browser it
  // can scroll without waiting to hear from them.
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove, { passive: true });
  el.addEventListener('pointerup', onPointerUp, { passive: true });
  el.addEventListener('pointercancel', onPointerCancel, { passive: true });
  el.addEventListener('wheel', stopFling, { passive: true });
  el.addEventListener('keydown', stopFling);

  return () => {
    stopFling();
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
    el.removeEventListener('wheel', stopFling);
    el.removeEventListener('keydown', stopFling);
  };
}
