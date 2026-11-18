import { useMemo, useState } from 'react';
import { bulkTag, deleteSmartList, saveSmartList, stageGroup, stageOf, useDb } from '../lib/store';
import { customerFacts, describeRule, runList } from '../lib/lists';
import { fmtDay, today } from '../lib/dates';
import { displayName, sortKey, uid } from '../lib/util';
import { Sheet, askConfirm, toast } from '../lib/ui';
import type { Db, Rule, SmartList } from '../types';

export function ListsIndex({ onOpenList }: { onOpenList: (id: string) => void }) {
  const db = useDb();
  const facts = useMemo(() => customerFacts(db), [db]);
  const [editing, setEditing] = useState<SmartList | null>(null);
  return (
    <>
      <header className="screen-head">
        <div className="head-row"><h1 className="title">Lists</h1><button className="btn sm" onClick={() => setEditing(newList())}>+ New list</button></div>
      </header>
      <div className="body">
        <p className="muted" style={{ margin: 0 }}>Smart lists are saved searches. They update themselves as customers move through stages, get texted or have jobs finished.</p>
        <div className="card">
          {db.smartLists.map((l) => {
            const n = runList(l, db, facts).length;
            return (
              <button key={l.id} className="row" onClick={() => onOpenList(l.id)}>
                <span className="stripe" style={{ background: n ? 'var(--action)' : 'var(--line)' }} />
                <span className="grow">
                  <div className="nm">{l.name}{l.pinned && <span className="sample-badge">On Today</span>}</div>
                  <div className="meta">{l.rules.map((r) => describeRule(r, db)).join(' · ') || 'No rules yet'}</div>
                </span>
                <b style={{ font: '800 24px var(--font-display)' }}>{n}</b>
              </button>
            );
          })}
        </div>
      </div>
      {editing && <ListEditor list={editing} onClose={() => setEditing(null)} onSaved={(l) => { setEditing(null); onOpenList(l.id); }} />}
    </>
  );
}

function newList(): SmartList {
  return { id: `sl-${uid().slice(0, 8)}`, name: '', why: '', rules: [], pinned: false, updatedAt: 0 };
}

export function ListView({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const db = useDb();
  const list = db.smartLists.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);
  const [tagging, setTagging] = useState(false);
  const people = useMemo(() => (list ? runList(list, db).sort((a, b) => sortKey(a).localeCompare(sortKey(b))) : []), [list, db]);

  if (!list) {
    return (<div className="body"><button className="back" onClick={onBack}>‹ Lists</button><div className="empty"><h2>List not found</h2></div></div>);
  }

  return (
    <>
      <header className="screen-head">
        <div className="head-row">
          <button className="back" onClick={onBack}>‹ Lists</button>
          <span className="grow" />
          <button className="btn sm" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <h1 className="title">{list.name}<small>{people.length}</small></h1>
      </header>
      <div className="body">
        {list.why && <p className="muted" style={{ margin: 0 }}>{list.why}</p>}
        <div className="chips wrap">{list.rules.map((r, i) => <span key={i} className="chip">{describeRule(r, db)}</span>)}</div>
        <div className="grid2">
          <button className="btn" onClick={() => { saveSmartList({ ...list, pinned: !list.pinned }); toast(list.pinned ? 'Removed from Today' : 'Pinned to Today'); }}>{list.pinned ? 'Unpin' : 'Pin to Today'}</button>
          <button className="btn" disabled={!people.length} onClick={() => setTagging(true)}>Tag all…</button>
        </div>
        {people.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24 }}>Nobody matches right now.</p>
        ) : (
          <div className="card">
            {people.map((c) => {
              const s = stageOf(c, db);
              const fu = c.followUp;
              return (
                <button key={c.id} className="row" onClick={() => onOpen(c.id)}>
                  <span className="stripe" style={{ background: s?.color }} />
                  <span className="grow">
                    <div className="nm">{displayName(c)}</div>
                    <div className="meta">{[fu ? `Follow up ${fu.date <= today() ? 'due' : fmtDay(fu.date)}: ${fu.note}` : '', c.properties[0]?.address, s?.name].filter(Boolean).join(' · ')}</div>
                  </span>
                  <span className="muted">›</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Texting everyone on a list arrives with the Quo connection.</p>
      </div>
      {editing && <ListEditor list={list} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} onDeleted={onBack} />}
      {tagging && <BulkTag ids={people.map((c) => c.id)} db={db} onClose={() => setTagging(false)} />}
    </>
  );
}

function BulkTag({ ids, db, onClose }: { ids: string[]; db: Db; onClose: () => void }) {
  return (
    <Sheet title={`Tag ${ids.length}`} onClose={onClose}>
      <div className="sheet-body">
        <p className="muted" style={{ margin: 0 }}>Tap a tag to add it to everyone on this list. Tap again to remove it.</p>
        {db.tagGroups.map((g) => (
          <div key={g.id} className="taggroup">
            <div className="eyebrow">{g.name}</div>
            <div className="chips wrap">
              {g.tags.map((t) => {
                const all = ids.every((id) => db.customers.find((c) => c.id === id)?.tagIds.includes(t.id));
                return (
                  <button key={t.id} className={all ? 'chip on' : 'chip'} onClick={() => { bulkTag(ids, t.id, !all); toast(`${all ? 'Removed' : 'Added'} ${t.name}`); }}>
                    {t.color && <i style={{ background: t.color }} />}{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn brand wide" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

const RULE_CHOICES: { label: string; make: (db: Db) => Rule }[] = [
  { label: 'Has a tag', make: (db) => ({ type: 'tag', tagId: db.tagGroups[0]?.tags[0]?.id || '' }) },
  { label: "Doesn't have a tag", make: (db) => ({ type: 'tag', tagId: db.tagGroups[0]?.tags[0]?.id || '', not: true }) },
  { label: 'In a stage for days', make: (db) => ({ type: 'stageFor', stageId: stageGroup(db)?.tags[0]?.id || '', days: 7 }) },
  { label: 'No contact for days', make: () => ({ type: 'noContact', days: 14 }) },
  { label: 'Last job days ago', make: () => ({ type: 'lastJob', days: 330 }) },
  { label: 'Follow-up due', make: () => ({ type: 'followUpDue' }) },
];

function ListEditor({ list, onClose, onSaved, onDeleted }: { list: SmartList; onClose: () => void; onSaved: (l: SmartList) => void; onDeleted?: () => void }) {
  const db = useDb();
  const [l, setL] = useState<SmartList>(() => structuredClone(list));
  const isNew = !db.smartLists.some((x) => x.id === list.id);
  const setRule = (i: number, r: Rule) => setL((x) => ({ ...x, rules: x.rules.map((y, j) => (j === i ? r : y)) }));
  const preview = runList(l, db).length;

  const save = () => {
    if (!l.name.trim()) { toast('Give the list a name'); return; }
    if (!l.rules.length) { toast('Add at least one rule'); return; }
    const next = { ...l, name: l.name.trim(), why: l.why.trim() };
    saveSmartList(next);
    toast('List saved');
    onSaved(next);
  };
  const remove = async () => {
    if (!(await askConfirm('Delete list', `Delete “${l.name}”? Customers aren't affected.`, 'Delete', true))) return;
    deleteSmartList(l.id);
    onClose();
    onDeleted?.();
  };

  const tagSelect = (value: string, onChange: (v: string) => void, onlyStage = false) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Tag">
      {db.tagGroups.filter((g) => !onlyStage || g.pipeline).map((g) => (
        <optgroup key={g.id} label={g.name}>{g.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
      ))}
    </select>
  );
  const daysInput = (value: number, onChange: (v: number) => void) => (
    <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} aria-label="Days" style={{ width: 90 }} />
  );

  return (
    <Sheet title={isNew ? 'New list' : 'Edit list'} onClose={onClose} full right={<button className="link" onClick={save}>Save</button>}>
      <div className="sheet-body form">
        <label className="field">Name<input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="e.g. Storm leads this week" autoFocus={isNew} /></label>
        <label className="field">What it's for (optional)<input value={l.why} onChange={(e) => setL({ ...l, why: e.target.value })} /></label>
        <div className="fieldset">
          <div className="fieldset-head"><span className="eyebrow">Customers who match all of these</span></div>
          {l.rules.map((r, i) => (
            <div key={i} className="rule-row">
              {r.type === 'tag' && (<>
                <select value={r.not ? 'not' : 'has'} onChange={(e) => setRule(i, { ...r, not: e.target.value === 'not' })} aria-label="Has or not">
                  <option value="has">Tagged</option><option value="not">Not tagged</option>
                </select>
                {tagSelect(r.tagId, (v) => setRule(i, { ...r, tagId: v }))}
              </>)}
              {r.type === 'stageFor' && (<><span>In</span>{tagSelect(r.stageId, (v) => setRule(i, { ...r, stageId: v }), true)}<span>for</span>{daysInput(r.days, (v) => setRule(i, { ...r, days: v }))}<span>+ days</span></>)}
              {r.type === 'noContact' && (<><span>No text, call or note in</span>{daysInput(r.days, (v) => setRule(i, { ...r, days: v }))}<span>+ days</span></>)}
              {r.type === 'lastJob' && (<><span>Last finished job</span>{daysInput(r.days, (v) => setRule(i, { ...r, days: v }))}<span>+ days ago</span></>)}
              {r.type === 'followUpDue' && <span>Follow-up is due</span>}
              <button className="rm" aria-label="Remove rule" onClick={() => setL({ ...l, rules: l.rules.filter((_, j) => j !== i) })}>−</button>
            </div>
          ))}
          <div className="chips wrap">
            {RULE_CHOICES.map((c) => <button key={c.label} className="chip add" onClick={() => setL({ ...l, rules: [...l.rules, c.make(db)] })}>+ {c.label}</button>)}
          </div>
        </div>
        <p style={{ margin: 0 }}><b>{preview}</b> {preview === 1 ? 'customer matches' : 'customers match'} right now.</p>
        <label className="inline-check"><input type="checkbox" checked={l.pinned} onChange={(e) => setL({ ...l, pinned: e.target.checked })} /> Show on Today</label>
        <button className="btn action wide" onClick={save}>Save list</button>
        {!isNew && <button className="btn danger wide" onClick={remove}>Delete list</button>}
      </div>
    </Sheet>
  );
}
