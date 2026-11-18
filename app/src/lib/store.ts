import { useSyncExternalStore } from 'react';
import type { Activity, ActivityType, Customer, Db, FollowUp, Job, SmartList, Tag, TagGroup } from '../types';
import { starterSmartLists } from './lists';
import { starterTagGroups, sampleCustomers, sampleJobs } from './starter';
import { addDays, fmtDay, fmtTime, today, toMinutes } from './dates';
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
    jobs: [],
    smartLists: starterSmartLists(),
    settings: {
      businessName: 'Advanced Tree Service', yourName: '',
      crew: ['Me', 'Helper 1', 'Helper 2'],
      equipment: ['Bucket truck', 'Chipper', 'Stump grinder', 'Crane', 'Skid steer', 'Dump truck'],
      updatedAt: Date.now(),
    },
  };
}

// Bring data saved by an older version up to date without losing anything.
function migrate(d: Db): Db {
  const flags = d.tagGroups.find((g) => g.id === 'flags');
  if (flags && !flags.tags.some((t) => t.id === 'flags-review-asked')) {
    const at = flags.tags.findIndex((t) => t.id === 'flags-do-not-text');
    const tags = [...flags.tags];
    tags.splice(at < 0 ? tags.length : at, 0, { id: 'flags-review-asked', name: 'Review asked' });
    d = { ...d, tagGroups: d.tagGroups.map((g) => (g.id === 'flags' ? { ...g, tags } : g)) };
  }
  if (!Array.isArray(d.smartLists)) d = { ...d, smartLists: starterSmartLists() };
  return d;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = fresh();
      return migrate({ ...base, ...saved, settings: { ...base.settings, ...saved.settings } });
    }
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
  commit({ ...db, customers: db.customers.filter((c) => c.id !== id), activities: db.activities.filter((a) => a.customerId !== id), jobs: db.jobs.filter((j) => j.customerId !== id) });
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
      if (group.pipeline) {
        acts.push(activity(c.id, 'stage', `Stage → ${tag.name}`));
        return stageAutomation({ ...c, tagIds, updatedAt: Date.now() }, tagId, acts);
      }
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
  const customers = sampleCustomers();
  importCustomers(customers);
  commit({ ...db, jobs: [...db.jobs, ...sampleJobs(customers)] });
}

export function clearSamples() {
  const ids = new Set(db.customers.filter((c) => c.sample).map((c) => c.id));
  commit({
    ...db,
    customers: db.customers.filter((c) => !ids.has(c.id)),
    activities: db.activities.filter((a) => !ids.has(a.customerId)),
    jobs: db.jobs.filter((j) => !j.sample && !ids.has(j.customerId)),
  });
}

export function replaceDb(next: Db) {
  commit({ ...fresh(), ...next });
}

// ---------- settings ----------

export function updateSettings(patch: Partial<Db['settings']>) {
  commit({ ...db, settings: { ...db.settings, ...patch, updatedAt: Date.now() } });
}

// ---------- jobs & calendar ----------

export function jobDates(j: Job): string[] {
  const n = j.kind === 'job' ? Math.max(1, j.days) : 1;
  return Array.from({ length: n }, (_, i) => addDays(j.date, i));
}

export function jobsOn(date: string, d: Db = db): Job[] {
  return d.jobs
    .filter((j) => j.status !== 'cancelled' && jobDates(j).includes(date))
    .sort((a, b) => (a.start || '99').localeCompare(b.start || '99') || a.kind.localeCompare(b.kind));
}

// Same day, same crew member or same equipment, and the times overlap → double-booked.
export function conflictsFor(j: Job, d: Db = db): { job: Job; reasons: string[] }[] {
  if (j.status === 'cancelled') return [];
  const mine = new Set(jobDates(j));
  const span = (x: Job): [number, number] =>
    x.kind === 'job' || !x.start ? [0, 24 * 60] : [toMinutes(x.start), toMinutes(x.start) + (x.minutes || 60)];
  const [a0, a1] = span(j);
  const out: { job: Job; reasons: string[] }[] = [];
  for (const o of d.jobs) {
    if (o.id === j.id || o.status === 'cancelled') continue;
    if (!jobDates(o).some((x) => mine.has(x))) continue;
    const [b0, b1] = span(o);
    if (a0 >= b1 || b0 >= a1) continue;
    const reasons = [
      ...j.crew.filter((c) => o.crew.includes(c)),
      ...j.equipment.filter((e) => o.equipment.includes(e)),
    ];
    if (reasons.length) out.push({ job: o, reasons });
  }
  return out;
}

const STAGE_ORDER = ['stage-new', 'stage-est-set', 'stage-est-sent', 'stage-booked', 'stage-complete', 'stage-past'];

// Move a customer forward to a stage (never backwards) and log it.
function advanceStage(d: Db, customerId: string, stageId: string, why: string): Db {
  const sg = stageGroup(d);
  const tag = sg?.tags.find((t) => t.id === stageId);
  if (!sg || !tag) return d;
  const c = d.customers.find((x) => x.id === customerId);
  if (!c) return d;
  const current = sg.tags.find((t) => c.tagIds.includes(t.id));
  if (current && STAGE_ORDER.indexOf(current.id) >= STAGE_ORDER.indexOf(stageId)) return d;
  const tagIds = [...c.tagIds.filter((t) => !sg.tags.some((x) => x.id === t)), stageId];
  const acts = [activity(customerId, 'stage', `Stage → ${tag.name} (${why})`)];
  const updated = stageAutomation({ ...c, tagIds, updatedAt: Date.now() }, stageId, acts);
  return {
    ...d,
    customers: d.customers.map((x) => (x.id === customerId ? updated : x)),
    activities: [...d.activities, ...acts],
  };
}

export function saveJob(j: Job): Job {
  const now = Date.now();
  const isNew = !db.jobs.some((x) => x.id === j.id);
  const next: Job = { ...j, createdAt: j.createdAt || now, updatedAt: now };
  const when = `${fmtDay(next.date)}${next.start ? ' ' + fmtTime(next.start) : ''}`;
  let d: Db = {
    ...db,
    jobs: isNew ? [...db.jobs, next] : db.jobs.map((x) => (x.id === j.id ? next : x)),
    activities: [...db.activities, activity(j.customerId, 'note', `${isNew ? '' : 'Moved: '}${j.kind === 'estimate' ? 'Estimate' : 'Job'} ${isNew ? 'scheduled ' : ''}${when}${j.kind === 'job' && j.days > 1 ? ` (${j.days} days)` : ''}`)],
  };
  if (isNew) d = advanceStage(d, j.customerId, j.kind === 'estimate' ? 'stage-est-set' : 'stage-booked', 'scheduled');
  commit(d);
  return next;
}

export function setJobStatus(id: string, status: Job['status']) {
  const j = db.jobs.find((x) => x.id === id);
  if (!j) return;
  let d: Db = { ...db, jobs: db.jobs.map((x) => (x.id === id ? { ...x, status, updatedAt: Date.now() } : x)) };
  if (status === 'done') d = advanceStage(d, j.customerId, j.kind === 'estimate' ? 'stage-est-sent' : 'stage-complete', j.kind === 'estimate' ? 'estimate done' : 'job done');
  const label = status === 'done' ? (j.kind === 'estimate' ? 'Estimate visit done' : 'Job complete') : status === 'cancelled' ? `${j.kind === 'estimate' ? 'Estimate' : 'Job'} cancelled` : 'Re-opened';
  d = { ...d, activities: [...d.activities, activity(j.customerId, 'note', `${label} · ${fmtDay(j.date)}`)] };
  commit(d);
}

export function deleteJob(id: string) {
  commit({ ...db, jobs: db.jobs.filter((j) => j.id !== id) });
}

// ---------- follow-ups ----------

// Automations that run when a customer's stage changes.
function stageAutomation(c: Customer, stageId: string, acts: Activity[]): Customer {
  let followUp = c.followUp;
  if (followUp?.auto) followUp = undefined; // the old automatic reminder no longer applies
  const set = (days: number, note: string) => {
    if (followUp) return; // never overwrite one you set yourself
    followUp = { date: addDays(today(), days), note, auto: true };
    acts.push(activity(c.id, 'note', `Follow-up set for ${fmtDay(followUp.date)}: ${note}`));
  };
  if (stageId === 'stage-est-sent') set(5, 'Any questions on the estimate?');
  if (stageId === 'stage-complete') set(1, 'Ask for a review');
  return { ...c, followUp };
}

export function setFollowUp(customerId: string, followUp: FollowUp | undefined, logText?: string) {
  commit({
    ...db,
    customers: db.customers.map((c) => (c.id === customerId ? { ...c, followUp, updatedAt: Date.now() } : c)),
    activities: logText ? [...db.activities, activity(customerId, 'note', logText)] : db.activities,
  });
}

// ---------- smart lists ----------

export function saveSmartList(l: SmartList) {
  const next = { ...l, updatedAt: Date.now() };
  const exists = db.smartLists.some((x) => x.id === l.id);
  commit({ ...db, smartLists: exists ? db.smartLists.map((x) => (x.id === l.id ? next : x)) : [...db.smartLists, next] });
}

export function deleteSmartList(id: string) {
  commit({ ...db, smartLists: db.smartLists.filter((x) => x.id !== id) });
}

export function bulkTag(customerIds: string[], tagId: string, add: boolean) {
  const found = tagById(tagId);
  if (!found) return;
  const ids = new Set(customerIds);
  commit({
    ...db,
    customers: db.customers.map((c) => {
      if (!ids.has(c.id)) return c;
      let tagIds = c.tagIds.filter((t) => t !== tagId);
      if (add) {
        if (found.group.mode === 'one') tagIds = tagIds.filter((t) => !found.group.tags.some((x) => x.id === t));
        tagIds = [...tagIds, tagId];
      }
      return { ...c, tagIds, updatedAt: Date.now() };
    }),
  });
}

// ---------- tag editor ----------

function patchGroup(groupId: string, fn: (g: TagGroup) => TagGroup) {
  commit({ ...db, tagGroups: db.tagGroups.map((g) => (g.id === groupId ? { ...fn(g), updatedAt: Date.now() } : g)) });
}

export function renameGroup(groupId: string, name: string) {
  if (name.trim()) patchGroup(groupId, (g) => ({ ...g, name: name.trim() }));
}

export function addTag(groupId: string, name: string, color?: string): Tag | undefined {
  const g = db.tagGroups.find((x) => x.id === groupId);
  if (!g || !name.trim() || g.tags.some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) return undefined;
  const tag: Tag = { id: `${groupId}-${uid().slice(0, 8)}`, name: name.trim(), color };
  patchGroup(groupId, (x) => ({ ...x, tags: [...x.tags, tag] }));
  return tag;
}

export function updateTag(tagId: string, patch: Partial<Tag>) {
  const found = tagById(tagId);
  if (found) patchGroup(found.group.id, (g) => ({ ...g, tags: g.tags.map((t) => (t.id === tagId ? { ...t, ...patch, id: t.id } : t)) }));
}

export function moveTag(tagId: string, dir: -1 | 1) {
  const found = tagById(tagId);
  if (!found) return;
  patchGroup(found.group.id, (g) => {
    const tags = [...g.tags];
    const i = tags.findIndex((t) => t.id === tagId);
    const j = i + dir;
    if (j < 0 || j >= tags.length) return g;
    [tags[i], tags[j]] = [tags[j], tags[i]];
    return { ...g, tags };
  });
}

export function deleteTag(tagId: string) {
  const found = tagById(tagId);
  if (!found) return;
  commit({
    ...db,
    tagGroups: db.tagGroups.map((g) => (g.id === found.group.id ? { ...g, tags: g.tags.filter((t) => t.id !== tagId), updatedAt: Date.now() } : g)),
    customers: db.customers.map((c) => (c.tagIds.includes(tagId) ? { ...c, tagIds: c.tagIds.filter((t) => t !== tagId), updatedAt: Date.now() } : c)),
    smartLists: db.smartLists.map((l) => ({ ...l, rules: l.rules.filter((r) => !('tagId' in r && r.tagId === tagId) && !('stageId' in r && r.stageId === tagId)) })),
  });
}

export function addGroup(name: string, mode: 'one' | 'many'): TagGroup | undefined {
  if (!name.trim()) return undefined;
  const g: TagGroup = { id: `group-${uid().slice(0, 8)}`, name: name.trim(), mode, allowNew: mode === 'many', tags: [], updatedAt: Date.now() };
  commit({ ...db, tagGroups: [...db.tagGroups, g] });
  return g;
}

export function deleteGroup(groupId: string) {
  const g = db.tagGroups.find((x) => x.id === groupId);
  if (!g || g.pipeline) return;
  const ids = new Set(g.tags.map((t) => t.id));
  commit({
    ...db,
    tagGroups: db.tagGroups.filter((x) => x.id !== groupId),
    customers: db.customers.map((c) => (c.tagIds.some((t) => ids.has(t)) ? { ...c, tagIds: c.tagIds.filter((t) => !ids.has(t)), updatedAt: Date.now() } : c)),
    smartLists: db.smartLists.map((l) => ({ ...l, rules: l.rules.filter((r) => !('tagId' in r && ids.has(r.tagId))) })),
  });
}

export function tagCount(tagId: string, d: Db = db) {
  return d.customers.filter((c) => c.tagIds.includes(tagId)).length;
}
