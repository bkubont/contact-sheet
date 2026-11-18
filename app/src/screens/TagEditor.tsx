import { useState } from 'react';
import { addGroup, addTag, deleteGroup, deleteTag, moveTag, renameGroup, tagCount, updateTag, useDb } from '../lib/store';
import { Sheet, askConfirm, toast } from '../lib/ui';

const PALETTE = ['#2a72d4', '#c48a00', '#e85a0c', '#23914f', '#7b8676', '#8a4fbf', '#c62d6b', '#0f8a8a'];

export function GroupEditor({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const db = useDb();
  const g = db.tagGroups.find((x) => x.id === groupId);
  const [name, setName] = useState(g?.name || '');
  const [newTag, setNewTag] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  if (!g) return null;

  const add = () => {
    if (!newTag.trim()) return;
    if (!addTag(g.id, newTag)) { toast('That tag already exists'); return; }
    setNewTag('');
  };
  const removeTag = async (id: string, label: string) => {
    const n = tagCount(id, db);
    if (!(await askConfirm('Delete tag', n ? `Remove “${label}” from ${n} ${n === 1 ? 'customer' : 'customers'} and delete it?` : `Delete “${label}”?`, 'Delete', true))) return;
    deleteTag(id);
  };
  const removeGroup = async () => {
    if (!(await askConfirm('Delete group', `Delete the “${g.name}” group and all its tags? Customers stay; only the tags are removed.`, 'Delete group', true))) return;
    deleteGroup(g.id);
    onClose();
  };

  return (
    <Sheet title="Edit tags" onClose={onClose} full right={<button className="link" onClick={onClose}>Done</button>}>
      <div className="sheet-body form">
        <label className="field">Group name
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => renameGroup(g.id, name)} />
        </label>
        <p className="muted" style={{ margin: 0 }}>{g.pipeline ? 'Your pipeline. Each customer is in exactly one stage, in this order.' : g.mode === 'one' ? 'Pick one: a customer can have only one tag from this group.' : 'Pick many: a customer can have any number of these.'}</p>

        <div className="card">
          {g.tags.map((t, i) => (
            <div key={t.id} className="tag-edit">
              <div className="tag-edit-row">
                <button className="swatch" style={{ background: t.color || 'var(--raise)' }} aria-label={`Color for ${t.name}`} onClick={() => setColorFor(colorFor === t.id ? null : t.id)} />
                <input defaultValue={t.name} aria-label="Tag name" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) updateTag(t.id, { name: v }); else e.target.value = t.name; }} />
                <span className="muted n">{tagCount(t.id, db)}</span>
                <button className="mini" aria-label="Move up" disabled={i === 0} onClick={() => moveTag(t.id, -1)}>↑</button>
                <button className="mini" aria-label="Move down" disabled={i === g.tags.length - 1} onClick={() => moveTag(t.id, 1)}>↓</button>
                {!(g.pipeline && g.tags.length <= 2) && <button className="mini danger" aria-label={`Delete ${t.name}`} onClick={() => removeTag(t.id, t.name)}>×</button>}
              </div>
              {colorFor === t.id && (
                <div className="palette">
                  {PALETTE.map((c) => <button key={c} style={{ background: c }} aria-label={c} className={t.color === c ? 'on' : ''} onClick={() => { updateTag(t.id, { color: c }); setColorFor(null); }} />)}
                  {!g.pipeline && <button className="none" onClick={() => { updateTag(t.id, { color: undefined }); setColorFor(null); }}>No color</button>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="notebox">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag" aria-label="New tag" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn brand" onClick={add} disabled={!newTag.trim()}>Add</button>
        </div>
        {g.pipeline && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Renaming stages is fine. The calendar and follow-up automations use the original six stages, so keep them in place.</p>}
        {!g.pipeline && <button className="btn danger wide" onClick={removeGroup}>Delete this group</button>}
      </div>
    </Sheet>
  );
}

export function NewGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'one' | 'many'>('many');
  const create = () => {
    const g = addGroup(name, mode);
    if (!g) { toast('Give the group a name'); return; }
    onCreated(g.id);
  };
  return (
    <Sheet title="New tag group" onClose={onClose}>
      <div className="sheet-body form">
        <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neighborhood" autoFocus /></label>
        <div className="seg" role="group" aria-label="Type">
          <button className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>Pick one</button>
          <button className={mode === 'many' ? 'on' : ''} onClick={() => setMode('many')}>Pick many</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>{mode === 'one' ? 'A customer can have only one tag from this group, like a neighborhood.' : 'A customer can have any number of these, like services.'}</p>
        <button className="btn action wide" onClick={create}>Create group</button>
      </div>
    </Sheet>
  );
}
