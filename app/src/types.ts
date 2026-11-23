export interface LabeledValue {
  label: string;
  value: string;
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
export type PdfSort = 'last' | 'first' | 'company';

export interface PdfOptions {
  title: string;
  subtitle: string;
  layout: PdfLayout;
  sort: PdfSort;
  paper: 'letter' | 'a4';
  cover: boolean;
  f_company: boolean;
  f_phones: boolean;
  f_emails: boolean;
  f_address: boolean;
  f_birthday: boolean;
  f_tags: boolean;
  f_notes: boolean;
}

export interface Db {
  version: 2;
  contacts: Contact[];
  directories: Directory[];
}

export const DEFAULT_PDF: PdfOptions = {
  title: 'Contact Sheet',
  subtitle: '',
  layout: 'list',
  sort: 'last',
  paper: 'letter',
  cover: true,
  f_company: true,
  f_phones: true,
  f_emails: true,
  f_address: true,
  f_birthday: false,
  f_tags: false,
  f_notes: false,
};
