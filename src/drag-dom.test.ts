/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableDragScroll } from './drag';

interface PointerInit {
  clientY: number;
  clientX?: number;
  /** Event timestamp in ms; only matters for fling velocity. */
  t?: number;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  target?: Element;
}

/**
 * A pointer event with the fields the drag binding reads. Built by hand
 * because `timeStamp` is read-only on real events and the binding uses it to
 * measure velocity.
 */
function pointerEvent(type: string, init: PointerInit): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? 'mouse' },
    button: { value: init.button ?? 0 },
    timeStamp: { value: init.t ?? 0 },
  });
  return event as unknown as PointerEvent;
}

describe('enableDragScroll', () => {
  let tape: HTMLElement;
  let dispose: () => void;

  beforeEach(() => {
    tape = document.createElement('div');
    document.body.append(tape);
    tape.scrollTop = 500;
    tape.scrollLeft = 200;
    dispose = enableDragScroll(tape);
  });

  afterEach(() => {
    dispose();
    tape.remove();
  });

  it('pulls the tape down when the pointer drags down', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 340 }));

    // Dragging down 40 px reveals 40 px of earlier paces above.
    expect(tape.scrollTop).toBe(460);
  });

  it('pushes the tape up when the pointer drags up', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 250 }));

    expect(tape.scrollTop).toBe(550);
  });

  it('pans the columns sideways too', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientX: 130, clientY: 320 }));

    // A diagonal pull moves both axes by the distance travelled on each.
    expect(tape.scrollLeft).toBe(170);
    expect(tape.scrollTop).toBe(480);
  });

  it('leaves buttons and links to be pressed rather than grabbed', () => {
    const button = document.createElement('button');
    tape.append(button);

    const event = pointerEvent('pointerdown', { clientY: 300 });
    button.dispatchEvent(event);
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 400 }));

    expect(tape.scrollTop).toBe(500);
    expect(tape.classList.contains('dragging')).toBe(false);
    // Suppressing the default here would rob the button of focus.
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not pan when an info panel is pressed', () => {
    // Panels live inside the tape, and panning dismisses them — so pressing one
    // to read or select it must not start a drag.
    const panel = document.createElement('div');
    panel.className = 'tip';
    const summary = document.createElement('p');
    panel.append(summary);
    tape.append(panel);

    summary.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 400 }));

    expect(tape.scrollTop).toBe(500);
    expect(tape.classList.contains('dragging')).toBe(false);
  });

  it('tracks the total distance from the press, not each step', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 330 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 380 }));

    expect(tape.scrollTop).toBe(420);
  });

  it('marks the tape as dragging only while the pointer is down', () => {
    expect(tape.classList.contains('dragging')).toBe(false);

    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    expect(tape.classList.contains('dragging')).toBe(true);

    tape.dispatchEvent(pointerEvent('pointerup', { clientY: 300 }));
    expect(tape.classList.contains('dragging')).toBe(false);
  });

  it('leaves touch to the browser', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300, pointerType: 'touch' }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 340, pointerType: 'touch' }));

    expect(tape.scrollTop).toBe(500);
    expect(tape.classList.contains('dragging')).toBe(false);
  });

  it('ignores non-primary buttons', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300, button: 2 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 340 }));

    expect(tape.scrollTop).toBe(500);
  });

  it('ignores movement from a pointer that never pressed', () => {
    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300, pointerId: 1 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 340, pointerId: 2 }));

    expect(tape.scrollTop).toBe(500);
  });

  it('suppresses the browser default so dragging does not select text', () => {
    const event = pointerEvent('pointerdown', { clientY: 300 });
    tape.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops responding once disposed', () => {
    dispose();

    tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300 }));
    tape.dispatchEvent(pointerEvent('pointermove', { clientY: 340 }));

    expect(tape.scrollTop).toBe(500);
  });

  describe('release', () => {
    let now: number;
    let queued: FrameRequestCallback[];

    /** Runs the frames the fling has queued, `ms` later. */
    function advanceFrame(ms: number): void {
      now += ms;
      const due = queued;
      queued = [];
      for (const callback of due) callback(now);
    }

    beforeEach(() => {
      now = 0;
      queued = [];
      // A hand-driven clock: Chrome's own rAF can't be observed under the
      // headless virtual clock, so the coast is verified here instead.
      vi.stubGlobal('performance', { now: () => now });
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        queued.push(callback);
        return queued.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {
        queued = [];
      });
      tape.scrollTop = 50_000;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Pulls the tape down 100 px over two 16 ms frames, then lets go. */
    function flick(): void {
      tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 400, t: 0 }));
      tape.dispatchEvent(pointerEvent('pointermove', { clientY: 450, t: 16 }));
      tape.dispatchEvent(pointerEvent('pointermove', { clientY: 500, t: 32 }));
      tape.dispatchEvent(pointerEvent('pointerup', { clientY: 500, t: 32 }));
    }

    /** Flicks by (dx, dy) over two 16 ms frames, then lets go. */
    function flickBy(dx: number, dy: number): void {
      tape.dispatchEvent(pointerEvent('pointerdown', { clientX: 300, clientY: 400, t: 0 }));
      tape.dispatchEvent(
        pointerEvent('pointermove', { clientX: 300 + dx / 2, clientY: 400 + dy / 2, t: 16 }),
      );
      tape.dispatchEvent(pointerEvent('pointermove', { clientX: 300 + dx, clientY: 400 + dy, t: 32 }));
      tape.dispatchEvent(pointerEvent('pointerup', { clientX: 300 + dx, clientY: 400 + dy, t: 32 }));
    }

    it('keeps the tape coasting in the direction of the flick', () => {
      flick();
      const atRelease = tape.scrollTop;

      advanceFrame(16);

      // ~3.1 px/ms of downward pull carries on past the release.
      expect(tape.scrollTop).toBeLessThan(atRelease);
    });

    it('coasts each axis in its own direction', () => {
      // Opposite signs, so a coast that mixed up the axes would move one of
      // them the wrong way: left-and-down means scrollLeft climbs as scrollTop
      // falls.
      flickBy(-60, 40);
      const atRelease = { left: tape.scrollLeft, top: tape.scrollTop };

      advanceFrame(16);

      expect(tape.scrollLeft).toBeGreaterThan(atRelease.left);
      expect(tape.scrollTop).toBeLessThan(atRelease.top);
    });

    it('keeps coasting on one axis after the other has run out', () => {
      // Purely vertical: the horizontal axis is spent from the start and must
      // not cut the vertical coast short.
      flickBy(0, -60);
      const atRelease = tape.scrollTop;

      advanceFrame(16);

      expect(queued.length).toBeGreaterThan(0);
      expect(tape.scrollTop).toBeGreaterThan(atRelease);
    });

    it('slows down and settles', () => {
      flick();

      let previousStep = Infinity;
      for (let frame = 0; frame < 400 && queued.length > 0; frame += 1) {
        const before = tape.scrollTop;
        advanceFrame(16);
        const step = Math.abs(tape.scrollTop - before);
        expect(step).toBeLessThanOrEqual(previousStep);
        previousStep = step;
      }

      expect(queued).toHaveLength(0);
      // Comes to rest at sub-pixel motion rather than stopping dead.
      expect(previousStep).toBeLessThan(1);
    });

    it('does not coast when the drag came to rest before release', () => {
      tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 400, t: 0 }));
      tape.dispatchEvent(pointerEvent('pointermove', { clientY: 500, t: 16 }));
      // Held still for a moment before letting go.
      tape.dispatchEvent(pointerEvent('pointermove', { clientY: 500, t: 300 }));
      tape.dispatchEvent(pointerEvent('pointerup', { clientY: 500, t: 300 }));

      expect(queued).toHaveLength(0);
    });

    it('abandons a coast when the tape is grabbed again', () => {
      flick();
      advanceFrame(16);
      expect(queued.length).toBeGreaterThan(0);

      tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 300, t: 400 }));

      expect(queued).toHaveLength(0);
    });

    it('does not coast after the gesture is cancelled', () => {
      tape.dispatchEvent(pointerEvent('pointerdown', { clientY: 400, t: 0 }));
      tape.dispatchEvent(pointerEvent('pointermove', { clientY: 500, t: 16 }));
      tape.dispatchEvent(pointerEvent('pointercancel', { clientY: 500, t: 16 }));

      expect(queued).toHaveLength(0);
      expect(tape.classList.contains('dragging')).toBe(false);
    });
  });
});
