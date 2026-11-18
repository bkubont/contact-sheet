import { Fragment, useRef, useState } from 'react';
import { addNewTag, logActivity, setFollowUp, stageGroup, stageOf, toggleTag, useDb } from '../lib/store';
import { displayName, digits, mapsUrl, timeAgo } from '../lib/util';
import { Sheet, toast } from '../lib/ui';
import type { Customer, TagGroup } from '../types';
import { editJob } from './EditJob';
import { JobRow } from './Calendar';
import { jobDates } from '../lib/store';
import { addDays, fmtDay, today } from '../lib/dates';

export default function CustomerView({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: (c: Customer) => void }) {
  const db = useDb();
  const c = db.customers.find((x) => x.id === id);
  const [picker, setPicker] = useState<TagGroup | null>(null);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLInputElement>(null);

  if (!c) {
    return (
      <div className="body">
        <button className="back" onClick={onBack}>‹ Back</button>
        <div className="empty"><h2>Not found</h2><p>This customer may have been deleted.</p></div>
      </div>
    );
  }

  const sg = stageGroup(db);
  const stage = stageOf(c, db);
  const phone = c.phones[0]?.value;
  const addr = c.properties.find((p) => p.address)?.address;
  const activities = db.activities.filter((a) => a.customerId === c.id).sort((a, b) => b.at - a.at);
  const otherGroups = db.tagGroups.filter((g) => !g.pipeline);
  const doNotText = c.tagIds.some((t) => /do-not-text/.test(t));

  const addNote = () => {
    if (!note.trim()) return;
    logActivity(c.id, 'note', note.trim());
    setNote('');
    toast('Note added');
  };

  return (
    <>
      <header className="screen-head">
        <div className="head-row">
          <button className="back" onClick={onBack}>‹ People</button>
          <span className="grow" />
          <button className="btn sm" onClick={() => onEdit(c)}>Edit</button>
        </div>
      </header>
      <div className="body">
        <section className="hero" style={{ borderTopColor: stage?.color }}>
          <div>
            <h2>{displayName(c)}</h2>
            <div className="muted">{[c.company && (c.first || c.last) ? c.company : '', ...c.tagIds.filter((t) => t.startsWith('type-') || t.startsWith('source-')).map((t) => db.tagGroups.flatMap((g) => g.tags).find((x) => x.id === t)?.name)].filter(Boolean).join(' · ')}</div>
          </div>
          {sg && (
            <div className="stages" role="group" aria-label="Stage">
              {sg.tags.map((t) => (
                <button key={t.id} className={stage?.id === t.id ? 'on' : ''} style={stage?.id === t.id ? { background: t.color } : undefined}
                  onClick={() => { if (stage?.id !== t.id) { toggleTag(c.id, t.id); toast(`Stage: ${t.name}`); } }}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="acts">
            <a className="btn action" href={phone && !doNotText ? `sms:${digits(phone)}` : undefined} aria-disabled={!phone || doNotText}
              onClick={(e) => { if (!phone || doNotText) { e.preventDefault(); toast(doNotText ? 'Tagged “Do not text”' : 'No phone number'); return; } logActivity(c.id, 'text', 'Texted'); }}>Text</a>
            <a className="btn" href={phone ? `tel:${digits(phone)}` : undefined}
              onClick={(e) => { if (!phone) { e.preventDefault(); toast('No phone number'); return; } logActivity(c.id, 'call', 'Called'); }}>Call</a>
            <a className="btn" href={addr ? mapsUrl(addr) : undefined} target="_blank" rel="noopener"
              onClick={(e) => { if (!addr) { e.preventDefault(); toast('No address'); } }}>Nav</a>
            <button className="btn" onClick={() => noteRef.current?.focus()}>Log</button>
          </div>
        </section>

        <FollowUpBox id={c.id} />

        <section className="section">
          <div className="grid2">
            <button className="btn" onClick={() => editJob({ kind: 'estimate', customerId: c.id })}>+ Estimate</button>
            <button className="btn" onClick={() => editJob({ kind: 'job', customerId: c.id, start: '07:30', crew: db.settings.crew.slice(0, 2) })}>+ Job</button>
          </div>
          {(() => {
            const t = today();
            const mine = db.jobs.filter((j) => j.customerId === c.id && j.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date));
            const upcoming = mine.filter((j) => j.status === 'scheduled' && jobDates(j).some((d) => d >= t));
            const past = mine.filter((j) => !upcoming.includes(j)).slice(-3).reverse();
            return (
              <>
                {upcoming.length > 0 && <div className="eyebrow">Scheduled</div>}
                {upcoming.length > 0 && <div className="evs">{upcoming.map((j) => <JobRow key={j.id} job={j} date={j.date} db={db} />)}</div>}
                {past.length > 0 && <div className="eyebrow">Past visits</div>}
                {past.length > 0 && <div className="evs">{past.map((j) => <JobRow key={j.id} job={j} date={j.date} db={db} />)}</div>}
              </>
            );
          })()}
        </section>

        {c.properties.map((p, i) => (
          <section className="prop" key={p.id}>
            <div className="section-head"><span className="eyebrow">Property</span>{c.properties.length > 1 && <span className="eyebrow">{i + 1} of {c.properties.length}</span>}</div>
            {p.address && <a className="addr" href={mapsUrl(p.address)} target="_blank" rel="noopener">{p.address}</a>}
            {p.hazards.map((h) => <div className="hazard" key={h}>{h}</div>)}
            {(p.gateCode || p.access) && (
              <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
                {p.gateCode && <span className="chip">Gate {p.gateCode}</span>}
                {p.access && <span className="chip">{p.access}</span>}
              </div>
            )}
            {p.treeNotes && <div>{p.treeNotes}</div>}
          </section>
        ))}

        {(c.phones.length > 0 || c.emails.length > 0) && (
          <section className="prop">
            <dl className="kv">
              {c.phones.map((p, i) => (<Fragment key={`p${i}`}><dt>{p.label}</dt><dd><a href={`tel:${digits(p.value)}`}>{p.value}</a></dd></Fragment>))}
              {c.emails.map((e, i) => (<Fragment key={`e${i}`}><dt>{e.label === 'other' ? 'email' : e.label}</dt><dd><a href={`mailto:${e.value}`}>{e.value}</a></dd></Fragment>))}
            </dl>
          </section>
        )}

        <section className="section">
          {otherGroups.map((g) => {
            const on = g.tags.filter((t) => c.tagIds.includes(t.id));
            return (
              <div className="taggroup" key={g.id}>
                <div className="eyebrow">{g.name}</div>
                <div className="chips">
                  {on.map((t) => <button key={t.id} className={/power|dog|crane/i.test(t.name) ? 'chip warn' : 'chip'} onClick={() => setPicker(g)}>{t.name}</button>)}
                  <button className="chip add" onClick={() => setPicker(g)}>{on.length ? 'Change' : '+ Add'}</button>
                </div>
              </div>
            );
          })}
        </section>

        {c.notes && (
          <section className="prop"><span className="eyebrow">Notes</span><div style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div></section>
        )}

        <section className="section">
          <div className="eyebrow">Activity</div>
          <div className="notebox">
            <input ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or log a call…" enterKeyHint="done"
              onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }} aria-label="New note" />
            <button className="btn brand" onClick={addNote} disabled={!note.trim()}>Add</button>
          </div>
          <div className="timeline">
            {activities.map((a) => (
              <div key={a.id} className={a.type === 'stage' ? 'tl stage' : 'tl'}>
                <span><b>{a.type === 'note' ? 'Note: ' : ''}</b>{a.body}<small>{timeAgo(a.at)}</small></span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {picker && <TagPicker group={picker} customer={c} onClose={() => setPicker(null)} />}
    </>
  );
}

function TagPicker({ group, customer, onClose }: { group: TagGroup; customer: Customer; onClose: () => void }) {
  const db = useDb();
  const g = db.tagGroups.find((x) => x.id === group.id) || group;
  const c = db.customers.find((x) => x.id === customer.id) || customer;
  const [name, setName] = useState('');
  return (
    <Sheet title={g.name} onClose={onClose} right={<button className="link" onClick={onClose}>Done</button>}>
      <div className="sheet-body">
        <p className="muted" style={{ margin: 0 }}>{g.mode === 'one' ? 'Pick one.' : 'Pick any that apply.'}</p>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {g.tags.map((t) => (
            <button key={t.id} className={c.tagIds.includes(t.id) ? 'chip on' : 'chip'} style={{ fontSize: 16, padding: '10px 14px' }}
              onClick={() => { toggleTag(c.id, t.id); if (g.mode === 'one') onClose(); }}>{t.name}</button>
          ))}
        </div>
        {g.allowNew && (
          <div className="notebox">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${g.name.toLowerCase()} tag`} aria-label="New tag"
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { addNewTag(c.id, g.id, name); setName(''); } }} />
            <button className="btn brand" disabled={!name.trim()} onClick={() => { addNewTag(c.id, g.id, name); setName(''); }}>Add</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const QUICK: [string, number][] = [['Tomorrow', 1], ['3 days', 3], ['1 week', 7], ['2 weeks', 14], ['1 month', 30], ['3 months', 91]];

function FollowUpBox({ id }: { id: string }) {
  const db = useDb();
  const c = db.customers.find((x) => x.id === id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(addDays(today(), 3));
  if (!c) return null;
  const fu = c.followUp;
  const due = fu && fu.date <= today();

  const start = () => { setNote(fu?.note || ''); setDate(fu?.date || addDays(today(), 3)); setOpen(true); };
  const save = () => {
    setFollowUp(c.id, { date, note: note.trim() || 'Follow up' }, `Follow-up set for ${fmtDay(date)}${note.trim() ? `: ${note.trim()}` : ''}`);
    setOpen(false);
    toast(`Follow up ${fmtDay(date)}`);
  };

  return (
    <>
      {fu ? (
        <section className={due ? 'follow due' : 'follow'}>
          <div className="grow">
            <b>{due ? (fu.date < today() ? `Overdue · ${fmtDay(fu.date)}` : 'Follow up today') : `Follow up ${fmtDay(fu.date)}`}</b>
            <div>{fu.note}</div>
          </div>
          <button className="btn sm" onClick={start}>Change</button>
          <button className="btn sm brand" onClick={() => { setFollowUp(c.id, undefined, `Followed up: ${fu.note}`); toast('Follow-up done'); }}>Done</button>
        </section>
      ) : (
        <button className="btn ghost wide" onClick={start}>+ Set a follow-up</button>
      )}
      {open && (
        <Sheet title="Follow up" onClose={() => setOpen(false)}>
          <div className="sheet-body">
            <div className="chips wrap">
              {QUICK.map(([label, n]) => {
                const d = addDays(today(), n);
                return <button key={label} className={date === d ? 'chip on' : 'chip'} onClick={() => setDate(d)}>{label}</button>;
              })}
            </div>
            <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field">What for<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Check if they want the stump ground" /></label>
            <button className="btn action wide" onClick={save}>Follow up {fmtDay(date)}</button>
            {fu && <button className="btn ghost wide" onClick={() => { setFollowUp(c.id, undefined, 'Follow-up removed'); setOpen(false); }}>Remove follow-up</button>}
          </div>
        </Sheet>
      )}
    </>
  );
}
