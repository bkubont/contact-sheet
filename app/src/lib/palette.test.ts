import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_KEYS, colorForName, nearestColor, paletteCss } from './palette';

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('palette', () => {
  it.each(PALETTE_KEYS)('%s chip text is readable (AA) in light and dark', (k) => {
    expect(contrast(PALETTE[k].light.ink, PALETTE[k].light.tint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTE[k].dark.ink, PALETTE[k].dark.tint)).toBeGreaterThanOrEqual(4.5);
  });

  it('maps the old category colors to sensible new ones', () => {
    expect(nearestColor('#B45309')).toBe('terracotta'); // old Family
    expect(nearestColor('#64748B')).toBe('stone'); // old Other
    expect(nearestColor('#0F766E')).toBe('teal');
    expect(nearestColor('#1E3A8A')).toBe('denim'); // old Work
    expect(nearestColor('#1D4ED8')).toBe('lavender'); // old Community
    expect(nearestColor('#D97706')).toBe('sand'); // old Friends
    expect(nearestColor('#2a9d8f')).toBe('teal'); // a custom color goes to the nearest
    expect(nearestColor('sage')).toBe('sage');
    expect(nearestColor('not a color', 'denim')).toBe('denim');
  });

  it('gives an ungrouped tag the same color every time, ignoring case', () => {
    expect(colorForName('Golf')).toBe(colorForName(' golf '));
    expect(PALETTE_KEYS).toContain(colorForName('Book club'));
  });

  it('writes CSS for light, device-dark and chosen-dark', () => {
    const css = paletteCss();
    expect(css).toContain('[data-color="sage"]{--c-dot:#6f9a6b');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="dark"] [data-color="sage"]');
  });
});
