import { useRef, useState } from 'react';
import { clearSamples, getDb, importCustomers, loadSamples, replaceDb, stageGroup, updateSettings, useDb } from '../lib/store';
import { parseContactFile } from '../lib/importers';
import { Sheet, askConfirm, toast } from '../lib/ui';
import type { Customer, Db } from '../types';
import { GroupEditor, NewGroup } from './TagEditor';

export default function More() {
  const db = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; list: Customer[] } | null>(null);
  const [stageId, setStageId] = useState('stage-past');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const sampleCount = db.customers.filter((c) => c.sample).length;
  const sg = stageGroup(db);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const list = parseContactFile(await f.text(), f.name);
      if (!list.length) { toast(`No contacts found in ${f.name}. Use a .vcf or .csv export.`); return; }
      setPending({ name: f.name, list });
    } catch {
      toast('Could not read that file.');
    }
  };

  const doImport = () => {
    if (!pending) return;
    const { added, skipped } = importCustomers(pending.list, stageId ? [stageId] : []);
    setPending(null);
    toast(`Imported ${added}${skipped ? ` · skipped ${skipped} duplicates` : ''}`);
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(getDb(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `canopy-clients-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const restore = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Db;
      if (!Array.isArray(data.customers)) throw new Error('Not a Canopy Clients backup');
      if (!(await askConfirm('Restore backup', `Replace everything on this device with the ${data.customers.length} customers in this backup?`, 'Replace', true))) return;
      replaceDb(data);
      toast('Backup restored');
    } catch {
      toast('That file is not a valid backup.');
    }
  };

  return (
    <>
      <header className="screen-head"><div className="head-row"><h1 className="title">More</h1></div></header>
      <div className="body">
        <section className="menu">
          <div className="eyebrow">Contacts</div>
          <button className="btn action" onClick={() => fileRef.current?.click()}>Import contact file (.vcf / .csv)</button>
          {sampleCount === 0 && db.customers.length === 0 && <button className="btn" onClick={() => { loadSamples(); toast('Sample customers added'); }}>Look around with sample customers</button>}
          {sampleCount > 0 && <button className="btn" onClick={() => { clearSamples(); toast('Sample customers removed'); }}>Remove {sampleCount} sample customers</button>}
          <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
            iPhone: Contacts app → Lists → press and hold the list → Export. Quo: Contacts → Export to CSV.
            Duplicates are skipped, so importing from both is safe.
          </p>
        </section>

        <ListEditor title="Crew" items={db.settings.crew} placeholder="Add a crew member" onChange={(crew) => updateSettings({ crew })} />
        <ListEditor title="Equipment" items={db.settings.equipment} placeholder="Add equipment" onChange={(equipment) => updateSettings({ equipment })} />

        <section className="menu">
          <div className="eyebrow">Tags</div>
          {db.tagGroups.map((g) => (
            <button key={g.id} className="prop" style={{ gap: 6, textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit' }} onClick={() => setGroupId(g.id)}>
              <div className="section-head"><b>{g.name}</b><span className="link" style={{ padding: 0 }}>Edit ›</span></div>
              <div className="chips wrap">
                {g.tags.map((t) => <span key={t.id} className="chip">{t.color && <i style={{ background: t.color }} />}{t.name}</span>)}
              </div>
            </button>
          ))}
          <button className="btn ghost" onClick={() => setNewGroup(true)}>+ New tag group</button>
        </section>

        <section className="menu">
          <div className="eyebrow">Backup</div>
          <button className="btn" onClick={backup}>Download backup (.json)</button>
          <button className="btn" onClick={() => restoreRef.current?.click()}>Restore from backup</button>
          <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>Right now everything is stored on this device only. Sign-in and sync between phones come with the Quo connection.</p>
        </section>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Canopy Clients · preview build · {db.settings.businessName}</p>
      </div>

      <input ref={fileRef} type="file" hidden accept=".vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={restoreRef} type="file" hidden accept=".json,application/json" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />

      {groupId && <GroupEditor groupId={groupId} onClose={() => setGroupId(null)} />}
      {newGroup && <NewGroup onClose={() => setNewGroup(false)} onCreated={(id) => { setNewGroup(false); setGroupId(id); }} />}
      {pending && (
        <Sheet title="Import" onClose={() => setPending(null)}>
          <div className="sheet-body">
            <p style={{ margin: 0 }}>Found <b>{pending.list.length}</b> contacts in <b>{pending.name}</b>.</p>
            <label className="field">Put everyone in stage
              <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">No stage (sort them out later)</option>
                {sg?.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>Most contacts in an old file are past customers. You can change anyone's stage on their card.</p>
            <button className="btn action wide" onClick={doImport}>Import {pending.list.length} contacts</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function ListEditor({ title, items, placeholder, onChange }: { title: string; items: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  const add = () => {
    const name = v.trim();
    if (!name) return;
    if (items.some((x) => x.toLowerCase() === name.toLowerCase())) { toast(`${name} is already on the list`); return; }
    onChange([...items, name]);
    setV('');
  };
  return (
    <section className="menu">
      <div className="eyebrow">{title}</div>
      <div className="taglist">
        {items.map((x) => (
          <span key={x}>{x}<button aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))}>×</button></span>
        ))}
      </div>
      <div className="notebox">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button className="btn brand" onClick={add} disabled={!v.trim()}>Add</button>
      </div>
    </section>
  );
}
