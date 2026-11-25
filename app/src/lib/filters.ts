import type { Contact } from '../types';

export const UNTAGGED = '__untagged__';
export const UNCAT = '__uncategorized__';

/** What the Contacts list is narrowed to. Several categories and tags can be picked. */
export interface Filters {
  /** Category ids (or UNCAT). A contact matches if it's in any of them. */
  cats: string[];
  /** Tag names (or UNTAGGED). */
  tags: string[];
  /** Any: has at least one of the tags. All: has every one. */
  match: 'any' | 'all';
}

export const NO_FILTERS: Filters = { cats: [], tags: [], match: 'any' };

export function hasFilters(f: Filters) {
  return f.cats.length > 0 || f.tags.length > 0;
}

export function passesFilters(c: Contact, f: Filters): boolean {
  if (f.cats.length) {
    const ok = f.cats.some((id) => (id === UNCAT ? !c.category : c.category === id));
    if (!ok) return false;
  }
  if (f.tags.length) {
    const wantUntagged = f.tags.includes(UNTAGGED);
    const real = f.tags.filter((t) => t !== UNTAGGED);
    if (f.match === 'all') {
      if (wantUntagged && c.tags.length) return false;
      if (!real.every((t) => c.tags.includes(t))) return false;
    } else {
      const ok = (wantUntagged && !c.tags.length) || real.some((t) => c.tags.includes(t));
      if (!ok) return false;
    }
  }
  return true;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/**
 * Tri-state tag checklist for several selected people: each tag is on for
 * all of them, some of them, or none. Returns what to add and remove so the
 * final states hold. "some" means "leave as it is".
 */
export type TagState = 'all' | 'some' | 'none';

export function tagStates(selected: Contact[], tags: string[]): Record<string, TagState> {
  const out: Record<string, TagState> = {};
  for (const t of tags) {
    const n = selected.filter((c) => c.tags.includes(t)).length;
    out[t] = n === 0 ? 'none' : n === selected.length ? 'all' : 'some';
  }
  return out;
}

export function nextTagState(s: TagState): TagState {
  return s === 'all' ? 'none' : 'all';
}

export function tagChanges(before: Record<string, TagState>, after: Record<string, TagState>) {
  const add: string[] = [];
  const remove: string[] = [];
  for (const [t, s] of Object.entries(after)) {
    if (s === before[t] || s === 'some') continue;
    if (s === 'all') add.push(t);
    else remove.push(t);
  }
  return { add, remove };
}
