import type { Contact, Db, Directory, LabeledValue } from '../types';
import { uid } from './util';

const DB_KEY = 'contactSheet.db.v2';
const LEGACY_CONTACTS = 'contactSheet.contacts.v1';
const META_KEY = 'contactSheet.sync.v1';
const SEL_KEY = 'contactSheet.selected.v1';

/** Reserved sync row id for directories (lives in the contacts table as JSON). */
export const DIRS_SYNC_ID = '__cs_directories__';

type SyncMeta = {
  owner: string | null;
  pending: Record<string, number>;
  cursor: string | null;
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
  return { version: 2, contacts: [], directories: [] };
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
  const parsed = readJSON<Db | null>(DB_KEY, null);
  if (parsed?.version === 2 && Array.isArray(parsed.contacts)) {
    return {
      version: 2,
      contacts: parsed.contacts
        .filter((c) => c && c.id !== DIRS_SYNC_ID)
        .map((c) => normalizeContact({ ...c, updated: c.updated || Date.now() })),
      directories: Array.isArray(parsed.directories) ? parsed.directories : [],
    };
  }
  const contacts = migrateLegacy().filter((c) => c.id !== DIRS_SYNC_ID);
  const db: Db = { version: 2, contacts, directories: [] };
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

export type PendingChange = { id: string; stamp: number; contact: Contact | null; directories?: Directory[] | null };

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
  upsert(c: Partial<Contact> & { id?: string }): Contact {
    const n = normalizeContact(c);
    const contacts = [...db.contacts];
    const i = contacts.findIndex((x) => x.id === n.id);
    if (i >= 0) {
      n.created = contacts[i].created;
      contacts[i] = n;
    } else contacts.push(n);
    commit({ ...db, contacts }, [n.id]);
    return n;
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
    const parsed = JSON.parse(json) as Db | Contact[];
    if (Array.isArray(parsed)) {
      const before = db.contacts.map((c) => c.id);
      const contacts = parsed.map((c) => normalizeContact(c));
      commit({ version: 2, contacts, directories: db.directories }, [...new Set([...before, ...contacts.map((c) => c.id)])], true);
      return { contacts: contacts.length, directories: db.directories.length };
    }
    if (parsed?.version === 2) {
      const before = db.contacts.map((c) => c.id);
      const contacts = (parsed.contacts || []).map((c) => normalizeContact(c));
      const directories = parsed.directories || [];
      commit({ version: 2, contacts, directories }, [...new Set([...before, ...contacts.map((c) => c.id)])], true);
      return { contacts: contacts.length, directories: directories.length };
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
        return { id, stamp, contact: null, directories: db.directories };
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
    let dirsTouched = false;

    for (const r of rows) {
      if (meta.pending[r.id]) continue;
      if (r.id === DIRS_SYNC_ID) {
        if (r.deleted) {
          directories = [];
          dirsTouched = true;
          changed++;
        } else if (Array.isArray(r.data?.directories)) {
          directories = r.data.directories as Directory[];
          dirsTouched = true;
          changed++;
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
        if (i >= 0) contacts[i] = c;
        else contacts.push(c);
        changed++;
      }
    }

    if (cursor) meta.cursor = cursor;
    if (changed) {
      db = { version: 2, contacts, directories };
      persistDb(db);
      persistMeta();
      emit();
    } else if (cursor) {
      persistMeta();
    }
    void dirsTouched;
    return changed;
  },
  resetForOwner(owner: string | null, { keepContacts = false }: { keepContacts?: boolean } = {}) {
    if (!keepContacts) db = emptyDb();
    meta = { owner, pending: {}, cursor: null };
    if (keepContacts) {
      const now = Date.now();
      for (const c of db.contacts) meta.pending[c.id] = now;
      meta.pending[DIRS_SYNC_ID] = now;
    }
    persistDb(db);
    persistMeta();
    emit();
  },
};
