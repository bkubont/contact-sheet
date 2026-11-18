import { useEffect, useMemo, useState } from 'react';
import { conflictsFor, deleteJob, saveJob, setJobStatus, useDb } from '../lib/store';
import { addDays, fmtDay, today } from '../lib/dates';
import { displayName, uid } from '../lib/util';
import { Sheet, askConfirm, toast } from '../lib/ui';
import type { Job } from '../types';

// Open the job editor from anywhere: editJob({ customerId }) or editJob(existingJob)
let open: ((j: Partial<Job>) => void) | null = null;
export function editJob(j: Partial<Job>) { open?.(j); }

export function JobEditorHost() {
  const [job, setJob] = useState<Partial<Job> | null>(null);
  useEffect(() => { open = setJob; return () => { open = null; }; }, []);
  return job ? <EditJob key={job.id || 'new'} preset={job} onClose={() => setJob(null)} /> : null;
}

const LENGTHS = [30, 45, 60, 90, 120];

function EditJob({ preset, onClose }: { preset: Partial<Job>; onClose: () => void }) {
  const db = useDb();
  const existing = preset.id ? db.jobs.find((j) => j.id === preset.id) : undefined;
  const [j, setJ] = useState<Job>(() => existing ? { ...existing } : {
    id: uid(), kind: 'estimate', customerId: '', date: today(), start: '08:00', minutes: 45, days: 1,
    crew: db.settings.crew.slice(0, 1), equipment: [], work: '', notes: '', status: 'scheduled', createdAt: 0, updatedAt: 0,
    ...preset,
  } as Job);
  const [q, setQ] = useState('');
  const set = <K extends keyof Job>(k: K, v: Job[K]) => setJ((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'crew' | 'equipment', v: string) => setJ((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  const customer = db.customers.find((c) => c.id === j.customerId);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return db.customers.filter((c) => [displayName(c), c.company, ...c.properties.map((p) => p.address), ...c.phones.map((p) => p.value)].join(' ').toLowerCase().includes(s)).slice(0, 8);
  }, [q, db.customers]);
  const conflicts = conflictsFor(j, db);

  // Default the property and the work description from the customer card.
  useEffect(() => {
    if (!customer || existing) return;
    setJ((x) => ({
      ...x,
      propertyId: x.propertyId && customer.properties.some((p) => p.id === x.propertyId) ? x.propertyId : customer.properties[0]?.id,
      work: x.work || customer.properties[0]?.treeNotes || '',
    }));
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!customer) { toast('Pick a customer first'); return; }
    if (!j.date) { toast('Pick a date'); return; }
    saveJob({ ...j, work: j.work.trim(), notes: j.notes.trim() });
    toast(existing ? 'Saved' : `${j.kind === 'estimate' ? 'Estimate' : 'Job'} scheduled · ${fmtDay(j.date)}`);
    onClose();
  };

  const status = async (s: Job['status']) => {
    if (s === 'cancelled' && !(await askConfirm('Cancel', `Cancel this ${j.kind}? It stays on the customer's history.`, 'Cancel it', true))) return;
    setJobStatus(j.id, s);
    toast(s === 'done' ? (j.kind === 'estimate' ? 'Estimate done · stage: Estimate sent' : 'Job complete') : s === 'cancelled' ? 'Cancelled' : 'Re-opened');
    onClose();
  };

  const remove = async () => {
    if (!(await askConfirm('Delete', `Delete this ${j.kind} from the calendar?`, 'Delete', true))) return;
    deleteJob(j.id);
    toast('Deleted');
    onClose();
  };

  return (
    <Sheet title={existing ? (j.kind === 'estimate' ? 'Estimate' : 'Job') : 'Schedule'} onClose={onClose} full right={<button className="link" onClick={save}>Save</button>}>
      <div className="sheet-body form">
        <div className="seg" role="group" aria-label="Type">
          <button className={j.kind === 'estimate' ? 'on' : ''} onClick={() => set('kind', 'estimate')}>Estimate</button>
          <button className={j.kind === 'job' ? 'on' : ''} onClick={() => set('kind', 'job')}>Job</button>
        </div>

        <div className="fieldset">
          <span className="eyebrow">Customer</span>
          {customer ? (
            <div className="section-head">
              <b style={{ fontSize: 17 }}>{displayName(customer)}</b>
              {!existing && <button className="link" onClick={() => { set('customerId', ''); setQ(''); }}>Change</button>}
            </div>
          ) : (
            <>
              <input className="plain" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, street, phone…" autoFocus aria-label="Find customer" />
              {matches.map((c) => (
                <button key={c.id} className="row" style={{ border: '1px solid var(--line)', borderRadius: 10 }} onClick={() => set('customerId', c.id)}>
                  <span className="grow"><div className="nm">{displayName(c)}</div><div className="meta">{c.properties[0]?.address || c.phones[0]?.value}</div></span>
                </button>
              ))}
              {q && !matches.length && <p className="muted" style={{ margin: 0 }}>No match. Add them from People first.</p>}
            </>
          )}
          {customer && customer.properties.length > 1 && (
            <label className="field">Property
              <select value={j.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
                {customer.properties.map((p) => <option key={p.id} value={p.id}>{p.address || 'No address'}</option>)}
              </select>
            </label>
          )}
          {customer && customer.properties.length === 1 && customer.properties[0].address && <div className="muted">{customer.properties[0].address}</div>}
        </div>

        <div className="grid2">
          <label className="field">{j.kind === 'job' && j.days > 1 ? 'First day' : 'Date'}<input type="date" value={j.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className="field">Start<input type="time" value={j.start} onChange={(e) => set('start', e.target.value)} /></label>
        </div>

        {j.kind === 'estimate' ? (
          <div className="field">Visit length
            <div className="chips wrap">{LENGTHS.map((m) => <button key={m} className={j.minutes === m ? 'chip on' : 'chip'} onClick={() => set('minutes', m)}>{m < 60 ? `${m} min` : `${m / 60} h`}{m === 90 ? '' : ''}</button>)}</div>
          </div>
        ) : (
          <div className="field">Days
            <div className="stepper">
              <button className="icon-btn" aria-label="Fewer days" onClick={() => set('days', Math.max(1, j.days - 1))}>−</button>
              <b>{j.days} {j.days === 1 ? 'day' : 'days'}</b>
              <button className="icon-btn" aria-label="More days" onClick={() => set('days', Math.min(30, j.days + 1))}>+</button>
              {j.days > 1 && <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>through {fmtDay(addDays(j.date, j.days - 1))}</span>}
            </div>
          </div>
        )}

        <div className="field">Crew
          <div className="chips wrap">{db.settings.crew.map((c) => <button key={c} className={j.crew.includes(c) ? 'chip on' : 'chip'} onClick={() => toggle('crew', c)}>{c}</button>)}</div>
        </div>
        <div className="field">Equipment
          <div className="chips wrap">{db.settings.equipment.map((e) => <button key={e} className={j.equipment.includes(e) ? 'chip on' : 'chip'} onClick={() => toggle('equipment', e)}>{e}</button>)}</div>
        </div>

        {conflicts.length > 0 && (
          <div className="hazard" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
            <span>Double-booked: {conflicts.map((c) => {
              const other = db.customers.find((x) => x.id === c.job.customerId);
              return `${c.reasons.join(', ')} already on ${other ? displayName(other) : 'another'} ${c.job.kind} (${fmtDay(c.job.date)})`;
            }).join('; ')}</span>
          </div>
        )}

        <label className="field">{j.kind === 'estimate' ? 'What to look at' : 'Work to do'}<textarea value={j.work} onChange={(e) => set('work', e.target.value)} /></label>
        <label className="field">Notes<textarea value={j.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the crew should know" /></label>

        <button className="btn action wide" onClick={save}>{existing ? 'Save changes' : `Schedule ${j.kind}`}</button>
        {existing && existing.status === 'scheduled' && (
          <>
            <button className="btn brand wide" onClick={() => status('done')}>{j.kind === 'estimate' ? 'Estimate visit done' : 'Job complete'}</button>
            <button className="btn ghost wide" onClick={() => status('cancelled')}>Cancel {j.kind}</button>
          </>
        )}
        {existing && existing.status !== 'scheduled' && <button className="btn ghost wide" onClick={() => status('scheduled')}>Re-open</button>}
        {existing && <button className="btn danger wide" onClick={remove}>Delete</button>}
      </div>
    </Sheet>
  );
}
