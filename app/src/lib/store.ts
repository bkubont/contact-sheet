import type { Contact, Db, Directory, LabeledValue } from '../types';
import { uid } from './util';

const DB_KEY = 'contactSheet.db.v2';
const LEGACY_CONTACTS = 'contactSheet.contacts.v1';
const SEL_KEY = 'contactSheet.selected.v1';

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

function migrateLegacy(): Contact[] {
  try {
    const raw = localStorage.getItem(LEGACY_CONTACTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((c) => normalizeContact({ ...c, updated: c.updated || Date.now() }));
  } catch {
    return [];
  }
}

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed?.version === 2 && Array.isArray(parsed.contacts)) {
        return {
          version: 2,
          contacts: parsed.contacts.map((c) => normalizeContact({ ...c, updated: c.updated || Date.now() })),
          directories: Array.isArray(parsed.directories) ? parsed.directories : [],
        };
      }
    }
  } catch {
    /* fall through */
  }
  const contacts = migrateLegacy();
  const db: Db = { version: 2, contacts, directories: [] };
  if (contacts.length) persist(db);
  return db;
}

function persist(db: Db): boolean {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Keep legacy key in sync so older installs / backups stay compatible.
    localStorage.setItem(LEGACY_CONTACTS, JSON.stringify(db.contacts));
    return true;
  } catch (e) {
    alert('Could not save — this device may be out of storage space.\n\n' + (e as Error).message);
    return false;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

let db = loadDb();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

function commit(next: Db) {
  db = next;
  persist(db);
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
    commit({ ...db, contacts });
    return n;
  },
  remove(id: string) {
    commit({
      ...db,
      contacts: db.contacts.filter((c) => c.id !== id),
      directories: db.directories.map((d) =>
        d.mode === 'manual'
          ? { ...d, contactIds: d.contactIds.filter((x) => x !== id), updated: Date.now() }
          : d,
      ),
    });
  },
  addMany(list: Partial<Contact>[], { skipDupes = true, tag = '' }: { skipDupes?: boolean; tag?: string } = {}) {
    const seen = new Set(db.contacts.map(dupeKey));
    const contacts = [...db.contacts];
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
      added++;
    }
    commit({ ...db, contacts });
    return { added, skipped };
  },
  replaceAll(list: Contact[]) {
    commit({
      ...db,
      contacts: list.map((c) => ({ ...normalizeContact(c), created: c.created || Date.now() })),
    });
  },
  tagCounts(): [string, number][] {
    const m = new Map<string, number>();
    for (const c of db.contacts) for (const t of c.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
  },
  renameTag(from: string, to: string) {
    to = to.trim();
    if (!to) return;
    commit({
      ...db,
      contacts: db.contacts.map((c) => {
        if (!c.tags.includes(from)) return c;
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
    });
  },
  deleteTag(tag: string) {
    commit({
      ...db,
      contacts: db.contacts.map((c) => {
        if (!c.tags.includes(tag)) return c;
        return { ...c, tags: c.tags.filter((t) => t !== tag), updated: Date.now() };
      }),
      directories: db.directories.map((d) => ({
        ...d,
        tags: d.tags.filter((t) => t !== tag),
        updated: d.tags.includes(tag) ? Date.now() : d.updated,
      })),
    });
  },
  bulkTag(ids: string[], tag: string, add: boolean) {
    const set = new Set(ids);
    commit({
      ...db,
      contacts: db.contacts.map((c) => {
        if (!set.has(c.id)) return c;
        const had = c.tags.includes(tag);
        if (add && !had) return { ...c, tags: [...c.tags, tag], updated: Date.now() };
        if (!add && had) return { ...c, tags: c.tags.filter((t) => t !== tag), updated: Date.now() };
        return c;
      }),
    });
  },
  upsertDirectory(d: Directory): Directory {
    const directories = [...db.directories];
    const i = directories.findIndex((x) => x.id === d.id);
    const next = { ...d, updated: Date.now() };
    if (i >= 0) directories[i] = next;
    else directories.push(next);
    commit({ ...db, directories });
    return next;
  },
  removeDirectory(id: string) {
    commit({ ...db, directories: db.directories.filter((d) => d.id !== id) });
  },
  /** Resolve a directory to its current contact members. */
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
      commit({ version: 2, contacts: parsed.map((c) => normalizeContact(c)), directories: db.directories });
      return;
    }
    if (parsed?.version === 2) {
      commit({
        version: 2,
        contacts: (parsed.contacts || []).map((c) => normalizeContact(c)),
        directories: parsed.directories || [],
      });
      return;
    }
    throw new Error('Unrecognized backup format');
  },
  wipe() {
    commit(emptyDb());
  },
};
