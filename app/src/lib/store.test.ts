import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The store reads localStorage when it loads, so each test seeds storage and imports a fresh copy. */
function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    dump: () => Object.fromEntries(m),
  };
}

async function loadStore(saved?: unknown) {
  vi.resetModules();
  const storage = memoryStorage(saved ? { 'contactSheet.db.v2': JSON.stringify(saved) } : {});
  vi.stubGlobal('localStorage', storage);
  const mod = await import('./store');
  return { Store: mod.Store, storage };
}

const contact = (id: string, tags: string[], category = '') => ({
  id, first: id, last: '', company: '', title: '', phones: [], emails: [], address: '', birthday: '', notes: '', tags, category, created: 1, updated: 1,
});

// A save from before colors were keys: hex category colors, groups without a color.
const oldSave = {
  version: 3,
  contacts: [contact('a', ['Spouse', 'Golf'], 'cat-family'), contact('b', ['School'], 'cat-work')],
  directories: [],
  categories: [
    { id: 'cat-family', name: 'Family', color: '#B45309' },
    { id: 'cat-work', name: 'Work', color: '#1E3A8A' },
    { id: 'cat-custom', name: 'Club', color: '#2a9d8f' },
  ],
  tagGroups: [
    { id: 'g1', name: 'Relationship', tags: ['Spouse', 'Friend'] },
    { id: 'g2', name: 'Circle', tags: ['School'] },
  ],
};

describe('colors in saved data', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('converts old hex category colors to colors from the set', async () => {
    const { Store } = await loadStore(oldSave);
    expect(Store.categories().map((c) => [c.name, c.color])).toEqual([
      ['Family', 'terracotta'],
      ['Work', 'denim'],
      ['Club', 'teal'],
    ]);
    expect(Store.categoryColor('cat-family')).toBe('terracotta');
    expect(Store.categoryColor('missing')).toBe('stone');
  });

  it('gives groups without a color one in order, and tags take their group color', async () => {
    const { Store } = await loadStore(oldSave);
    expect(Store.tagGroups().map((g) => g.color)).toEqual(['rose', 'sage']);
    expect(Store.tagColor('Spouse')).toBe('rose');
    expect(Store.tagColor('spouse')).toBe('rose');
    expect(Store.tagColor('School')).toBe('sage');
  });

  it('colors an ungrouped tag from its name, the same way every time', async () => {
    const { Store } = await loadStore(oldSave);
    const { colorForName } = await import('./palette');
    expect(Store.tagColor('Golf')).toBe(colorForName('Golf'));
  });

  it('keeps a chosen group color when saved and loaded again', async () => {
    const first = await loadStore(oldSave);
    const g = first.Store.tagGroups()[0];
    first.Store.upsertTagGroup({ ...g, color: 'plum' });
    const saved = JSON.parse(first.storage.dump()['contactSheet.db.v2']);
    const second = await loadStore(saved);
    expect(second.Store.tagColor('Friend')).toBe('plum');
  });

  it('renaming a tag keeps it in its group, so it keeps its color', async () => {
    const { Store } = await loadStore(oldSave);
    Store.renameTag('Spouse', 'Partner');
    expect(Store.tagGroups()[0].tags).toContain('Partner');
    expect(Store.tagColor('Partner')).toBe('rose');
  });

  it('new installs start with distinct category and group colors', async () => {
    const { Store } = await loadStore();
    const cats = Store.categories().map((c) => c.color);
    const groups = Store.tagGroups().map((g) => g.color);
    expect(new Set(cats).size).toBe(cats.length);
    expect(new Set(groups).size).toBe(groups.length);
    expect(cats).not.toContain(Store.nextColor(cats));
  });
});
