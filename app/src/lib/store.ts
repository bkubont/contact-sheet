import type { CanopyLink, CategoryDef, Contact, Db, Directory, LabeledValue, TagGroup } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_TAG_GROUPS } from '../types';
import { uid } from './util';
import { colorForName, isColorKey, nearestColor, PALETTE_KEYS, type ColorKey } from './palette';

const DB_KEY = 'contactSheet.db.v2';
const LEGACY_CONTACTS = 'contactSheet.contacts.v1';
const META_KEY = 'contactSheet.sync.v1';
const SEL_KEY = 'contactSheet.selected.v1';

/** Reserved sync row id for directories + taxonomy (lives in the contacts table as JSON). */
export const DIRS_SYNC_ID = '__cs_directories__';

type SyncMeta = {
  owner: string | null;
  pending: Record<string, number>;
  cursor: string | null;
};

export type TaxonomyPayload = {
  directories: Directory[];
  categories: CategoryDef[];
  tagGroups: TagGroup[];
};

function clean(s: unknown): string {
  return (s == null ? '' : String(s)).trim();
}

function list(arr: unknown): LabeledValue[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: { label?: string; value?: string }) => ({
      label: clean(x.label) || 'other',
      value: clean(x.value),
    }))
    .filter((x) => x.value);
}

function normalizeCanopy(l: unknown): CanopyLink | null {
  const x = l as Partial<CanopyLink> | null | undefined;
  if (!x || !clean(x.orgId) || !clean(x.customerId)) return null;
  return { orgId: clean(x.orgId), customerId: clean(x.customerId), name: clean(x.name) };
}

export function normalizeContact(c: Partial<Contact> & { id?: string }): Contact {
  const tags = [...new Set((c.tags || []).map(clean).filter(Boolean))];
  return {
    id: c.id || uid(),
    first: clean(c.first),
    last: clean(c.last),
    company: clean(c.company),
    title: clean(c.title),
    phones: list(c.phones),
    emails: list(c.emails),
    address: clean(c.address),
    birthday: clean(c.birthday),
    notes: clean(c.notes),
    tags,
    category: clean(c.category),
    canopy: normalizeCanopy(c.canopy),
    created: c.created || Date.now(),
    updated: Date.now(),
  };
}

export function displayName(c: Contact): string {
  const n = [c.first, c.last].filter(Boolean).join(' ');
  return n || c.company || c.emails[0]?.value || c.phones[0]?.value || 'No name';
}

function dupeKey(c: Contact): string {
  const name = [c.first, c.last].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const phone = c.phones[0] ? c.phones[0].value.replace(/\D/g, '').slice(-10) : '';
  const email = c.emails[0] ? c.emails[0].value.toLowerCase() : '';
  return name + '|' + (phone || email || c.company.toLowerCase());
}

function emptyDb(): Db {
  return {
    version: 3,
    contacts: [],
    directories: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    tagGroups: DEFAULT_TAG_GROUPS.map((g) => ({ ...g, tags: [...g.tags] })),
  };
}

function normalizeCategory(c: Partial<CategoryDef> & { id?: string; name?: string }): CategoryDef {
  return {
    id: c.id || uid(),
    name: clean(c.name) || 'Untitled',
    color: nearestColor(clean(c.color), 'stone'),
  };
}

/** Colors handed to tag groups that don't have one yet (older saves), in order. */
const GROUP_COLORS: ColorKey[] = ['rose', 'sage', 'lavender', 'teal', 'sand', 'denim', 'olive', 'plum', 'terracotta', 'stone'];

function normalizeTagGroup(g: Partial<TagGroup> & { id?: string; name?: string }, index = 0): TagGroup {
  return {
    id: g.id || uid(),
    name: clean(g.name) || 'Untitled',
    tags: [...new Set((g.tags || []).map(clean).filter(Boolean))],
    color: isColorKey(g.color) ? g.color : GROUP_COLORS[index % GROUP_COLORS.length],
  };
}

function resolveCategories(raw: Record<string, unknown>): CategoryDef[] {
  // Absent key (v2 / incomplete) → seed defaults. Explicit [] must stay empty.
  if (!('categories' in raw) || raw.categories == null) {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  if (!Array.isArray(raw.categories)) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  return (raw.categories as CategoryDef[]).map((c) => normalizeCategory(c));
}

function resolveTagGroups(raw: Record<string, unknown>): TagGroup[] {
  if (!('tagGroups' in raw) || raw.tagGroups == null) {
    return DEFAULT_TAG_GROUPS.map((g) => ({ ...g, tags: [...g.tags] }));
  }
  if (!Array.isArray(raw.tagGroups)) {
    return DEFAULT_TAG_GROUPS.map((g) => ({ ...g, tags: [...g.tags] }));
  }
  return (raw.tagGroups as TagGroup[]).map((g, i) => normalizeTagGroup(g, i));
}

function migrateToV3(raw: Record<string, unknown>): Db {
  const contacts = Array.isArray(raw.contacts)
    ? (raw.contacts as Contact[])
        .filter((c) => c && c.id !== DIRS_SYNC_ID)
        .map((c) => normalizeContact({ ...c, updated: c.updated || Date.now() }))
    : [];
  const directories = Array.isArray(raw.directories) ? (raw.directories as Directory[]) : [];
  return {
    version: 3,
    contacts,
    directories,
    categories: resolveCategories(raw),
    tagGroups: resolveTagGroups(raw),
  };
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function migrateLegacy(): Contact[] {
  const list = readJSON<unknown[]>(LEGACY_CONTACTS, []);
  if (!Array.isArray(list)) return [];
  return list.map((c) => normalizeContact({ ...(c as Contact), updated: (c as Contact).updated || Date.now() }));
}

function loadDb(): Db {
  const parsed = readJSON<Record<string, unknown> | null>(DB_KEY, null);
  if (parsed && (parsed.version === 2 || parsed.version === 3) && Array.isArray(parsed.contacts)) {
    const db = migrateToV3(parsed);
    if (parsed.version !== 3) persistDb(db);
    return db;
  }
  const contacts = migrateLegacy().filter((c) => c.id !== DIRS_SYNC_ID);
  const db = emptyDb();
  db.contacts = contacts;
  if (contacts.length) persistDb(db);
  return db;
}

function persistDb(next: Db): boolean {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(next));
    return true;
  } catch (e) {
    alert('Could not save — this device may be out of storage space.\n\n' + (e as Error).message);
    return false;
  }
}

function persistMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

let db = loadDb();
let meta: SyncMeta = Object.assign(
  { owner: null as string | null, pending: {} as Record<string, number>, cursor: null as string | null },
  readJSON<Partial<SyncMeta>>(META_KEY, {}),
);

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

/** Save after a user edit and record pending sync ids. */
function commit(next: Db, changedIds: string[], directoriesChanged = false) {
  db = next;
  const now = Date.now();
  for (const id of changedIds) {
    if (id && id !== DIRS_SYNC_ID) meta.pending[id] = now;
  }
  if (directoriesChanged) meta.pending[DIRS_SYNC_ID] = now;
  persistDb(db);
  persistMeta();
  emit();
}

function taxonomyPayload(): TaxonomyPayload {
  return {
    directories: db.directories,
    categories: db.categories,
    tagGroups: db.tagGroups,
  };
}

if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

export function loadSelection(): Set<string> {
  try {
    const raw = localStorage.getItem(SEL_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveSelection(ids: Set<string>) {
  try {
    localStorage.setItem(SEL_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export type PendingChange = {
  id: string;
  stamp: number;
  contact: Contact | null;
  directories?: Directory[] | null;
  taxonomy?: TaxonomyPayload | null;
};

export const Store = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): Db {
    return db;
  },
  all(): Contact[] {
    return db.contacts;
  },
  get(id: string): Contact | undefined {
    return db.contacts.find((c) => c.id === id);
  },
  directories(): Directory[] {
    return db.directories;
  },
  getDirectory(id: string): Directory | undefined {
    return db.directories.find((d) => d.id === id);
  },
  categories(): CategoryDef[] {
    return db.categories;
  },
  tagGroups(): TagGroup[] {
    return db.tagGroups;
  },
  categoryName(id: string): string {
    return db.categories.find((c) => c.id === id)?.name || '';
  },
  categoryColor(id: string): ColorKey {
    return db.categories.find((c) => c.id === id)?.color || 'stone';
  },
  /** A tag's color: its group's color, or a steady color from its name when it's in no group. */
  tagColor(tag: string): ColorKey {
    const t = tag.trim().toLowerCase();
    const g = db.tagGroups.find((x) => x.tags.some((y) => y.toLowerCase() === t));
    return g ? g.color : colorForName(tag);
  },
  /** The next color for a new category or group: the first one not in use yet. */
  nextColor(used: ColorKey[]): ColorKey {
    return PALETTE_KEYS.find((k) => !used.includes(k)) || PALETTE_KEYS[used.length % PALETTE_KEYS.length];
  },
  upsert(c: Partial<Contact> & { id?: string }): Contact {
    const n = normalizeContact(c);
    const contacts = [...db.contacts];
    const i = contacts.findIndex((x) => x.id === n.id);
    if (i >= 0) {
      n.created = contacts[i].created;
      // Editing a contact never drops its Canopy link unless asked to.
      if (!('canopy' in c)) n.canopy = contacts[i].canopy ?? null;
      contacts[i] = n;
    } else contacts.push(n);
    commit({ ...db, contacts }, [n.id]);
    return n;
  },
  /** Link a contact to a Canopy Estimate customer, or unlink it (null). */
  setCanopy(id: string, link: CanopyLink | null) {
    const contacts = db.contacts.map((c) => (c.id === id ? { ...c, canopy: link, updated: Date.now() } : c));
    commit({ ...db, contacts }, [id]);
  },
  remove(id: string) {
    commit(
      {
        ...db,
        contacts: db.contacts.filter((c) => c.id !== id),
        directories: db.directories.map((d) =>
          d.mode === 'manual'
            ? { ...d, contactIds: d.contactIds.filter((x) => x !== id), updated: Date.now() }
            : d,
        ),
      },
      [id],
      true,
    );
  },
  removeMany(ids: string[]) {
    const set = new Set(ids);
    commit(
      {
        ...db,
        contacts: db.contacts.filter((c) => !set.has(c.id)),
        directories: db.directories.map((d) =>
          d.mode === 'manual'
            ? { ...d, contactIds: d.contactIds.filter((x) => !set.has(x)), updated: Date.now() }
            : d,
        ),
      },
      ids,
      true,
    );
  },
  addMany(list: Partial<Contact>[], { skipDupes = true, tag = '' }: { skipDupes?: boolean; tag?: string } = {}) {
    const seen = new Set(db.contacts.map(dupeKey));
    const contacts = [...db.contacts];
    const ids: string[] = [];
    let added = 0;
    let skipped = 0;
    for (const raw of list) {
      const c = normalizeContact({ ...raw, id: undefined });
      if (tag && !c.tags.includes(tag)) c.tags.push(tag);
      const k = dupeKey(c);
      if (skipDupes && seen.has(k)) {
        skipped++;
        continue;
      }
      seen.add(k);
      contacts.push(c);
      ids.push(c.id);
      added++;
    }
    commit({ ...db, contacts }, ids);
    return { added, skipped };
  },
  /** Dry-run import counts without writing. */
  previewImport(list: Partial<Contact>[], { skipDupes = true }: { skipDupes?: boolean } = {}) {
    const seen = new Set(db.contacts.map(dupeKey));
    let wouldAdd = 0;
    let wouldSkip = 0;
    const samples: Contact[] = [];
    for (const raw of list) {
      const c = normalizeContact({ ...raw, id: undefined });
      const k = dupeKey(c);
      if (skipDupes && seen.has(k)) {
        wouldSkip++;
        continue;
      }
      seen.add(k);
      wouldAdd++;
      if (samples.length < 5) samples.push(c);
    }
    return { total: list.length, wouldAdd, wouldSkip, samples };
  },
  replaceAll(list: Contact[]) {
    const before = db.contacts.map((c) => c.id);
    const contacts = list.map((c) => ({ ...normalizeContact(c), created: c.created || Date.now() }));
    commit({ ...db, contacts }, [...new Set([...before, ...contacts.map((c) => c.id)])]);
  },
  tagCounts(): [string, number][] {
    const m = new Map<string, number>();
    for (const c of db.contacts) for (const t of c.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
  },
  categoryCounts(): [string, number][] {
    const m = new Map<string, number>();
    for (const c of db.contacts) {
      if (c.category) m.set(c.category, (m.get(c.category) || 0) + 1);
    }
    return db.categories.map((cat) => [cat.id, m.get(cat.id) || 0] as [string, number]);
  },
  renameTag(from: string, to: string) {
    to = to.trim();
    if (!to) return;
    const ids: string[] = [];
    commit(
      {
        ...db,
        contacts: db.contacts.map((c) => {
          if (!c.tags.includes(from)) return c;
          ids.push(c.id);
          return {
            ...c,
            tags: [...new Set(c.tags.map((t) => (t === from ? to : t)).filter(Boolean))],
            updated: Date.now(),
          };
        }),
        directories: db.directories.map((d) => ({
          ...d,
          tags: d.tags.map((t) => (t === from ? to : t)),
          updated: d.tags.includes(from) ? Date.now() : d.updated,
        })),
        tagGroups: db.tagGroups.map((g) => ({
          ...g,
          tags: g.tags.map((t) => (t === from ? to : t)),
        })),
      },
      ids,
      true,
    );
  },
  deleteTag(tag: string) {
    const ids: string[] = [];
    commit(
      {
        ...db,
        contacts: db.contacts.map((c) => {
          if (!c.tags.includes(tag)) return c;
          ids.push(c.id);
          return { ...c, tags: c.tags.filter((t) => t !== tag), updated: Date.now() };
        }),
        directories: db.directories.map((d) => ({
          ...d,
          tags: d.tags.filter((t) => t !== tag),
          updated: d.tags.includes(tag) ? Date.now() : d.updated,
        })),
        tagGroups: db.tagGroups.map((g) => ({
          ...g,
          tags: g.tags.filter((t) => t !== tag),
        })),
      },
      ids,
      true,
    );
  },
  bulkTag(ids: string[], tag: string, add: boolean) {
    const set = new Set(ids);
    const changed: string[] = [];
    commit(
      {
        ...db,
        contacts: db.contacts.map((c) => {
          if (!set.has(c.id)) return c;
          const had = c.tags.includes(tag);
          if (add && !had) {
            changed.push(c.id);
            return { ...c, tags: [...c.tags, tag], updated: Date.now() };
          }
          if (!add && had) {
            changed.push(c.id);
            return { ...c, tags: c.tags.filter((t) => t !== tag), updated: Date.now() };
          }
          return c;
        }),
      },
      changed,
    );
  },
  bulkCategory(ids: string[], categoryId: string) {
    const set = new Set(ids);
    const changed: string[] = [];
    commit(
      {
        ...db,
        contacts: db.contacts.map((c) => {
          if (!set.has(c.id) || c.category === categoryId) return c;
          changed.push(c.id);
          return { ...c, category: categoryId, updated: Date.now() };
        }),
      },
      changed,
    );
  },
  upsertCategory(cat: CategoryDef): CategoryDef {
    const next = normalizeCategory(cat);
    const categories = [...db.categories];
    const i = categories.findIndex((c) => c.id === next.id);
    if (i >= 0) categories[i] = next;
    else categories.push(next);
    commit({ ...db, categories }, [], true);
    return next;
  },
  removeCategory(id: string) {
    commit(
      {
        ...db,
        categories: db.categories.filter((c) => c.id !== id),
        contacts: db.contacts.map((c) =>
          c.category === id ? { ...c, category: '', updated: Date.now() } : c,
        ),
      },
      db.contacts.filter((c) => c.category === id).map((c) => c.id),
      true,
    );
  },
  upsertTagGroup(group: TagGroup): TagGroup {
    const next = normalizeTagGroup(group);
    const tagGroups = [...db.tagGroups];
    const i = tagGroups.findIndex((g) => g.id === next.id);
    if (i >= 0) tagGroups[i] = next;
    else tagGroups.push(next);
    commit({ ...db, tagGroups }, [], true);
    return next;
  },
  removeTagGroup(id: string) {
    commit({ ...db, tagGroups: db.tagGroups.filter((g) => g.id !== id) }, [], true);
  },
  upsertDirectory(d: Directory): Directory {
    const directories = [...db.directories];
    const i = directories.findIndex((x) => x.id === d.id);
    const next = { ...d, updated: Date.now() };
    if (i >= 0) directories[i] = next;
    else directories.push(next);
    commit({ ...db, directories }, [], true);
    return next;
  },
  removeDirectory(id: string) {
    commit({ ...db, directories: db.directories.filter((d) => d.id !== id) }, [], true);
  },
  membersOf(dir: Directory): Contact[] {
    if (dir.mode === 'manual') {
      const set = new Set(dir.contactIds);
      return db.contacts.filter((c) => set.has(c.id));
    }
    if (!dir.tags.length) return [];
    return db.contacts.filter((c) => {
      if (dir.match === 'all') return dir.tags.every((t) => c.tags.includes(t));
      return dir.tags.some((t) => c.tags.includes(t));
    });
  },
  displayName,
  exportBackup(): string {
    return JSON.stringify(db, null, 2);
  },
  importBackup(json: string) {
    const parsed = JSON.parse(json) as Db | Contact[] | Record<string, unknown>;
    if (Array.isArray(parsed)) {
      const before = db.contacts.map((c) => c.id);
      const contacts = parsed.map((c) => normalizeContact(c));
      commit(
        { ...db, version: 3, contacts },
        [...new Set([...before, ...contacts.map((c) => c.id)])],
        true,
      );
      return { contacts: contacts.length, directories: db.directories.length };
    }
    if (parsed && (parsed.version === 2 || parsed.version === 3)) {
      const before = db.contacts.map((c) => c.id);
      const next = migrateToV3(parsed as Record<string, unknown>);
      commit(next, [...new Set([...before, ...next.contacts.map((c) => c.id)])], true);
      return { contacts: next.contacts.length, directories: next.directories.length };
    }
    throw new Error('Unrecognized backup format');
  },
  wipe() {
    const before = db.contacts.map((c) => c.id);
    commit(emptyDb(), before, true);
  },

  // ---- sync ----
  get owner() {
    return meta.owner;
  },
  get cursor() {
    return meta.cursor;
  },
  pendingChanges(): PendingChange[] {
    return Object.entries(meta.pending).map(([id, stamp]) => {
      if (id === DIRS_SYNC_ID) {
        const tax = taxonomyPayload();
        return { id, stamp, contact: null, directories: tax.directories, taxonomy: tax };
      }
      return { id, stamp, contact: this.get(id) || null };
    });
  },
  markUploaded(done: { id: string; stamp: number }[]) {
    for (const { id, stamp } of done) {
      if (meta.pending[id] === stamp) delete meta.pending[id];
    }
    persistMeta();
  },
  markAllPending() {
    const now = Date.now();
    for (const c of db.contacts) meta.pending[c.id] = now;
    meta.pending[DIRS_SYNC_ID] = now;
    persistMeta();
  },
  applyRemote(
    rows: { id: string; data: Record<string, unknown>; deleted: boolean; updated_at?: string }[],
    cursor: string | null,
  ) {
    let changed = 0;
    let contacts = [...db.contacts];
    let directories = db.directories;
    let categories = db.categories;
    let tagGroups = db.tagGroups;

    for (const r of rows) {
      if (meta.pending[r.id]) continue;
      if (r.id === DIRS_SYNC_ID) {
        if (r.deleted) {
          if (directories.length || categories.length || tagGroups.length) {
            directories = [];
            categories = [];
            tagGroups = [];
            changed++;
          }
        } else {
          if (Array.isArray(r.data?.directories)) {
            const incoming = r.data.directories as Directory[];
            if (JSON.stringify(incoming) !== JSON.stringify(directories)) {
              directories = incoming;
              changed++;
            }
          }
          if (Array.isArray(r.data?.categories)) {
            const incoming = (r.data.categories as CategoryDef[]).map((c) => normalizeCategory(c));
            if (JSON.stringify(incoming) !== JSON.stringify(categories)) {
              categories = incoming;
              changed++;
            }
          }
          if (Array.isArray(r.data?.tagGroups)) {
            const incoming = (r.data.tagGroups as TagGroup[]).map((g, i) => normalizeTagGroup(g, i));
            if (JSON.stringify(incoming) !== JSON.stringify(tagGroups)) {
              tagGroups = incoming;
              changed++;
            }
          }
        }
        continue;
      }
      const i = contacts.findIndex((c) => c.id === r.id);
      if (r.deleted) {
        if (i >= 0) {
          contacts.splice(i, 1);
          changed++;
        }
      } else {
        const c = {
          ...normalizeContact({ ...(r.data as Partial<Contact>), id: r.id }),
          created: (r.data.created as number) || Date.now(),
          updated: (r.data.updated as number) || Date.now(),
        };
        if (i >= 0) {
          const prev = contacts[i];
          if (
            prev.updated === c.updated &&
            JSON.stringify({ ...prev, updated: 0 }) === JSON.stringify({ ...c, updated: 0 })
          ) {
            continue;
          }
          contacts[i] = c;
        } else contacts.push(c);
        changed++;
      }
    }

    if (cursor) meta.cursor = cursor;
    if (changed) {
      db = { version: 3, contacts, directories, categories, tagGroups };
      persistDb(db);
      persistMeta();
      emit();
    } else if (cursor) {
      persistMeta();
    }
    return changed;
  },
  resetForOwner(
    owner: string | null,
    { keepContacts = false, queueDirectories = true }: { keepContacts?: boolean; queueDirectories?: boolean } = {},
  ) {
    if (!keepContacts) db = emptyDb();
    meta = { owner, pending: {}, cursor: null };
    if (keepContacts) {
      const now = Date.now();
      for (const c of db.contacts) meta.pending[c.id] = now;
      if (queueDirectories) meta.pending[DIRS_SYNC_ID] = now;
    }
    persistDb(db);
    persistMeta();
    emit();
  },
  /** Merge local directories into current set by id (prefer newer `updated`). Queues dirs for upload. */
  mergeDirectories(local: Directory[]) {
    this.mergeTaxonomy({ directories: local, categories: [], tagGroups: [] });
  },
  /** Merge local directories + categories + tag groups after adopting an account. Queues taxonomy upload. */
  mergeTaxonomy(local: TaxonomyPayload) {
    const dirById = new Map(db.directories.map((d) => [d.id, d]));
    for (const d of local.directories) {
      const existing = dirById.get(d.id);
      if (!existing || (d.updated || 0) >= (existing.updated || 0)) dirById.set(d.id, d);
    }

    const catById = new Map(db.categories.map((c) => [c.id, c]));
    for (const c of local.categories) {
      // Local definitions win on id collision so device customizations survive the pull.
      catById.set(c.id, normalizeCategory(c));
    }

    const groupById = new Map(db.tagGroups.map((g) => [g.id, g]));
    for (const g of local.tagGroups) {
      const existing = groupById.get(g.id);
      if (!existing) {
        groupById.set(g.id, normalizeTagGroup(g));
      } else {
        groupById.set(
          g.id,
          normalizeTagGroup({
            id: g.id,
            name: g.name || existing.name,
            tags: [...new Set([...existing.tags, ...g.tags])],
            color: g.color || existing.color,
          }),
        );
      }
    }

    db = {
      ...db,
      directories: [...dirById.values()],
      categories: [...catById.values()],
      tagGroups: [...groupById.values()],
    };
    meta.pending[DIRS_SYNC_ID] = Date.now();
    persistDb(db);
    persistMeta();
    emit();
  },
  hasPending() {
    return Object.keys(meta.pending).length > 0;
  },
  clearPending(id: string) {
    delete meta.pending[id];
    persistMeta();
  },
};
