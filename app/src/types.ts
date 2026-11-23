export interface LabeledValue {
  label: string;
  value: string;
}

/** Named primary folder-like category (one per contact). */
export interface CategoryDef {
  id: string;
  name: string;
  /** Hex accent for chips / PDF accents */
  color: string;
}

/** Named group of related tags (contacts can pick tags from many groups). */
export interface TagGroup {
  id: string;
  name: string;
  tags: string[];
}

/** Link from a personal contact to a customer in Canopy Estimate (same Supabase project). */
export interface CanopyLink {
  orgId: string;
  customerId: string;
  /** Customer name at the time of linking, shown when offline. */
  name: string;
}

export interface Contact {
  id: string;
  first: string;
  last: string;
  company: string;
  title: string;
  phones: LabeledValue[];
  emails: LabeledValue[];
  address: string;
  birthday: string;
  notes: string;
  tags: string[];
  /** Primary category id (from Db.categories), or empty. */
  category: string;
  /** Set when this person is linked to a Canopy Estimate customer. */
  canopy?: CanopyLink | null;
  created: number;
  updated: number;
}

/** Named list you can reopen and turn into a PDF. */
export interface Directory {
  id: string;
  name: string;
  notes: string;
  /** manual = fixed members; smart = tag filter that stays current */
  mode: 'manual' | 'smart';
  contactIds: string[];
  tags: string[];
  match: 'any' | 'all';
  created: number;
  updated: number;
}

export type PdfLayout = 'cards' | 'list' | 'table';
export type PdfSort = 'last' | 'first' | 'company' | 'category';
export type PdfTheme = 'royal' | 'gold' | 'navy' | 'charcoal';
export type PdfOrientation = 'portrait' | 'landscape';

export interface PdfOptions {
  title: string;
  subtitle: string;
  layout: PdfLayout;
  sort: PdfSort;
  paper: 'letter' | 'a4';
  orientation: PdfOrientation;
  theme: PdfTheme;
  columns: 1 | 2 | 3;
  cover: boolean;
  headerText: string;
  footerText: string;
  f_company: boolean;
  f_phones: boolean;
  f_emails: boolean;
  f_address: boolean;
  f_birthday: boolean;
  f_tags: boolean;
  f_category: boolean;
  f_notes: boolean;
}

export interface Db {
  version: 3;
  contacts: Contact[];
  directories: Directory[];
  categories: CategoryDef[];
  tagGroups: TagGroup[];
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'cat-family', name: 'Family', color: '#B45309' },
  { id: 'cat-work', name: 'Work', color: '#1E3A8A' },
  { id: 'cat-friends', name: 'Friends', color: '#D97706' },
  { id: 'cat-community', name: 'Community', color: '#1D4ED8' },
  { id: 'cat-other', name: 'Other', color: '#64748B' },
];

export const DEFAULT_TAG_GROUPS: TagGroup[] = [
  { id: 'tg-relationship', name: 'Relationship', tags: ['Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Friend', 'Neighbor'] },
  { id: 'tg-role', name: 'Role', tags: ['Board', 'Volunteer', 'Client', 'Colleague', 'Vendor'] },
  { id: 'tg-circle', name: 'Circle', tags: ['School', 'Church', 'Club', 'Sports', 'Travel'] },
];

export const DEFAULT_PDF: PdfOptions = {
  title: 'Contact Sheet',
  subtitle: '',
  layout: 'list',
  sort: 'last',
  paper: 'letter',
  orientation: 'portrait',
  theme: 'royal',
  columns: 2,
  cover: true,
  headerText: '',
  footerText: 'Personal directory · Not for redistribution',
  f_company: true,
  f_phones: true,
  f_emails: true,
  f_address: true,
  f_birthday: false,
  f_tags: false,
  f_category: true,
  f_notes: false,
};

export const PDF_THEMES: Record<PdfTheme, { label: string; accent: [number, number, number]; soft: [number, number, number]; gold: [number, number, number] }> = {
  royal: { label: 'Royal blue', accent: [30, 58, 138], soft: [219, 234, 254], gold: [217, 119, 6] },
  gold: { label: 'Gold', accent: [180, 83, 9], soft: [254, 243, 199], gold: [245, 158, 11] },
  navy: { label: 'Deep navy', accent: [15, 23, 42], soft: [226, 232, 240], gold: [212, 175, 55] },
  charcoal: { label: 'Charcoal', accent: [51, 65, 85], soft: [241, 245, 249], gold: [217, 119, 6] },
};
