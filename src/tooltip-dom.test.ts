/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enableInfoPanels } from './tooltip';
import { renderHeader } from './tape-dom';
import { RACES } from './races';

describe('enableInfoPanels', () => {
  let scroller: HTMLElement;
  let head: HTMLElement;
  let dispose: () => void;

  const button = (race: string) =>
    head.querySelector<HTMLButtonElement>(`button.info[data-race="${race}"]`)!;
  const panel = (race: string) => head.querySelector<HTMLElement>(`.tip[data-race="${race}"]`)!;

  beforeEach(() => {
    scroller = document.createElement('div');
    head = document.createElement('div');
    head.append(renderHeader(RACES));
    scroller.append(head);
    document.body.append(scroller);
    dispose = enableInfoPanels(head, scroller);
  });

  afterEach(() => {
    dispose();
    scroller.remove();
  });

  it('opens the panel belonging to the button that was pressed', () => {
    button('moab240').click();

    expect(panel('moab240').hidden).toBe(false);
    expect(button('moab240').getAttribute('aria-expanded')).toBe('true');
    expect(panel('tahoe200').hidden).toBe(true);
  });

  it('closes again when the same button is pressed', () => {
    button('moab240').click();
    button('moab240').click();

    expect(panel('moab240').hidden).toBe(true);
    expect(button('moab240').getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps only one panel open at a time', () => {
    button('tahoe200').click();
    button('arizona300').click();

    expect(panel('tahoe200').hidden).toBe(true);
    expect(button('tahoe200').getAttribute('aria-expanded')).toBe('false');
    expect(panel('arizona300').hidden).toBe(false);
  });

  it('places the panel on screen', () => {
    button('bigfoot200').click();

    expect(panel('bigfoot200').style.left).toMatch(/px$/);
    expect(panel('bigfoot200').style.top).toMatch(/px$/);
  });

  it('closes on a press outside the panel', () => {
    button('tahoe200').click();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(panel('tahoe200').hidden).toBe(true);
  });

  it('stays open when the press lands inside the panel', () => {
    button('tahoe200').click();

    panel('tahoe200')
      .querySelector('a')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(panel('tahoe200').hidden).toBe(false);
  });

  it('closes on Escape and hands focus back to the button', () => {
    button('tahoe200').click();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(panel('tahoe200').hidden).toBe(true);
    expect(document.activeElement).toBe(button('tahoe200'));
  });

  it('closes when the tape moves under it', () => {
    button('tahoe200').click();

    scroller.dispatchEvent(new Event('scroll'));

    expect(panel('tahoe200').hidden).toBe(true);
  });

  it('stops responding once disposed', () => {
    dispose();

    button('tahoe200').click();

    expect(panel('tahoe200').hidden).toBe(true);
  });
});
