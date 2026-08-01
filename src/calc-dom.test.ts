/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest';
import { enableCalculator, renderCalculator } from './calc-dom';

let panel: HTMLElement;
let dispose: () => void;

function field(name: string): HTMLInputElement {
  return panel.querySelector<HTMLInputElement>(`#calc-${name}`)!;
}

function unit(name: string): HTMLSelectElement {
  return panel.querySelector<HTMLSelectElement>(`#calc-${name}-unit`)!;
}

function type(name: string, value: string): void {
  const input = field(name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(name: string, value: string): void {
  const select = unit(name);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function leave(name: string): void {
  field(name).dispatchEvent(new Event('focusout', { bubbles: true }));
}

function computed(): string | undefined {
  return panel.querySelector<HTMLElement>('.field.computed')?.dataset.field;
}

function alt(): string {
  return note('pace');
}

function note(name: string): string {
  return panel.querySelector<HTMLElement>(`#calc-${name}-note`)!.textContent ?? '';
}

function typeKey(name: string, text: string): boolean {
  const event = new Event('beforeinput', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'inputType', { value: 'insertText' });
  Object.defineProperty(event, 'data', { value: text });
  return field(name).dispatchEvent(event);
}

beforeEach(() => {
  document.body.replaceChildren();
  panel = renderCalculator();
  document.body.append(panel);
  dispose = enableCalculator(panel);
  return () => dispose();
});

describe('the panel', () => {
  it('offers all three distance units', () => {
    const values = [...unit('distance').options].map((option) => option.value);
    expect(values).toEqual(['m', 'km', 'mi']);
  });

  it('offers both pace units', () => {
    const values = [...unit('pace').options].map((option) => option.value);
    expect(values).toEqual(['km', 'mi']);
  });

  // The units are listed smallest first, so the default has to be stated —
  // opening the distance field in metres would be a trap.
  it('opens in kilometres, not the first unit in the list', () => {
    expect(unit('distance').value).toBe('km');
    expect(unit('pace').value).toBe('km');
  });

  it('starts with time as the answer, the way people arrive at a pace tool', () => {
    expect(computed()).toBe('time');
  });

  it('asks phones for a numeric keypad', () => {
    for (const name of ['pace', 'distance', 'time']) {
      expect(field(name).getAttribute('inputmode')).toBe('decimal');
    }
  });

  it('ties every label to its field', () => {
    for (const name of ['pace', 'distance', 'time']) {
      const label = panel.querySelector<HTMLLabelElement>(`label[for="calc-${name}"]`);
      expect(label).not.toBeNull();
    }
  });
});

describe('solving', () => {
  it('fills the time from a pace and a distance', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    expect(field('time').value).toBe('1:56:02');
  });

  it('fills the pace once the time is typed instead', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    type('time', '1:56:02');
    expect(computed()).toBe('pace');
    expect(field('pace').value).toBe('5:30');
  });

  it('fills the distance when pace and time are the two newest fields', () => {
    type('distance', '10');
    type('time', '55:00');
    type('pace', '5:30');
    expect(computed()).toBe('distance');
    expect(field('distance').value).toBe('10');
  });

  it('counts a marathon in hours', () => {
    type('pace', '5:00');
    type('distance', '42.195');
    expect(field('time').value).toBe('3:30:59');
  });

  it('keeps a 300-mile time readable and re-typable', () => {
    type('pace', '20:00');
    choose('distance', 'mi');
    type('distance', '300.5');
    // 483.6 km at 20:00/km. Hours keep counting rather than rolling into days,
    // so the field can read its own answer back.
    expect(field('time').value).toBe('161:12:09');
  });
});

describe('the min/mi readout', () => {
  it('shows the other unit alongside a min/km pace', () => {
    type('pace', '5:30');
    expect(alt()).toBe('= 8:51 min/mi');
  });

  it('shows min/km alongside a pace entered in min/mi', () => {
    choose('pace', 'mi');
    type('pace', '8:51');
    expect(alt()).toBe('= 5:30 min/km');
  });

  it('tracks a pace the calculator worked out rather than one that was typed', () => {
    type('distance', '10');
    type('time', '55:00');
    expect(alt()).toBe('= 8:51 min/mi');
  });

  it('empties when there is no pace to show', () => {
    expect(alt()).toBe('');
  });
});

describe('changing units', () => {
  it('converts the value rather than reinterpreting it', () => {
    type('pace', '5:30');
    choose('pace', 'mi');
    expect(field('pace').value).toBe('8:51');
  });

  it('converts a distance to metres', () => {
    type('distance', '5');
    choose('distance', 'm');
    expect(field('distance').value).toBe('5000');
  });

  it('converts a distance to miles', () => {
    type('distance', '42.195');
    choose('distance', 'mi');
    expect(field('distance').value).toBe('26.219');
  });

  it('holds the answer steady while its inputs change unit', () => {
    type('pace', '5:30');
    type('distance', '10');
    const before = field('time').value;
    choose('distance', 'm');
    expect(field('time').value).toBe(before);
  });

  it('leaves an unparseable value exactly as typed', () => {
    type('distance', 'soon');
    choose('distance', 'mi');
    expect(field('distance').value).toBe('soon');
  });

  // A real <select> fires input as well as change. Changing a unit is not
  // editing the field, and must not shuffle which field is the answer.
  it('does not count a unit change as editing the field', () => {
    type('pace', '5:30');
    type('distance', '10');
    expect(computed()).toBe('time');
    unit('pace').dispatchEvent(new Event('input', { bubbles: true }));
    expect(computed()).toBe('time');
  });

  it('converts the answer too, when the answer is the field changing unit', () => {
    type('distance', '10');
    type('time', '55:00');
    expect(computed()).toBe('pace');
    choose('pace', 'mi');
    expect(field('pace').value).toBe('8:51');
  });
});

/**
 * A phone's numeric keypad has no colon, so the panel has to accept a pace some
 * other way and then show it back in the form the rest of the app uses.
 */
describe('typing on a keypad', () => {
  it('solves from a pace typed as bare digits', () => {
    type('pace', '530');
    type('distance', '10');
    expect(field('time').value).toBe('55:00');
  });

  it('solves from a pace typed with the keypad separator', () => {
    type('pace', '5.30');
    type('distance', '10');
    expect(field('time').value).toBe('55:00');
  });

  it('tidies bare digits into a colon on the way out', () => {
    type('pace', '530');
    leave('pace');
    expect(field('pace').value).toBe('5:30');
  });

  it('tidies the separator into a colon too', () => {
    type('pace', '5.30');
    leave('pace');
    expect(field('pace').value).toBe('5:30');
  });

  it('tidies a time typed as bare digits', () => {
    type('time', '15602');
    leave('time');
    expect(field('time').value).toBe('1:56:02');
  });

  it('tidies a half-typed distance', () => {
    type('distance', '21,0975');
    leave('distance');
    expect(field('distance').value).toBe('21.098');
  });

  it('leaves text it cannot read exactly as typed', () => {
    type('pace', 'soon');
    leave('pace');
    expect(field('pace').value).toBe('soon');
  });

  it('does not change which field is the answer', () => {
    type('pace', '530');
    type('distance', '10');
    expect(computed()).toBe('time');
    leave('pace');
    expect(computed()).toBe('time');
  });
});

/**
 * A rejected pace used to do nothing at all, which left the user with no idea
 * why. The nudge says what the field wants, without making a drama of it.
 */
describe('the nudge under a field', () => {
  it('says nothing before anything has been typed', () => {
    expect(note('pace')).toBe('');
    expect(note('distance')).toBe('');
  });

  it('gives the seconds range as soon as they go over 59', () => {
    type('pace', '4:60');
    expect(note('pace')).toBe('seconds go from 00 to 59');
  });

  it('does the same for 4:70 and for bare digits', () => {
    type('pace', '4:70');
    expect(note('pace')).toBe('seconds go from 00 to 59');
    type('pace', '460');
    expect(note('pace')).toBe('seconds go from 00 to 59');
  });

  it('mentions minutes as well in a time', () => {
    type('distance', '10');
    type('time', '1:60:00');
    expect(note('time')).toBe('minutes and seconds go from 00 to 59');
  });

  it('gives the line back to the conversion the moment the pace is fixed', () => {
    type('pace', '4:60');
    expect(note('pace')).toBe('seconds go from 00 to 59');
    type('pace', '4:50');
    expect(note('pace')).toBe('= 7:47 min/mi');
  });

  // Being corrected halfway through typing 4:30 would be maddening.
  it('stays quiet about a half-typed pace while it is being typed', () => {
    type('pace', '4:');
    expect(note('pace')).toBe('');
    // `4:3` is 4:03 on the way to 4:30, and reads as a pace in its own right.
    type('pace', '4:3');
    expect(note('pace')).toBe('= 6:31 min/mi');
  });

  it('reads a bare minute count as a pace rather than as unfinished', () => {
    // `4` is 4:00, so it gets its conversion, not a nudge.
    type('pace', '4');
    expect(note('pace')).toBe('= 6:26 min/mi');
  });

  it('mentions the shape once the field is left unfinished', () => {
    type('pace', '4:');
    leave('pace');
    expect(note('pace')).toBe('a pace looks like 5:30');
  });

  it('describes a distance in its own terms', () => {
    type('pace', '5:00');
    type('distance', '0');
    leave('distance');
    expect(note('distance')).toBe('a distance looks like 21.1');
  });

  it('goes quiet again when the field is emptied', () => {
    type('pace', '4:60');
    expect(note('pace')).not.toBe('');
    type('pace', '');
    expect(note('pace')).toBe('');
  });

  it('never blames the field holding the answer', () => {
    type('pace', '5:00');
    type('distance', '10');
    expect(computed()).toBe('time');
    leave('time');
    expect(note('time')).toBe('');
  });

  it('marks a nudge so it can be styled apart from the conversion', () => {
    type('pace', '4:60');
    expect(panel.querySelector('#calc-pace-note')!.classList.contains('is-problem')).toBe(true);
    type('pace', '4:50');
    expect(panel.querySelector('#calc-pace-note')!.classList.contains('is-problem')).toBe(false);
  });

  it('points each field at its own nudge for a screen reader', () => {
    for (const name of ['pace', 'distance', 'time']) {
      expect(field(name).getAttribute('aria-describedby')).toBe(`calc-${name}-note`);
      expect(panel.querySelector(`#calc-${name}-note`)!.getAttribute('aria-live')).toBe('polite');
    }
  });
});

/**
 * The desktop keyboard can offer letters where a phone's keypad cannot, so the
 * fields refuse them outright rather than accepting them and complaining.
 */
describe('what can be typed', () => {
  it('takes digits and the separators a pace uses', () => {
    for (const ch of ['5', ':', '.', ',']) expect(typeKey('pace', ch)).toBe(true);
  });

  it('refuses letters', () => {
    for (const ch of ['a', 'e', 'z']) expect(typeKey('pace', ch)).toBe(false);
  });

  it('refuses signs and spaces', () => {
    for (const ch of ['-', '+', ' ', '/']) expect(typeKey('pace', ch)).toBe(false);
  });

  it('refuses a colon in the distance, which has no use for one', () => {
    expect(typeKey('distance', '.')).toBe(true);
    expect(typeKey('distance', ':')).toBe(false);
  });

  it('refuses a pasted word but allows a pasted pace', () => {
    const paste = (name: string, text: string) => {
      const event = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'inputType', { value: 'insertFromPaste' });
      Object.defineProperty(event, 'data', { value: null });
      Object.defineProperty(event, 'dataTransfer', { value: { getData: () => text } });
      return field(name).dispatchEvent(event);
    };
    expect(paste('pace', 'about five')).toBe(false);
    expect(paste('pace', '5:30')).toBe(true);
  });

  it('never blocks a deletion', () => {
    const event = new Event('beforeinput', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'inputType', { value: 'deleteContentBackward' });
    Object.defineProperty(event, 'data', { value: null });
    expect(field('pace').dispatchEvent(event)).toBe(true);
  });
});

describe('bad input', () => {
  it('blanks the answer rather than showing NaN', () => {
    type('pace', '5:30');
    type('distance', '21.0975');
    type('distance', 'wat');
    expect(field('time').value).toBe('');
  });

  it('recovers once the input is valid again', () => {
    type('pace', '5:30');
    type('distance', 'wat');
    type('distance', '10');
    expect(field('time').value).toBe('55:00');
  });

  it('survives an empty field', () => {
    type('pace', '5:30');
    type('pace', '');
    expect(field('time').value).toBe('');
  });
});

describe('dispose', () => {
  it('stops recalculating', () => {
    type('pace', '5:30');
    type('distance', '10');
    dispose();
    type('distance', '20');
    expect(field('time').value).toBe('55:00');
  });
});
