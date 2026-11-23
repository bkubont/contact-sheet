/** Appearance: follow the device, or always light / always dark. Kept on this device only. */
export type Appearance = 'system' | 'light' | 'dark';

const KEY = 'contactSheet.appearance.v1';
const BAR = { light: '#faf8f3', dark: '#070e24' };

export function getAppearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private mode */
  }
  return 'system';
}

/** Put the choice on <html data-theme> and match the browser bar color. */
export function applyAppearance(a: Appearance = getAppearance()) {
  const root = document.documentElement;
  if (a === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', a);
  // The media-qualified theme-color tags follow the device; a fixed choice overrides both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('data-media') ?? m.getAttribute('media') ?? '';
    if (!m.hasAttribute('data-media')) m.setAttribute('data-media', media);
    if (a === 'system') {
      if (media) m.setAttribute('media', media);
      m.content = media.includes('dark') ? BAR.dark : BAR.light;
    } else {
      m.removeAttribute('media');
      m.content = BAR[a];
    }
  });
}

export function setAppearance(a: Appearance) {
  try {
    if (a === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, a);
  } catch {
    /* private mode: still applies for this visit */
  }
  applyAppearance(a);
}

export const APPEARANCE_LABEL: Record<Appearance, string> = { system: 'Match device', light: 'Light', dark: 'Dark' };
