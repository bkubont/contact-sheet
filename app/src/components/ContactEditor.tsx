import { useEffect, useState } from 'react';
import type { Contact, LabeledValue } from '../types';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { Sheet } from './Sheet';
import { WorkHistory } from './WorkHistory';

const PHONE_LABELS = ['mobile', 'home', 'work', 'main', 'fax', 'other'];
const EMAIL_LABELS = ['home', 'work', 'other'];

function MultiRows({
  kind,
  labels,
  rows,
  onChange,
}: {
  kind: string;
  labels: string[];
  rows: LabeledValue[];
  onChange: (rows: LabeledValue[]) => void;
}) {
  return (
    <fieldset>
      <legend>{kind}</legend>
      <div className="multi">
        {rows.map((row, i) => (
          <div className="mrow" key={i}>
            <select
              aria-label={`${kind} label`}
              value={row.label}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
            >
              {[...new Set([...labels, row.label])].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              value={row.value}
              placeholder={kind === 'Phone' ? 'Number' : 'Address'}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], value: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="link"
        onClick={() => onChange([...rows, { label: labels[0], value: '' }])}
      >
        + Add {kind.toLowerCase()}
      </button>
    </fieldset>
  );
}

export function ContactEditor({
  open,
  contact,
  presetTag,
  presetCategory,
  onClose,
}: {
  open: boolean;
  contact: Contact | null;
  presetTag?: string | null;
  presetCategory?: string | null;
  onClose: () => void;
}) {
  const db = useDb();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phones, setPhones] = useState<LabeledValue[]>([{ label: 'mobile', value: '' }]);
  const [emails, setEmails] = useState<LabeledValue[]>([{ label: 'home', value: '' }]);
  const [address, setAddress] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setFirst(contact.first);
      setLast(contact.last);
      setCompany(contact.company);
      setTitle(contact.title);
      setPhones(contact.phones.length ? contact.phones : [{ label: 'mobile', value: '' }]);
      setEmails(contact.emails.length ? contact.emails : [{ label: 'home', value: '' }]);
      setAddress(contact.address);
      setBirthday(contact.birthday);
      setNotes(contact.notes);
      setTags([...contact.tags]);
      setCategory(contact.category || '');
    } else {
      setFirst('');
      setLast('');
      setCompany('');
      setTitle('');
      setPhones([{ label: 'mobile', value: '' }]);
      setEmails([{ label: 'home', value: '' }]);
      setAddress('');
      setBirthday('');
      setNotes('');
      setTags(presetTag ? [presetTag] : []);
      setCategory(presetCategory || '');
    }
    setTagInput('');
  }, [open, contact, presetTag, presetCategory]);

  function addTag(raw: string) {
    let t = raw.trim();
    if (!t) return;
    const existing = Store.tagCounts().find(([x]) => x.toLowerCase() === t.toLowerCase());
    if (existing) t = existing[0];
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function toggleGroupTag(t: string) {
    if (tags.includes(t)) setTags(tags.filter((x) => x !== t));
    else setTags([...tags, t]);
  }

  function save() {
    if (tagInput.trim()) addTag(tagInput);
    Store.upsert({
      id: contact?.id,
      created: contact?.created,
      first,
      last,
      company,
      title,
      phones,
      emails,
      address,
      birthday,
      notes,
      tags,
      category,
    });
    onClose();
  }

  function remove() {
    if (!contact) return;
    if (!confirm(`Delete ${Store.displayName(contact)}?`)) return;
    Store.remove(contact.id);
    onClose();
  }

  const suggestions = Store.tagCounts()
    .map(([t]) => t)
    .filter((t) => !tags.includes(t) && (!tagInput || t.toLowerCase().includes(tagInput.toLowerCase())))
    .slice(0, 12);

  const groupedTagNames = new Set(db.tagGroups.flatMap((g) => g.tags));

  return (
    <Sheet
      open={open}
      title={contact ? 'Edit contact' : 'New contact'}
      onClose={onClose}
      right={
        <button type="button" className="link strong" onClick={save}>
          Save
        </button>
      }
    >
      <div className="grid2">
        <label>
          First name
          <input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Last name
          <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <div className="grid2">
        <label>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Job title
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        </label>
      </div>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— None —</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {contact && <WorkHistory contact={contact} />}

      <MultiRows kind="Phone" labels={PHONE_LABELS} rows={phones} onChange={setPhones} />
      <MultiRows kind="Email" labels={EMAIL_LABELS} rows={emails} onChange={setEmails} />

      <label>
        Address
        <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <label>
        Birthday
        <input
          value={birthday}
          placeholder="e.g. 1980-04-12 or April 12"
          onChange={(e) => setBirthday(e.target.value)}
        />
      </label>

      <fieldset>
        <legend>Tags</legend>
        <div className="pills">
          {tags.map((t) => (
            <button key={t} type="button" className="pill x" onClick={() => setTags(tags.filter((x) => x !== t))}>
              {t}
            </button>
          ))}
        </div>
        {db.tagGroups.map((g) =>
          g.tags.length ? (
            <div key={g.id} className="tag-group-block" style={{ marginTop: 8 }}>
              <h4>{g.name}</h4>
              <div className="suggest">
                {g.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={tags.includes(t) ? 'pill gold' : undefined}
                    style={
                      tags.includes(t)
                        ? undefined
                        : { border: '1px dashed var(--line)', borderRadius: 4, padding: '4px 10px' }
                    }
                    onClick={() => toggleGroupTag(t)}
                  >
                    {tags.includes(t) ? t : `+ ${t}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null,
        )}
        <input
          value={tagInput}
          placeholder="Add custom tag and press Enter"
          enterKeyHint="done"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(tagInput);
            }
            if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
          }}
          onBlur={() => {
            if (tagInput.trim()) addTag(tagInput);
          }}
        />
        <div className="suggest">
          {suggestions
            .filter((t) => !groupedTagNames.has(t))
            .map((t) => (
              <button key={t} type="button" onClick={() => addTag(t)}>
                + {t}
              </button>
            ))}
        </div>
      </fieldset>

      <label>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {contact && (
        <button type="button" className="btn danger wide" onClick={remove}>
          Delete contact
        </button>
      )}
    </Sheet>
  );
}
