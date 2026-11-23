/**
 * The color set for categories, tag groups and tags. Ten muted hues chosen to
 * sit beside the Romulus royal blue and gold without competing: no pure royal
 * blue (brand) and no metallic gold (accent). Each has a dot, a tint (chip
 * background) and an ink (chip text), for light and dark. Every ink-on-tint
 * pair meets WCAG AA (checked in palette.test.ts).
 */
export const PALETTE_KEYS = ['denim', 'teal', 'sage', 'olive', 'terracotta', 'rose', 'plum', 'lavender', 'sand', 'stone'] as const;
export type ColorKey = (typeof PALETTE_KEYS)[number];

type Swatch = { dot: string; tint: string; ink: string };
export const PALETTE: Record<ColorKey, { label: string; light: Swatch; dark: Swatch }> = {
  denim: { label: 'Denim', light: { dot: '#5b7db1', tint: '#e6edf7', ink: '#2e4c7d' }, dark: { dot: '#86a6db', tint: '#17243d', ink: '#c3d5f2' } },
  teal: { label: 'Teal', light: { dot: '#2f8f8a', tint: '#ddf1ef', ink: '#1d5e5a' }, dark: { dot: '#5fc1b8', tint: '#0f2e30', ink: '#a6e3dd' } },
  sage: { label: 'Sage', light: { dot: '#6f9a6b', tint: '#e6f0e3', ink: '#3e6339' }, dark: { dot: '#9bc395', tint: '#18291a', ink: '#cbe3c6' } },
  olive: { label: 'Olive', light: { dot: '#8a8b3c', tint: '#efefd9', ink: '#55561c' }, dark: { dot: '#c2c36a', tint: '#26270f', ink: '#e2e3a9' } },
  terracotta: { label: 'Terracotta', light: { dot: '#c0694a', tint: '#f8e6de', ink: '#8a3e24' }, dark: { dot: '#e39169', tint: '#33190f', ink: '#f4c4ac' } },
  rose: { label: 'Rose', light: { dot: '#c25d7e', tint: '#f8e3ea', ink: '#8c3554' }, dark: { dot: '#e487a5', tint: '#35152a', ink: '#f4bdd0' } },
  plum: { label: 'Plum', light: { dot: '#8e5a9b', tint: '#f0e5f3', ink: '#623a6c' }, dark: { dot: '#c597d3', tint: '#2a1a33', ink: '#e5cdee' } },
  lavender: { label: 'Lavender', light: { dot: '#7f7fc9', tint: '#ececf9', ink: '#4b4b94' }, dark: { dot: '#a9a9ec', tint: '#1d1d3d', ink: '#d4d4f7' } },
  sand: { label: 'Sand', light: { dot: '#b79b67', tint: '#f5eedf', ink: '#6a5430' }, dark: { dot: '#d9c08e', tint: '#2c2416', ink: '#eedfc0' } },
  stone: { label: 'Stone', light: { dot: '#8a8f98', tint: '#eeeff1', ink: '#4d525b' }, dark: { dot: '#a9aeb7', tint: '#1f232b', ink: '#d6d9de' } },
};

export function isColorKey(v: unknown): v is ColorKey {
  return typeof v === 'string' && (PALETTE_KEYS as readonly string[]).includes(v);
}

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The eight colors the old category picker offered, mapped so each lands on a different color. */
const OLD_PRESETS: Record<string, ColorKey> = {
  '#1e3a8a': 'denim', // Work
  '#1d4ed8': 'lavender', // Community
  '#d97706': 'sand', // Friends
  '#b45309': 'terracotta', // Family
  '#f59e0b': 'olive',
  '#0f766e': 'teal',
  '#7c3aed': 'plum',
  '#64748b': 'stone', // Other
};

/** Old categories stored a hex color; use the mapping above, else the closest color in the set. */
export function nearestColor(value: string, fallback: ColorKey = 'stone'): ColorKey {
  if (isColorKey(value)) return value;
  const preset = OLD_PRESETS[(value || '').trim().toLowerCase()];
  if (preset) return preset;
  const c = rgb(value || '');
  if (!c) return fallback;
  let best: ColorKey = fallback;
  let bestD = Infinity;
  for (const k of PALETTE_KEYS) {
    const p = rgb(PALETTE[k].light.dot)!;
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** A steady color for a tag that isn't in any group, from its name (same on every device). */
export function colorForName(name: string): ColorKey {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE_KEYS[h % PALETTE_KEYS.length];
}

/** Light-mode RGB of a color's dot, for the PDF. */
export function dotRgb(k: ColorKey): [number, number, number] {
  return rgb(PALETTE[k].light.dot)!;
}

/**
 * CSS for `[data-color="…"]`: sets --c-dot, --c-tint and --c-ink for light,
 * dark (device setting, unless Light was chosen) and a forced Dark choice.
 * Written once from this file so CSS and code can't drift apart.
 */
export function paletteCss(): string {
  const block = (mode: 'light' | 'dark', prefix: string) =>
    PALETTE_KEYS.map((k) => {
      const s = PALETTE[k][mode];
      return `${prefix}[data-color="${k}"]{--c-dot:${s.dot};--c-tint:${s.tint};--c-ink:${s.ink}}`;
    }).join('\n');
  return [
    block('light', ''),
    `@media (prefers-color-scheme: dark){\n${block('dark', ':root:not([data-theme="light"]) ')}\n}`,
    block('dark', ':root[data-theme="dark"] '),
  ].join('\n');
}

export function installPaletteCss() {
  if (typeof document === 'undefined' || document.getElementById('palette-css')) return;
  const el = document.createElement('style');
  el.id = 'palette-css';
  el.textContent = paletteCss();
  document.head.appendChild(el);
}
