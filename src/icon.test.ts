import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function iconHref(): string {
  const match = html.match(/<link rel="icon" href="([^"]+)"/);
  expect(match).not.toBeNull();
  return match![1];
}

/**
 * The tab icon is an inline SVG data URI, which costs no request but is easy to
 * break silently: one unescaped angle bracket and the browser drops the icon
 * without saying anything. Nothing else in the app would fail.
 */
describe('the tab icon', () => {
  it('is an SVG data URI', () => {
    expect(iconHref().startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('escapes every character that would end the attribute or the URI', () => {
    const body = iconHref().slice('data:image/svg+xml,'.length);
    // Raw <, > and # would be parsed as markup, or as a fragment identifier
    // that truncates the image at the first colour.
    expect(body).not.toMatch(/[<>#"]/);
  });

  it('decodes to a complete SVG', () => {
    const svg = decodeURIComponent(iconHref().slice('data:image/svg+xml,'.length));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"'.replace(/"/g, "'"));
  });

  it('draws a runner on the bib blue rather than a bare square', () => {
    const svg = decodeURIComponent(iconHref().slice('data:image/svg+xml,'.length));
    expect(svg).toContain('#1749c8');
    // Head, plus the strokes that make up the limbs and the speed lines.
    expect(svg).toContain('<circle');
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('points iOS at a PNG, which is all it will accept for a home screen', () => {
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  });
});
