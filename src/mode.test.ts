/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest';
import { enableModeToggle } from './mode';

let plate: HTMLElement;
let button: HTMLButtonElement;
let tape: HTMLElement;
let calc: HTMLElement;
let dispose: () => void;

beforeEach(() => {
  document.body.innerHTML = `
    <div class="plate-wrap">
      <main class="plate" id="plate">
        <div class="views">
          <div id="tape" class="tape" tabindex="0"><header id="head"></header></div>
          <div id="calc" class="calc"><input id="calc-pace" /></div>
        </div>
      </main>
      <button id="swap" class="swap" type="button" hidden
              aria-label="Change to calculator" data-tip="Change to calculator"></button>
    </div>`;

  plate = document.getElementById('plate')!;
  button = document.getElementById('swap') as HTMLButtonElement;
  tape = document.getElementById('tape')!;
  calc = document.getElementById('calc')!;
  dispose = enableModeToggle({ plate, button, tape, calc });
  return () => dispose();
});

describe('enabling', () => {
  it('reveals the button, which is useless until the script runs', () => {
    expect(button.hidden).toBe(false);
  });

  it('starts on the ruler', () => {
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });
});

describe('toggling', () => {
  it('switches to the calculator', () => {
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(true);
  });

  it('switches back', () => {
    button.click();
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });

  it('says what the next press will do, not what mode it is in', () => {
    expect(button.getAttribute('aria-label')).toBe('Change to calculator');
    button.click();
    expect(button.getAttribute('aria-label')).toBe('Change to ruler');
  });

  it('keeps the tooltip and the label saying the same thing', () => {
    button.click();
    expect(button.dataset.tip).toBe(button.getAttribute('aria-label'));
  });
});

describe('the glyph', () => {
  it('spins half a turn per press', () => {
    button.click();
    expect(button.style.getPropertyValue('--turn')).toBe('180deg');
  });

  it('keeps spinning the same way instead of rewinding', () => {
    button.click();
    button.click();
    button.click();
    expect(button.style.getPropertyValue('--turn')).toBe('540deg');
  });
});

describe('staying fast', () => {
  // The tape is ~2,900 elements. Rebuilding it per switch, or letting
  // display: none throw away its layout boxes, is the one thing here that
  // would actually be slow — so the swap must never touch it structurally.
  it('never replaces the tape', () => {
    const before = document.getElementById('tape');
    for (let i = 0; i < 20; i += 1) button.click();
    expect(document.getElementById('tape')).toBe(before);
  });

  it('leaves what the tape holds alone', () => {
    const head = document.getElementById('head');
    for (let i = 0; i < 20; i += 1) button.click();
    expect(document.getElementById('head')).toBe(head);
    expect(head!.parentElement).toBe(tape);
  });

  it('sets no inline display on either view', () => {
    for (let i = 0; i < 20; i += 1) button.click();
    expect(tape.style.display).toBe('');
    expect(calc.style.display).toBe('');
  });

  it('settles consistently however many times it is pressed', () => {
    for (let i = 0; i < 21; i += 1) button.click();
    expect(plate.classList.contains('calc-mode')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Change to ruler');
  });
});

describe('focus', () => {
  // A view that goes invisible can't hold focus. Left alone the browser drops
  // it to the body, and the next Tab starts from the top of the page.
  it('rescues focus from the view it is hiding', () => {
    button.click();
    calc.querySelector('input')!.focus();
    button.click();
    expect(document.activeElement).toBe(button);
  });

  it('leaves focus alone when it was never in the outgoing view', () => {
    button.click();
    button.focus();
    button.click();
    expect(document.activeElement).toBe(button);
  });

  // Only where a pointer did the clicking. happy-dom reports hover: hover, so
  // this is the desktop path; on a phone the guard skips it rather than
  // throwing the keyboard up over the panel.
  it('puts the cursor in the calculator on a device with a pointer', () => {
    tape.focus();
    button.click();
    expect(document.activeElement).toBe(calc.querySelector('input'));
  });
});

describe('dispose', () => {
  it('stops toggling', () => {
    dispose();
    button.click();
    expect(plate.classList.contains('calc-mode')).toBe(false);
  });
});
