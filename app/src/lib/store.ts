import { useSyncExternalStore } from 'react';
import type { Activity, ActivityType, Customer, Db, TagGroup } from '../types';
import { starterTagGroups, sampleCustomers } from './starter';
import { uid } from './util';

// Local-first store: the whole database lives on the device (localStorage) so the app
// works with no signal. Cloud sync plugs in on top of this in a later milestone.
const KEY = 'canopy.db.v1';

function fresh(): Db {
  return {
    version: 1,
    customers: [],
    tagGroups: starterTagGroups(),
    activities: [],
    settings: { businessName: 'Advanced Tree Service', yourName: '', updatedAt: Date.now() },
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return fresh();
}

let db: Db = load();
const listeners = new Set<() => void>();

function commit(next: Db) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Could not save. This device may be out of storage space.', e);
  }
  listeners.forEach((l) => l());
}

export function useDb(): Db {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => db,
  );
}

export const getDb = () => db;

// ---------- helpers ----------

export function stageGroup(d: Db = db): TagGroup | undefined {
  return d.tagGroups.find((g) => g.pipeline);
}

export function stageOf(c: Customer, d: Db = db) {
  const g = stageGroup(d);
  return g?.tags.find((t) => c.tagIds.includes(t.id));
}

export function tagById(id: string, d: Db = db) {
  for (const g of d.tagGroups) {
    const t = g.tags.find((x) => x.id === id);
    if (t) return { tag: t, group: g };
  }
  return undefined;
}

function activity(customerId: string, type: ActivityType, body: string): Activity {
  const now = Date.now();
  return { id: uid(), customerId, type, body, at: now, updatedAt: now };
}

// ---------- customers ----------

export function saveCustomer(c: Customer): Customer {
  const now = Date.now();
  const exists = db.customers.some((x) => x.id === c.id);
  const next = { ...c, updatedAt: now, createdAt: c.createdAt || now };
  commit({
    ...db,
    customers: exists ? db.customers.map((x) => (x.id === c.id ? next : x)) : [...db.customers, next],
    activities: exists ? db.activities : [...db.activities, activity(c.id, 'created', 'Added')],
  });
  return next;
}

export function deleteCustomer(id: string) {
  commit({ ...db, customers: db.customers.filter((c) => c.id !== id), activities: db.activities.filter((a) => a.customerId !== id) });
}

export function newCustomer(partial: Partial<Customer> = {}): Customer {
  return {
    id: uid(), first: '', last: '', company: '', phones: [], emails: [], properties: [],
    tagIds: [], notes: '', createdAt: 0, updatedAt: 0, ...partial,
  };
}

// Toggle a tag, respecting "pick one" groups. Stage changes are logged on the timeline.
export function toggleTag(customerId: string, tagId: string) {
  const found = tagById(tagId);
  if (!found) return;
  const { group, tag } = found;
  const acts: Activity[] = [];
  const customers = db.customers.map((c) => {
    if (c.id !== customerId) return c;
    let tagIds = c.tagIds;
    if (tagIds.includes(tagId)) {
      tagIds = tagIds.filter((t) => t !== tagId);
    } else {
      if (group.mode === 'one') tagIds = tagIds.filter((t) => !group.tags.some((gt) => gt.id === t));
      tagIds = [...tagIds, tagId];
      if (group.pipeline) acts.push(activity(c.id, 'stage', `Stage → ${tag.name}`));
    }
    return { ...c, tagIds, updatedAt: Date.now() };
  });
  commit({ ...db, customers, activities: [...db.activities, ...acts] });
}

// Create a new tag in a group that allows it (e.g. Job flags) and put it on the customer.
export function addNewTag(customerId: string, groupId: string, name: string) {
  const group = db.tagGroups.find((g) => g.id === groupId);
  if (!group || !name.trim()) return;
  const existing = group.tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
  const tag = existing || { id: `${groupId}-${uid().slice(0, 8)}`, name: name.trim() };
  const tagGroups = existing ? db.tagGroups : db.tagGroups.map((g) => (g.id === groupId ? { ...g, tags: [...g.tags, tag], updatedAt: Date.now() } : g));
  commit({
    ...db,
    tagGroups,
    customers: db.customers.map((c) => (c.id === customerId && !c.tagIds.includes(tag.id) ? { ...c, tagIds: [...c.tagIds, tag.id], updatedAt: Date.now() } : c)),
  });
}

export function logActivity(customerId: string, type: ActivityType, body: string) {
  commit({ ...db, activities: [...db.activities, activity(customerId, type, body)] });
}

// ---------- bulk ----------

function dupeKey(c: Customer) {
  const name = [c.first, c.last, c.company].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const phone = c.phones[0]?.value.replace(/\D/g, '').slice(-10) || '';
  return name + '|' + (phone || c.emails[0]?.value.toLowerCase() || '');
}

export function importCustomers(list: Customer[], extraTagIds: string[] = []) {
  const seen = new Set(db.customers.map(dupeKey));
  const added: Customer[] = [];
  let skipped = 0;
  for (const c of list) {
    const k = dupeKey(c);
    if (seen.has(k)) { skipped++; continue; }
    seen.add(k);
    added.push({ ...c, tagIds: [...new Set([...c.tagIds, ...extraTagIds])] });
  }
  commit({
    ...db,
    customers: [...db.customers, ...added],
    activities: [...db.activities, ...added.map((c) => ({ ...activity(c.id, 'imported', c.sample ? 'Sample customer' : 'Imported from contact file'), at: c.sample ? c.createdAt : Date.now() }))],
  });
  return { added: added.length, skipped };
}

export function loadSamples() {
  importCustomers(sampleCustomers());
}

export function clearSamples() {
  const ids = new Set(db.customers.filter((c) => c.sample).map((c) => c.id));
  commit({ ...db, customers: db.customers.filter((c) => !ids.has(c.id)), activities: db.activities.filter((a) => !ids.has(a.customerId)) });
}

export function replaceDb(next: Db) {
  commit({ ...fresh(), ...next });
}
