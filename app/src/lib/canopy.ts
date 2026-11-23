import type { Contact } from '../types';
import { Sync } from './sync';

/**
 * Read-only connection to Canopy Estimate (same Supabase project and login).
 * Canopy stays the only place jobs, estimates and invoices are made or
 * changed. Contact Sheet stores just the customer id on a contact, reads the
 * customer's completed jobs, and keeps copies of the saved PDFs on this device
 * so they open with no signal. Personal contacts are never sent to Canopy.
 */

export interface CanopyOrg {
  org_id: string;
  name: string;
  role: string;
}

export interface CanopyDoc {
  id: string;
  kind: 'estimate' | 'invoice' | 'receipt';
  number: string;
  total: number | null;
  path: string;
  bytes: number;
  created_at: string;
}

export interface CanopyJob {
  job_id: string;
  number: string;
  stage: string;
  status: string;
  estimate_date: string | null;
  signed_at: string | null;
  work_date: string | null;
  property: string;
  invoice_number: string | null;
  total: number | null;
  paid: number;
  documents: CanopyDoc[];
}

export interface CanopyMatch {
  id: string;
  name: string | null;
  company: string;
  town: string;
  matched_on?: 'phone' | 'email' | 'name' | 'search';
}

const ORG_KEY = 'contactSheet.canopy.org.v1';
const HISTORY_KEY = (customerId: string) => `contactSheet.canopy.history.v1.${customerId}`;
const BUCKET = 'documents';

function friendly(e: { message?: string } | null | undefined): string {
  const m = e?.message || 'Something went wrong';
  if (/failed to fetch|network/i.test(m)) return 'Could not reach Canopy Estimate. Check your connection.';
  if (/Only the owner or office/i.test(m)) return 'Your Canopy Estimate role can’t see jobs and invoices (owner or office only).';
  if (/function .* does not exist|Could not find the function/i.test(m)) return 'Canopy Estimate needs its latest database update first.';
  return m;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or private mode: the live copy still works */
  }
}

// ---------------------------------------------------------------- saved PDFs on this device

const DB_NAME = 'contactSheet.canopy';
const STORE = 'docs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => bad(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((ok, bad) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => ok(req.result as T);
      req.onerror = () => bad(req.error);
    });
  } finally {
    db.close();
  }
}

export const Canopy = {
  /** True when signed in to the shared account. */
  get available(): boolean {
    return !!Sync.client;
  },

  /** Companies where this login can see jobs and invoices. */
  async orgs(): Promise<{ orgs: CanopyOrg[]; error?: string }> {
    const client = Sync.client;
    if (!client) return { orgs: [], error: 'Sign in first.' };
    const { data, error } = await client.rpc('my_organizations');
    if (error) return { orgs: [], error: friendly(error) };
    const orgs = ((data || []) as CanopyOrg[]).filter((o) => o.role === 'owner' || o.role === 'office');
    return { orgs };
  },

  get orgId(): string | null {
    return readJSON<string>(ORG_KEY);
  },
  setOrg(orgId: string | null) {
    if (orgId) writeJSON(ORG_KEY, orgId);
    else localStorage.removeItem(ORG_KEY);
  },

  /** Pick the company automatically when there is only one. */
  async ensureOrg(): Promise<{ orgId: string | null; orgs: CanopyOrg[]; error?: string }> {
    const { orgs, error } = await Canopy.orgs();
    if (error) return { orgId: Canopy.orgId, orgs, error };
    let orgId = Canopy.orgId;
    if (!orgId || !orgs.some((o) => o.org_id === orgId)) {
      orgId = orgs.length === 1 ? orgs[0].org_id : null;
      Canopy.setOrg(orgId);
    }
    return { orgId, orgs };
  },

  /** Customers that look like this contact (phone, email, then full name). */
  async suggest(orgId: string, c: Contact): Promise<{ matches: CanopyMatch[]; error?: string }> {
    const client = Sync.client;
    if (!client) return { matches: [], error: 'Sign in first.' };
    const { data, error } = await client.rpc('match_customers', {
      p_org: orgId,
      p_phones: c.phones.map((p) => p.value),
      p_emails: c.emails.map((e) => e.value),
      p_name: [c.first, c.last].filter(Boolean).join(' '),
    });
    if (error) return { matches: [], error: friendly(error) };
    return { matches: (data || []) as CanopyMatch[] };
  },

  /** Search customers by name, company or town. */
  async search(orgId: string, q: string): Promise<{ matches: CanopyMatch[]; error?: string }> {
    const client = Sync.client;
    if (!client) return { matches: [], error: 'Sign in first.' };
    const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (!words.length) return { matches: [] };
    // The server filters on the longest word; the rest are checked here.
    const lead = [...words].sort((a, b) => b.length - a.length)[0].replace(/[%,().*\\]/g, '');
    if (!lead) return { matches: [] };
    const { data, error } = await client
      .from('customers')
      .select('id, first_name, last_name, company, town')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .or(`first_name.ilike.%${lead}%,last_name.ilike.%${lead}%,company.ilike.%${lead}%,town.ilike.%${lead}%`)
      .order('last_name')
      .order('first_name')
      .limit(50);
    if (error) return { matches: [], error: friendly(error) };
    type Row = { id: string; first_name: string; last_name: string; company: string; town: string };
    const all = words.map((w) => w.toLowerCase());
    const rows = ((data || []) as Row[])
      .filter((r) => {
        const hay = `${r.first_name} ${r.last_name} ${r.company} ${r.town}`.toLowerCase();
        return all.every((w) => hay.includes(w));
      })
      .slice(0, 20);
    return {
      matches: rows.map((r) => ({
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
        company: r.company,
        town: r.town,
        matched_on: 'search' as const,
      })),
    };
  },

  /** Last history we saw for this customer, for showing offline. */
  cachedHistory(customerId: string): { jobs: CanopyJob[]; at: number } | null {
    return readJSON(HISTORY_KEY(customerId));
  },

  async history(orgId: string, customerId: string): Promise<{ jobs: CanopyJob[]; error?: string; offline?: boolean }> {
    const client = Sync.client;
    const cached = Canopy.cachedHistory(customerId);
    if (!client || !navigator.onLine) {
      return { jobs: cached?.jobs || [], offline: true, error: client ? undefined : 'Sign in to see the latest.' };
    }
    const { data, error } = await client.rpc('customer_history', { p_org: orgId, p_customer: customerId });
    if (error) return { jobs: cached?.jobs || [], error: friendly(error), offline: !!cached };
    const jobs = (data || []) as CanopyJob[];
    writeJSON(HISTORY_KEY(customerId), { jobs, at: Date.now() });
    return { jobs };
  },

  /** The saved PDF, from this device if we have it, otherwise downloaded and kept. */
  async documentBlob(doc: CanopyDoc): Promise<Blob | null> {
    try {
      const have = await idb<{ blob: Blob } | undefined>('readonly', (s) => s.get(doc.id));
      if (have?.blob) return have.blob;
    } catch {
      /* no IndexedDB: fall through to download */
    }
    const client = Sync.client;
    if (!client || !navigator.onLine) return null;
    const { data, error } = await client.storage.from(BUCKET).download(doc.path);
    if (error || !data) return null;
    const blob = data.type === 'application/pdf' ? data : new Blob([data], { type: 'application/pdf' });
    try {
      await idb('readwrite', (s) => s.put({ blob, savedAt: Date.now() }, doc.id));
    } catch {
      /* couldn't keep a copy; it still opens now */
    }
    return blob;
  },

  async clearDownloads(): Promise<void> {
    try {
      await idb('readwrite', (s) => s.clear());
    } catch {
      /* nothing saved */
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('contactSheet.canopy.history.')) localStorage.removeItem(k);
    }
  },
};

/** Latest saved copy of each kind for a job. */
export function latestDocs(job: CanopyJob): Partial<Record<CanopyDoc['kind'], CanopyDoc>> {
  const out: Partial<Record<CanopyDoc['kind'], CanopyDoc>> = {};
  for (const d of [...job.documents].sort((a, b) => a.created_at.localeCompare(b.created_at))) out[d.kind] = d;
  return out;
}

export function jobBadge(job: CanopyJob): { label: string; tone: 'paid' | 'due' | 'done' } {
  const total = Number(job.total || 0);
  const paid = Number(job.paid || 0);
  if (job.stage === 'paid' || (total > 0 && paid >= total)) return { label: 'Paid', tone: 'paid' };
  if (job.invoice_number && total > paid) return { label: `Balance ${money(total - paid)}`, tone: 'due' };
  return { label: 'Done', tone: 'done' };
}

export function money(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
