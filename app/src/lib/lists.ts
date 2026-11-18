import type { Customer, Db, Rule, SmartList } from '../types';
import { today } from './dates';

const DAY = 86400000;

export function starterSmartLists(): SmartList[] {
  const now = Date.now();
  const l = (id: string, name: string, why: string, rules: Rule[], pinned = false): SmartList => ({ id, name, why, rules, pinned, updatedAt: now });
  return [
    l('sl-cold', 'Estimates going cold', 'Work you already quoted that is slipping away.', [{ type: 'stageFor', stageId: 'stage-est-sent', days: 7 }], true),
    l('sl-review', 'Ask for a review', 'Finished jobs where nobody has asked for a review yet.', [{ type: 'tag', tagId: 'stage-complete' }, { type: 'tag', tagId: 'flags-review-asked', not: true }], true),
    l('sl-annual', 'Annual trim due', 'Annual customers whose last job was 11+ months ago.', [{ type: 'tag', tagId: 'flags-annual-customer' }, { type: 'lastJob', days: 330 }]),
    l('sl-newleads', 'New leads not contacted', 'New leads with no text, call or note in 2 days.', [{ type: 'tag', tagId: 'stage-new' }, { type: 'noContact', days: 2 }]),
    l('sl-dormant', 'Dormant-season pitch', 'Past customers who have had trimming done: good for a winter pruning text.', [{ type: 'tag', tagId: 'stage-past' }, { type: 'tag', tagId: 'services-trim-prune' }]),
  ];
}

// Facts about each customer that rules need, worked out once per render.
export function customerFacts(db: Db) {
  const stageAt = new Map<string, number>();
  const contactAt = new Map<string, number>();
  for (const a of db.activities) {
    if (a.type === 'stage' || a.type === 'created' || a.type === 'imported') stageAt.set(a.customerId, Math.max(stageAt.get(a.customerId) || 0, a.at));
    if (a.type === 'text' || a.type === 'call' || a.type === 'note') contactAt.set(a.customerId, Math.max(contactAt.get(a.customerId) || 0, a.at));
  }
  const lastJob = new Map<string, string>();
  for (const j of db.jobs) {
    if (j.kind === 'job' && j.status === 'done' && (lastJob.get(j.customerId) || '') < j.date) lastJob.set(j.customerId, j.date);
  }
  return { stageAt, contactAt, lastJob };
}
export type Facts = ReturnType<typeof customerFacts>;

function matches(c: Customer, r: Rule, f: Facts): boolean {
  const now = Date.now();
  switch (r.type) {
    case 'tag': return c.tagIds.includes(r.tagId) !== !!r.not;
    case 'stageFor': return c.tagIds.includes(r.stageId) && now - (f.stageAt.get(c.id) || c.createdAt) >= r.days * DAY;
    case 'noContact': return now - (f.contactAt.get(c.id) || c.createdAt) >= r.days * DAY;
    case 'lastJob': {
      const d = f.lastJob.get(c.id);
      return !!d && now - new Date(d + 'T00:00').getTime() >= r.days * DAY;
    }
    case 'followUpDue': return !!c.followUp && c.followUp.date <= today();
  }
}

export function runList(list: SmartList, db: Db, facts: Facts = customerFacts(db)): Customer[] {
  if (!list.rules.length) return [];
  return db.customers.filter((c) => list.rules.every((r) => matches(c, r, facts)));
}

export function describeRule(r: Rule, db: Db): string {
  const tag = (id: string) => db.tagGroups.flatMap((g) => g.tags).find((t) => t.id === id)?.name || 'a deleted tag';
  switch (r.type) {
    case 'tag': return r.not ? `not tagged ${tag(r.tagId)}` : `tagged ${tag(r.tagId)}`;
    case 'stageFor': return `in ${tag(r.stageId)} for ${r.days}+ days`;
    case 'noContact': return `no contact in ${r.days}+ days`;
    case 'lastJob': return `last job ${r.days}+ days ago`;
    case 'followUpDue': return 'follow-up due';
  }
}
