import { useState } from 'react';
import { deleteCustomer, getDb, newCustomer, saveCustomer, stageGroup } from '../lib/store';
import { displayName, uid } from '../lib/util';
import { Sheet, askConfirm, toast } from '../lib/ui';
import type { Customer, LabeledValue, Property } from '../types';

const PHONE_LABELS = ['mobile', 'home', 'work', 'other'];
const EMAIL_LABELS = ['home', 'work', 'other'];

const blankProperty = (): Property => ({ id: uid(), address: '', gateCode: '', access: '', hazards: [], treeNotes: '' });

export default function EditCustomer({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: (c: Customer, isNew: boolean) => void }) {
  const isNew = !customer;
  const [c, setC] = useState<Customer>(() => {
    if (customer) return structuredClone(customer);
    const newLead = stageGroup()?.tags[0]?.id;
    return newCustomer({ phones: [{ label: 'mobile', value: '' }], properties: [blankProperty()], tagIds: newLead ? [newLead] : [] });
  });
  // hazards are edited as one line of text, comma-separated
  const [hazardText, setHazardText] = useState<string[]>(() => c.properties.map((p) => p.hazards.join(', ')));

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((x) => ({ ...x, [k]: v }));
  const setList = (k: 'phones' | 'emails', i: number, patch: Partial<LabeledValue>) =>
    setC((x) => ({ ...x, [k]: x[k].map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const setProp = (i: number, patch: Partial<Property>) =>
    setC((x) => ({ ...x, properties: x.properties.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const save = () => {
    const clean: Customer = {
      ...c,
      first: c.first.trim(), last: c.last.trim(), company: c.company.trim(), notes: c.notes.trim(),
      phones: c.phones.map((p) => ({ ...p, value: p.value.trim() })).filter((p) => p.value),
      emails: c.emails.map((p) => ({ ...p, value: p.value.trim() })).filter((p) => p.value),
      properties: c.properties
        .map((p, i) => ({ ...p, address: p.address.trim(), gateCode: p.gateCode.trim(), access: p.access.trim(), treeNotes: p.treeNotes.trim(),
          hazards: (hazardText[i] || '').split(',').map((h) => h.trim()).filter(Boolean) }))
        .filter((p) => p.address || p.treeNotes || p.access || p.gateCode || p.hazards.length),
    };
    if (!clean.first && !clean.last && !clean.company && !clean.phones.length) {
      toast('Add a name, company or phone first');
      return;
    }
    const saved = saveCustomer({ ...clean, sample: isNew ? undefined : clean.sample });
    toast(isNew ? `Added ${displayName(saved)}` : 'Saved');
    onSaved(saved, isNew);
  };

  const remove = async () => {
    if (!customer) return;
    if (!(await askConfirm('Delete customer', `Delete ${displayName(customer)} and their history? This can't be undone.`, 'Delete', true))) return;
    deleteCustomer(customer.id);
    toast('Deleted');
    onClose();
    location.hash = 'people';
  };

  return (
    <Sheet title={isNew ? 'New customer' : 'Edit'} onClose={onClose} full right={<button className="link" onClick={save}>Save</button>}>
      <div className="sheet-body form">
        <div className="grid2">
          <label className="field">First name<input value={c.first} onChange={(e) => set('first', e.target.value)} autoComplete="off" autoFocus={isNew} /></label>
          <label className="field">Last name<input value={c.last} onChange={(e) => set('last', e.target.value)} autoComplete="off" /></label>
        </div>
        <label className="field">Company / HOA<input value={c.company} onChange={(e) => set('company', e.target.value)} autoComplete="off" /></label>

        <div className="fieldset">
          <div className="fieldset-head"><span className="eyebrow">Phone</span><button className="link" onClick={() => set('phones', [...c.phones, { label: 'mobile', value: '' }])}>+ Add</button></div>
          {c.phones.map((p, i) => (
            <div className="multi" key={i}>
              <select value={p.label} onChange={(e) => setList('phones', i, { label: e.target.value })} aria-label="Phone label">
                {[...new Set([...PHONE_LABELS, p.label])].map((l) => <option key={l}>{l}</option>)}
              </select>
              <input type="tel" value={p.value} onChange={(e) => setList('phones', i, { value: e.target.value })} placeholder="(555) 555-5555" aria-label="Phone number" />
              <button className="rm" aria-label="Remove phone" onClick={() => set('phones', c.phones.filter((_, j) => j !== i))}>−</button>
            </div>
          ))}
        </div>

        <div className="fieldset">
          <div className="fieldset-head"><span className="eyebrow">Email</span><button className="link" onClick={() => set('emails', [...c.emails, { label: 'home', value: '' }])}>+ Add</button></div>
          {c.emails.map((p, i) => (
            <div className="multi" key={i}>
              <select value={p.label} onChange={(e) => setList('emails', i, { label: e.target.value })} aria-label="Email label">
                {[...new Set([...EMAIL_LABELS, p.label])].map((l) => <option key={l}>{l}</option>)}
              </select>
              <input type="email" value={p.value} onChange={(e) => setList('emails', i, { value: e.target.value })} placeholder="name@example.com" autoCapitalize="off" aria-label="Email" />
              <button className="rm" aria-label="Remove email" onClick={() => set('emails', c.emails.filter((_, j) => j !== i))}>−</button>
            </div>
          ))}
        </div>

        {c.properties.map((p, i) => (
          <div className="fieldset" key={p.id}>
            <div className="fieldset-head">
              <span className="eyebrow">Property {c.properties.length > 1 ? i + 1 : ''}</span>
              {c.properties.length > 1 && <button className="link" style={{ color: 'var(--danger)' }} onClick={() => { set('properties', c.properties.filter((_, j) => j !== i)); setHazardText((h) => h.filter((_, j) => j !== i)); }}>Remove</button>}
            </div>
            <label className="field">Address<input value={p.address} onChange={(e) => setProp(i, { address: e.target.value })} placeholder="Street, town" /></label>
            <div className="grid2">
              <label className="field">Gate code<input value={p.gateCode} onChange={(e) => setProp(i, { gateCode: e.target.value })} /></label>
              <label className="field">Hazards<input value={hazardText[i] || ''} onChange={(e) => setHazardText((h) => { const n = [...h]; n[i] = e.target.value; return n; })} placeholder="Power lines, shed…" /></label>
            </div>
            <label className="field">Access notes<input value={p.access} onChange={(e) => setProp(i, { access: e.target.value })} placeholder="Park on street, dog in back…" /></label>
            <label className="field">Tree notes<textarea value={p.treeNotes} onChange={(e) => setProp(i, { treeNotes: e.target.value })} placeholder="What needs doing" /></label>
          </div>
        ))}
        <button className="btn ghost" onClick={() => { set('properties', [...c.properties, blankProperty()]); setHazardText((h) => [...h, '']); }}>+ Add another property</button>

        <label className="field">Notes<textarea value={c.notes} onChange={(e) => set('notes', e.target.value)} /></label>

        <button className="btn action wide" onClick={save}>{isNew ? 'Add customer' : 'Save changes'}</button>
        {!isNew && <button className="btn danger wide" onClick={remove}>Delete customer</button>}
        {isNew && <p className="muted" style={{ margin: 0, fontSize: 14 }}>New customers start as “{stageGroup(getDb())?.tags[0]?.name}”. Set tags on their card after saving.</p>}
      </div>
    </Sheet>
  );
}
