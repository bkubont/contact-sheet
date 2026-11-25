import { describe, expect, it } from 'vitest';
import { NO_FILTERS, UNCAT, UNTAGGED, hasFilters, nextTagState, passesFilters, tagChanges, tagStates, toggle } from './filters';
import type { Contact } from '../types';

const c = (id: string, tags: string[], category = ''): Contact => ({
  id, first: id, last: '', company: '', title: '', phones: [], emails: [], address: '', birthday: '', notes: '', tags, category, created: 1, updated: 1,
});
const ann = c('ann', ['School', 'Golf'], 'fam');
const bob = c('bob', ['School'], 'work');
const cy = c('cy', [], '');

const pick = (f: Partial<typeof NO_FILTERS>) => [ann, bob, cy].filter((x) => passesFilters(x, { ...NO_FILTERS, ...f })).map((x) => x.id);

describe('contact filters', () => {
  it('shows everyone with no filters', () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(pick({})).toEqual(['ann', 'bob', 'cy']);
  });
  it('matches any of several categories, including none', () => {
    expect(pick({ cats: ['fam', 'work'] })).toEqual(['ann', 'bob']);
    expect(pick({ cats: [UNCAT] })).toEqual(['cy']);
  });
  it('any of the tags vs all of them', () => {
    expect(pick({ tags: ['Golf', 'School'], match: 'any' })).toEqual(['ann', 'bob']);
    expect(pick({ tags: ['Golf', 'School'], match: 'all' })).toEqual(['ann']);
  });
  it('untagged on its own or with others', () => {
    expect(pick({ tags: [UNTAGGED] })).toEqual(['cy']);
    expect(pick({ tags: [UNTAGGED, 'Golf'], match: 'any' })).toEqual(['ann', 'cy']);
  });
  it('category and tags together narrow further', () => {
    expect(pick({ cats: ['work'], tags: ['School'] })).toEqual(['bob']);
  });
  it('toggle adds and removes', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('tagging several people at once', () => {
  const before = tagStates([ann, bob], ['School', 'Golf', 'Church']);
  it('shows each tag as on for all, some or none', () => {
    expect(before).toEqual({ School: 'all', Golf: 'some', Church: 'none' });
  });
  it('tapping turns a tag on for everyone, or off for everyone', () => {
    expect(nextTagState('none')).toBe('all');
    expect(nextTagState('some')).toBe('all');
    expect(nextTagState('all')).toBe('none');
  });
  it('only changes what was tapped; "some" is left alone', () => {
    expect(tagChanges(before, { ...before })).toEqual({ add: [], remove: [] });
    expect(tagChanges(before, { School: 'none', Golf: 'all', Church: 'all', New: 'all' })).toEqual({
      add: ['Golf', 'Church', 'New'],
      remove: ['School'],
    });
  });
});
