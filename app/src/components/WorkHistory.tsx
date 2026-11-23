import { useEffect, useState } from 'react';
import type { Contact } from '../types';
import { Canopy, jobBadge, latestDocs, money, type CanopyDoc, type CanopyJob, type CanopyMatch } from '../lib/canopy';
import { Store } from '../lib/store';
import { Sync } from '../lib/sync';
import { toast } from '../lib/util';
import { useDb } from '../hooks/useStore';
import { Sheet } from './Sheet';

const KIND_LABEL: Record<CanopyDoc['kind'], string> = { estimate: 'Estimate', invoice: 'Invoice', receipt: 'Paid receipt' };

function niceDate(d: string | null | undefined) {
  if (!d) return '';
  const date = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A saved PDF as a real link, so tapping it opens it (also on iPhone, where pop-ups are blocked). */
function DocLink({ doc, customer }: { doc: CanopyDoc; customer: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void Canopy.documentBlob(doc).then((blob) => {
      if (!alive) return;
      if (!blob) return setState('missing');
      made = URL.createObjectURL(blob);
      setUrl(made);
      setState('ready');
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [doc.id]);
  const label = KIND_LABEL[doc.kind];
  if (state === 'loading') return <span className="wh-doc muted">{label}…</span>;
  if (state === 'missing') return <span className="wh-doc muted" title="Connect to download this copy">{label} (online only)</span>;
  return (
    <a className="wh-doc" href={url!} target="_blank" rel="noopener" download={`${customer} ${doc.number} ${label}.pdf`}>
      {label}
    </a>
  );
}

function JobRow({ job, customer }: { job: CanopyJob; customer: string }) {
  const badge = jobBadge(job);
  const docs = latestDocs(job);
  const kinds = (['estimate', 'invoice', 'receipt'] as const).filter((k) => docs[k]);
  return (
    <div className="wh-job">
      <div className="wh-top">
        <b>{job.number}</b>
        <span className="muted">{niceDate(job.work_date || job.signed_at || job.estimate_date)}</span>
        <span className={`wh-badge ${badge.tone}`}>{badge.label}</span>
      </div>
      <div className="wh-meta muted">
        {[job.property, job.total != null ? money(job.total) : '', job.invoice_number ? `Invoice ${job.invoice_number}` : '']
          .filter(Boolean)
          .join(' · ')}
      </div>
      <div className="wh-docs">
        {kinds.length ? (
          kinds.map((k) => <DocLink key={docs[k]!.id} doc={docs[k]!} customer={customer} />)
        ) : (
          <span className="muted">Copies appear after Canopy Estimate next syncs.</span>
        )}
      </div>
    </div>
  );
}

function LinkSheet({ open, contact, orgId, onClose }: { open: boolean; contact: Contact; orgId: string; onClose: () => void }) {
  const [suggested, setSuggested] = useState<CanopyMatch[] | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CanopyMatch[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSuggested(null);
    setResults(null);
    setQ('');
    setError('');
    void Canopy.suggest(orgId, contact).then((r) => {
      setSuggested(r.matches);
      if (r.error) setError(r.error);
    });
  }, [open, orgId, contact]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      void Canopy.search(orgId, q).then((r) => {
        setResults(r.matches);
        if (r.error) setError(r.error);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, orgId]);

  function pick(m: CanopyMatch) {
    Store.setCanopy(contact.id, { orgId, customerId: m.id, name: m.name || m.company || 'Customer' });
    toast(`Linked to ${m.name || m.company}`);
    onClose();
  }

  const list = (rows: CanopyMatch[]) =>
    rows.map((m) => (
      <button key={m.id} type="button" className="wh-match" onClick={() => pick(m)}>
        <b>{m.name || m.company || 'No name'}</b>
        <span className="muted">
          {[m.name && m.company, m.town].filter(Boolean).join(' · ')}
          {m.matched_on && m.matched_on !== 'search' ? ` · same ${m.matched_on}` : ''}
        </span>
      </button>
    ));

  return (
    <Sheet open={open} title="Link to Canopy customer" onClose={onClose}>
      <p className="muted">
        Linking shows this person’s completed jobs, estimates and invoices from Canopy Estimate. Nothing from Contact Sheet is
        sent to Canopy.
      </p>
      {error && <p className="wh-error">{error}</p>}
      <fieldset>
        <legend>Suggested</legend>
        {suggested === null ? (
          <p className="muted">Looking for matches…</p>
        ) : suggested.length ? (
          <div className="wh-matches">{list(suggested)}</div>
        ) : (
          <p className="muted">No customer has the same phone, email or name.</p>
        )}
      </fieldset>
      <label>
        Search customers
        <input type="search" value={q} placeholder="Name, company or town" onChange={(e) => setQ(e.target.value)} />
      </label>
      {results && (results.length ? <div className="wh-matches">{list(results)}</div> : <p className="muted">No customers found.</p>)}
    </Sheet>
  );
}

/** Canopy Estimate work history for one contact, shown in the contact sheet. */
export function WorkHistory({ contact: opened }: { contact: Contact }) {
  // Follow the stored contact, so linking or unlinking shows right away.
  const db = useDb();
  const contact = db.contacts.find((c) => c.id === opened.id) ?? opened;
  const [orgId, setOrgId] = useState<string | null>(Canopy.orgId);
  const [orgError, setOrgError] = useState('');
  const [jobs, setJobs] = useState<CanopyJob[] | null>(null);
  const [note, setNote] = useState('');
  const [linking, setLinking] = useState(false);
  const link = contact.canopy;
  const signedIn = Canopy.available;

  useEffect(() => {
    if (!signedIn) return;
    void Canopy.ensureOrg().then((r) => {
      setOrgId(r.orgId);
      setOrgError(r.error || (!r.orgId && !r.orgs.length ? 'This login isn’t an owner or office member of a Canopy Estimate company.' : ''));
    });
  }, [signedIn]);

  useEffect(() => {
    if (!link) {
      setJobs(null);
      return;
    }
    const cached = Canopy.cachedHistory(link.customerId);
    setJobs(cached?.jobs ?? null);
    setNote('');
    void Canopy.history(link.orgId, link.customerId).then((r) => {
      setJobs(r.jobs);
      if (r.error) setNote(r.error);
      else if (r.offline) setNote(cached ? `Offline · last updated ${new Date(cached.at).toLocaleDateString()}` : 'Offline');
    });
  }, [link?.orgId, link?.customerId]);

  if (!Sync.enabled) return null;

  return (
    <fieldset className="wh">
      <legend>Canopy Estimate</legend>
      {link ? (
        <>
          <div className="wh-linked">
            <span>
              Customer: <b>{link.name}</b>
            </span>
            <button
              type="button"
              className="link"
              onClick={() => {
                if (!confirm(`Unlink ${link.name}? Their jobs stay in Canopy Estimate.`)) return;
                Store.setCanopy(contact.id, null);
              }}
            >
              Unlink
            </button>
          </div>
          {note && <p className="muted wh-note">{note}</p>}
          {jobs === null ? (
            <p className="muted">Loading work history…</p>
          ) : jobs.length ? (
            jobs.map((j) => <JobRow key={j.job_id} job={j} customer={link.name} />)
          ) : (
            <p className="muted">No completed jobs yet.</p>
          )}
        </>
      ) : !signedIn ? (
        <p className="muted">Sign in (Menu → Account) with your Canopy Estimate login to see this person’s jobs and invoices.</p>
      ) : orgError ? (
        <p className="muted">{orgError}</p>
      ) : orgId ? (
        <>
          <p className="muted">Is this a customer? Link them to see completed jobs with estimate and invoice copies.</p>
          <button type="button" className="btn wide" onClick={() => setLinking(true)}>
            Link to Canopy customer
          </button>
          <LinkSheet open={linking} contact={contact} orgId={orgId} onClose={() => setLinking(false)} />
        </>
      ) : (
        <p className="muted">Choose your company in Menu → Canopy Estimate.</p>
      )}
    </fieldset>
  );
}
