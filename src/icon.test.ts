import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ico = readFileSync(new URL('../public/favicon.ico', import.meta.url));

/** The inline SVG the browsers use. */
function svgHref(): string {
  const match = html.match(/<link rel="icon" type="image\/svg\+xml" href="([^"]+)"/);
  expect(match).not.toBeNull();
  return match![1];
}

function svgSource(): string {
  return decodeURIComponent(svgHref().slice('data:image/svg+xml,'.length));
}

/**
 * The tab icon is an inline SVG data URI, which costs no request but is easy to
 * break silently: one unescaped angle bracket and the browser drops the icon
 * without saying anything. Nothing else in the app would fail.
 */
describe('the tab icon', () => {
  it('is an SVG data URI', () => {
    expect(svgHref().startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('escapes every character that would end the attribute or the URI', () => {
    const body = svgHref().slice('data:image/svg+xml,'.length);
    // Raw <, > and # would be parsed as markup, or as a fragment identifier
    // that truncates the image at the first colour.
    expect(body).not.toMatch(/[<>#"]/);
  });

  it('decodes to a complete SVG', () => {
    const svg = svgSource();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"'.replace(/"/g, "'"));
  });

  it('draws the runner in the bib blue', () => {
    const svg = svgSource();
    expect(svg).toContain('#1749c8');
    // Head, plus the strokes that make up the limbs and the speed lines.
    expect(svg).toContain('<circle');
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('has no tile behind it — the figure is the mark', () => {
    expect(svgSource()).not.toContain('<rect');
  });

  /**
   * The bib blue on Chrome's dark tab strip is about 1.9:1 — a runner nobody
   * can see. The stylesheet lightens it there, so the colour must stay in CSS
   * rather than migrating onto the paths, where no media query could reach it.
   */
  it('lightens itself for a dark tab strip', () => {
    const svg = svgSource();
    expect(svg).toContain('prefers-color-scheme:dark');
    expect(svg).toContain('#a7bcf0');
    expect(svg).not.toMatch(/<path[^>]*stroke=/);
  });
});

/**
 * Search engines can't use the inline SVG: there is no URL to fetch, and a data
 * URI is not a file. Without a raster at a real path, Google shows its generic
 * globe instead — which is exactly what it did before this existed.
 */
describe('the icon crawlers can fetch', () => {
  it('is declared ahead of the inline one', () => {
    const icon = html.indexOf('<link rel="icon" href="/favicon.ico"');
    const svg = html.indexOf('<link rel="icon" type="image/svg+xml"');
    expect(icon).toBeGreaterThan(-1);
    expect(icon).toBeLessThan(svg);
  });

  it('sits at /favicon.ico, where Google looks without being told', () => {
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico" sizes="[^"]*48x48[^"]*"/);
  });

  it('is a real icon file, not an image renamed', () => {
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // 1 = icon
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(1);
  });

  it('carries the 48 px square Google asks for', () => {
    const count = ico.readUInt16LE(4);
    const widths = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + 16 * i));
    expect(widths).toContain(48);
  });

  it('points iOS at a PNG, which is all it will accept for a home screen', () => {
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  });
});
