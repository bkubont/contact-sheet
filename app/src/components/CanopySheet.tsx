import { useEffect, useState } from 'react';
import { Canopy, type CanopyOrg } from '../lib/canopy';
import { Sync } from '../lib/sync';
import { toast } from '../lib/util';
import { useDb } from '../hooks/useStore';
import { Sheet } from './Sheet';

/** Connection to Canopy Estimate: which company, how many contacts are linked, downloaded copies. */
export function CanopySheet({ open, onClose, onOpenAccount }: { open: boolean; onClose: () => void; onOpenAccount: () => void }) {
  const db = useDb();
  const [orgs, setOrgs] = useState<CanopyOrg[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(Canopy.orgId);
  const [error, setError] = useState('');
  const signedIn = Canopy.available;
  const linked = db.contacts.filter((c) => c.canopy).length;

  useEffect(() => {
    if (!open || !signedIn) return;
    setOrgs(null);
    setError('');
    void Canopy.ensureOrg().then((r) => {
      setOrgs(r.orgs);
      setOrgId(r.orgId);
      if (r.error) setError(r.error);
    });
  }, [open, signedIn]);

  return (
    <Sheet open={open} title="Canopy Estimate" onClose={onClose}>
      <p className="muted">
        Link contacts to Canopy Estimate customers to see their completed jobs, with copies of each estimate and invoice. Jobs
        and invoices stay in Canopy Estimate; your personal contacts are never sent there.
      </p>
      {!Sync.enabled ? (
        <p className="muted">This copy of Contact Sheet was built without an account connection.</p>
      ) : !signedIn ? (
        <>
          <p>Sign in with the same login you use for Canopy Estimate.</p>
          <button type="button" className="btn primary wide" onClick={onOpenAccount}>
            Sign in
          </button>
        </>
      ) : (
        <>
          {error && <p className="wh-error">{error}</p>}
          <fieldset>
            <legend>Company</legend>
            {orgs === null ? (
              <p className="muted">Checking…</p>
            ) : !orgs.length ? (
              <p className="muted">
                {Sync.user?.email} isn’t an owner or office member of a Canopy Estimate company, so jobs and invoices can’t be
                shown.
              </p>
            ) : orgs.length === 1 ? (
              <p>
                <b>{orgs[0].name}</b> <span className="muted">· {orgs[0].role}</span>
              </p>
            ) : (
              <select
                value={orgId || ''}
                onChange={(e) => {
                  Canopy.setOrg(e.target.value || null);
                  setOrgId(e.target.value || null);
                }}
              >
                <option value="">— Choose —</option>
                {orgs.map((o) => (
                  <option key={o.org_id} value={o.org_id}>
                    {o.name} ({o.role})
                  </option>
                ))}
              </select>
            )}
          </fieldset>
          <p className="muted">
            {linked} contact{linked === 1 ? '' : 's'} linked. Open a contact to link it or see its work history.
          </p>
          <button
            type="button"
            className="btn wide"
            onClick={async () => {
              await Canopy.clearDownloads();
              toast('Downloaded copies removed from this device');
            }}
          >
            Remove downloaded copies from this device
          </button>
        </>
      )}
    </Sheet>
  );
}
