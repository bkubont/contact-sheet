// Core data model for Canopy Clients.
// Every record carries `updatedAt` so it can sync to the cloud later.

export interface LabeledValue {
  label: string; // mobile, home, work, other…
  value: string;
}

export interface Property {
  id: string;
  address: string;
  gateCode: string;
  access: string;   // parking, dogs, where to enter…
  hazards: string[]; // power lines, structures, slope…
  treeNotes: string;
}

export interface Customer {
  id: string;
  first: string;
  last: string;
  company: string;
  phones: LabeledValue[];
  emails: LabeledValue[];
  properties: Property[];
  tagIds: string[];
  notes: string;
  sample?: boolean; // example data that can be cleared in one tap
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

// mode 'one'  → a customer holds at most one tag from this group (Stage, Customer type…)
// mode 'many' → any number (Services, Job flags…)
export interface TagGroup {
  id: string;
  name: string;
  mode: 'one' | 'many';
  pipeline?: boolean; // ordered stage group, drives colors and follow-ups
  allowNew?: boolean; // type a new tag straight onto a customer
  tags: Tag[];
  updatedAt: number;
}

export type ActivityType = 'note' | 'call' | 'text' | 'stage' | 'created' | 'imported';

export interface Activity {
  id: string;
  customerId: string;
  type: ActivityType;
  body: string;
  at: number;
  updatedAt: number;
}

export interface Settings {
  businessName: string;
  yourName: string;
  updatedAt: number;
}

export interface Db {
  version: 1;
  customers: Customer[];
  tagGroups: TagGroup[];
  activities: Activity[];
  settings: Settings;
}
