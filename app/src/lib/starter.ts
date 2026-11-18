import type { Customer, Job, TagGroup } from '../types';
import { addDays, today } from './dates';
import { uid } from './util';

// Tree-service starter setup. Everything here can be renamed, recolored or removed later.
const STAGE = [
  ['stage-new', 'New lead', '#2a72d4'],
  ['stage-est-set', 'Estimate set', '#c48a00'],
  ['stage-est-sent', 'Estimate sent', '#c48a00'],
  ['stage-booked', 'Booked', '#e85a0c'],
  ['stage-complete', 'Complete', '#23914f'],
  ['stage-past', 'Past customer', '#7b8676'],
] as const;

const g = (id: string, name: string, mode: 'one' | 'many', names: string[], extra: Partial<TagGroup> = {}): TagGroup => ({
  id, name, mode, updatedAt: Date.now(),
  tags: names.map((n) => ({ id: `${id}-${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: n })),
  ...extra,
});

export function starterTagGroups(): TagGroup[] {
  return [
    { id: 'stage', name: 'Stage', mode: 'one', pipeline: true, updatedAt: Date.now(), tags: STAGE.map(([id, name, color]) => ({ id, name, color })) },
    g('type', 'Customer type', 'one', ['Residential', 'Commercial', 'HOA / Property mgr', 'Municipal']),
    g('source', 'Lead source', 'one', ['Google', 'Referral', 'Yard sign / Door hanger', 'Facebook / Nextdoor', 'Storm call', 'Repeat']),
    g('services', 'Services', 'many', ['Removal', 'Trim / Prune', 'Stump grinding', 'Storm / Emergency', 'Lot clearing', 'Cabling', 'Plant health']),
    g('flags', 'Job flags', 'many', ['Crane job', 'Power lines', 'Dog', 'Wants firewood', 'Wants chips', 'Annual customer', 'Do not text'], { allowNew: true }),
    g('network', 'Network', 'many', ['Subcontractor', 'Crane operator', 'Insurance adjuster', 'Realtor', 'Landscaper', 'Dump site']),
  ];
}

// Clearly-marked example customers so the app isn't empty on first look.
export function sampleCustomers(): Customer[] {
  const now = Date.now();
  const day = 86400000;
  const mk = (first: string, last: string, phone: string, address: string, tags: string[], p: Partial<Customer['properties'][0]> = {}, extra: Partial<Customer> = {}): Customer => ({
    id: uid(), first, last, company: '', sample: true,
    phones: [{ label: 'mobile', value: phone }], emails: [],
    properties: [{ id: uid(), address, gateCode: '', access: '', hazards: [], treeNotes: '', ...p }],
    tagIds: tags, notes: '', createdAt: now - Math.random() * 40 * day, updatedAt: now, ...extra,
  });
  return [
    mk('Pat', 'Delgado', '(555) 310-2299', '418 Elm Ct, Westfield', ['stage-est-set', 'type-residential', 'source-referral', 'services-removal', 'flags-dog', 'flags-power-lines', 'flags-wants-chips'],
      { gateCode: '4471', access: 'Park on street. Dog in back yard.', hazards: ['Power line over driveway'], treeNotes: 'Large red oak leaning toward the garage; 2 dead limbs over the fence line.' }),
    mk('Greg', 'Hollis', '(555) 448-1020', '12 Birch Ln, Westfield', ['stage-est-sent', 'type-residential', 'source-google', 'services-trim-prune'], { treeNotes: '3 maples, raise canopy over roof.' }, { createdAt: now - 9 * day }),
    mk('Linda', 'Marsh', '(555) 772-9031', '903 Orchard Way, Fairview', ['stage-complete', 'type-residential', 'source-repeat', 'services-stump-grinding', 'flags-annual-customer']),
    mk('', '', '(555) 640-1180', 'Clubhouse lot, 1 Cedar Ridge Dr', ['stage-booked', 'type-hoa-property-mgr', 'source-referral', 'services-trim-prune'],
      { access: 'Check in at clubhouse office.', treeNotes: 'Trim 6 white pines along the lot.' }, { company: 'Cedar Ridge HOA' }),
    mk('Ruth', 'Bowman', '(555) 233-5402', '77 Pike Rd, Fairview', ['stage-new', 'type-residential', 'source-yard-sign-door-hanger', 'services-stump-grinding']),
    mk('Marcus', 'Okafor', '(555) 918-3307', '5 Quarry Rd, Westfield', ['stage-new', 'type-residential', 'source-storm-call', 'services-storm-emergency'],
      { hazards: ['Limb resting on roof'], treeNotes: 'Storm damage: large limb on roof over garage.' }),
    mk('Tom', 'Baird', '(555) 512-8890', '', ['network-crane-operator'], {}, { company: 'Baird Crane Service' }),
  ];
}

// Example schedule around today for the sample customers.
export function sampleJobs(customers: Customer[]): Job[] {
  const by = (name: string) => customers.find((c) => c.first === name || c.company === name);
  const t = today();
  const now = Date.now();
  const mk = (who: string, kind: Job['kind'], date: string, start: string, extra: Partial<Job>): Job | null => {
    const c = by(who);
    if (!c) return null;
    return {
      id: uid(), kind, customerId: c.id, propertyId: c.properties[0]?.id, date, start,
      minutes: 45, days: 1, crew: ['Me'], equipment: [], work: '', notes: '', status: 'scheduled',
      sample: true, createdAt: now, updatedAt: now, ...extra,
    };
  };
  return [
    mk('Pat', 'estimate', t, '08:30', { work: 'Look at leaning red oak by garage' }),
    mk('Ruth', 'estimate', t, '13:15', { work: 'Stump grinding quote' }),
    mk('Cedar Ridge HOA', 'job', addDays(t, 1), '07:30', { work: 'Trim 6 white pines along the lot', crew: ['Me', 'Helper 1'], equipment: ['Bucket truck', 'Chipper'] }),
    mk('Marcus', 'job', addDays(t, 2), '07:30', { days: 2, work: 'Remove storm-damaged limb from roof, take down tree', crew: ['Me', 'Helper 1', 'Helper 2'], equipment: ['Crane', 'Chipper'] }),
    mk('Linda', 'job', addDays(t, -3), '08:00', { work: 'Grind 2 stumps', equipment: ['Stump grinder'], status: 'done' }),
  ].filter(Boolean) as Job[];
}
