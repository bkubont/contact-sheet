import { useMemo, useState } from 'react';
import type { Contact } from '../types';
import { Store, displayName, loadSelection, saveSelection } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { ContactEditor } from '../components/ContactEditor';
import { PdfSheet } from '../components/PdfSheet';
import { Sheet } from '../components/Sheet';
import { toast } from '../lib/util';

const UNTAGGED = '__untagged__';

function sortKey(c: Contact) {
  return `${c.last || c.first || c.company} ${c.first}`.toLowerCase();
}

function matches(c: Contact, q: string) {
  if (!q) return true;
  const hay = [
    c.first,
    c.last,
    c.company,
    c.title,
    c.address,
    c.notes,
    c.birthday,
    ...c.tags,
    ...c.phones.map((p) => p.value),
    ...c.emails.map((e) => e.value),
  ]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export function ContactsScreen({ onOpenMenu }: { onOpenMenu: () => void }) {
  const db = useDb();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection());
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined); // undefined=closed, null=new
  const [pdfOpen, setPdfOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('');
  const [saveDirOpen, setSaveDirOpen] = useState(false);
  const [dirName, setDirName] = useState('');

  const counts = useMemo(() => Store.tagCounts(), [db]);
  const untaggedCount = useMemo(() => db.contacts.filter((c) => !c.tags.length).length, [db]);

  const visible = useMemo(() => {
    return db.contacts
      .filter((c) => {
        if (tag === null) return true;
        if (tag === UNTAGGED) return !c.tags.length;
        return c.tags.includes(tag);
      })
      .filter((c) => matches(c, query))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: 'base' }));
  }, [db, tag, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of visible) {
      const letter = (sortKey(c).trim()[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()];
  }, [visible]);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSelection(next);
      return next;
    });
  }

  function selectAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((c) => next.add(c.id));
      saveSelection(next);
      return next;
    });
  }

  function clearSel() {
    setSelected(new Set());
    saveSelection(new Set());
  }

  const selectedContacts = useMemo(
    () => db.contacts.filter((c) => selected.has(c.id)),
    [db, selected],
  );

  function applyBulk(add: boolean) {
    let t = bulkTag.trim();
    if (!t) return;
    const existing = counts.find(([x]) => x.toLowerCase() === t.toLowerCase());
    if (existing) t = existing[0];
    Store.bulkTag([...selected], t, add);
    toast(add ? `Tagged ${selected.size}` : `Removed tag from ${selected.size}`);
    setBulkTagOpen(false);
    setBulkTag('');
  }

  function saveAsDirectory() {
    const name = dirName.trim();
    if (!name || !selected.size) return;
    Store.upsertDirectory({
      id: crypto.randomUUID?.() || String(Date.now()),
      name,
      notes: '',
      mode: 'manual',
      contactIds: [...selected],
      tags: [],
      match: 'any',
      created: Date.now(),
      updated: Date.now(),
    });
    toast(`Saved “${name}”`);
    setSaveDirOpen(false);
    setDirName('');
  }

  const presetTag = tag && tag !== UNTAGGED ? tag : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <button className="icon-btn" aria-label="Menu" onClick={onOpenMenu}>
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <h1 className="brand">
            Contact Sheet
            <span>{db.contacts.length || ''}</span>
          </h1>
          <button className="icon-btn accent" aria-label="Add contact" onClick={() => setEditing(null)}>
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="search">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4.5-4.5" />
          </svg>
          <input
            type="search"
            placeholder="Search name, company, phone, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        {db.contacts.length > 0 && (
          <div className="chips">
            <button className={`chip${tag === null ? ' on' : ''}`} onClick={() => setTag(null)}>
              All
            </button>
            {counts.map(([t, n]) => (
              <button
                key={t}
                className={`chip${tag === t ? ' on' : ''}`}
                onClick={() => setTag(tag === t ? null : t)}
              >
                {t}
                <span className="n">{n}</span>
              </button>
            ))}
            {!!counts.length && !!untaggedCount && (
              <button
                className={`chip${tag === UNTAGGED ? ' on' : ''}`}
                onClick={() => setTag(tag === UNTAGGED ? null : UNTAGGED)}
              >
                Untagged
                <span className="n">{untaggedCount}</span>
              </button>
            )}
          </div>
        )}
      </header>

      {!db.contacts.length ? (
        <div className="empty">
          <p className="mark">Contact Sheet</p>
          <h2>Your personal directory</h2>
          <p>Import contacts, tag them, save directories, and print a PDF of whoever you pick.</p>
          <div className="actions">
            <button className="btn primary" onClick={onOpenMenu}>
              Import contacts
            </button>
            <button className="btn" onClick={() => setEditing(null)}>
              Add a contact
            </button>
          </div>
        </div>
      ) : !visible.length ? (
        <div className="empty">
          <h2>No matches</h2>
          <p>Try another search or tag filter.</p>
        </div>
      ) : (
        <main className="list">
          {grouped.map(([letter, people]) => (
            <section key={letter}>
              <div className="letter">{letter}</div>
              {people.map((c, i) => {
                const sel = selected.has(c.id);
                const meta = [c.title, c.company].filter(Boolean).join(' · ') || c.phones[0]?.value || c.emails[0]?.value || '';
                return (
                  <div key={c.id} className={`row${sel ? ' sel' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                    <button
                      type="button"
                      className="pick"
                      aria-label="Select"
                      aria-pressed={sel}
                      onClick={() => toggleSel(c.id)}
                    >
                      {sel && (
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </button>
                    <button type="button" className="row-main" style={{ border: 0, background: 'transparent', textAlign: 'left', padding: 0 }} onClick={() => setEditing(c)}>
                      <div className="row-name">{displayName(c)}</div>
                      {meta && <div className="row-meta">{meta}</div>}
                      {!!c.tags.length && (
                        <div className="pills">
                          {c.tags.map((t) => (
                            <span key={t} className="pill">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    <button type="button" className="row-open" aria-label="Open" onClick={() => setEditing(c)}>
                      <svg viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
        </main>
      )}

      {selected.size > 0 && (
        <footer className="selbar">
          <div className="selbar-info">
            <b>{selected.size}</b> selected
            <button type="button" className="link" onClick={selectAllShown}>
              Select all shown
            </button>
            <button type="button" className="link" onClick={clearSel}>
              Clear
            </button>
          </div>
          <div className="selbar-actions">
            <button type="button" className="btn" onClick={() => setBulkTagOpen(true)}>
              Tag…
            </button>
            <button type="button" className="btn" onClick={() => { setDirName(tag && tag !== UNTAGGED ? tag : ''); setSaveDirOpen(true); }}>
              Save list
            </button>
            <button type="button" className="btn primary" onClick={() => setPdfOpen(true)}>
              Make PDF
            </button>
          </div>
        </footer>
      )}

      {/* Quick PDF of current filter without selecting */}
      {db.contacts.length > 0 && selected.size === 0 && visible.length > 0 && (
        <footer className="selbar" style={{ opacity: 0.97 }}>
          <div className="selbar-info">
            <span className="muted">{visible.length} shown</span>
            <button type="button" className="link" onClick={selectAllShown}>
              Select all
            </button>
          </div>
          <div className="selbar-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const ids = new Set(visible.map((c) => c.id));
                setSelected(ids);
                saveSelection(ids);
                setPdfOpen(true);
              }}
            >
              PDF these
            </button>
          </div>
        </footer>
      )}

      <ContactEditor
        open={editing !== undefined}
        contact={editing ?? null}
        presetTag={presetTag}
        onClose={() => setEditing(undefined)}
      />
      <PdfSheet open={pdfOpen} contacts={selectedContacts.length ? selectedContacts : visible} defaultTitle={tag && tag !== UNTAGGED ? tag : 'Contact Sheet'} onClose={() => setPdfOpen(false)} />

      <Sheet open={bulkTagOpen} title="Tag selected" onClose={() => setBulkTagOpen(false)}>
        <p className="muted">
          Add or remove a tag on {selected.size} selected contact{selected.size === 1 ? '' : 's'}.
        </p>
        <label>
          Tag
          <input
            value={bulkTag}
            list="tag-list"
            placeholder="e.g. Family"
            onChange={(e) => setBulkTag(e.target.value)}
          />
        </label>
        <datalist id="tag-list">
          {counts.map(([t]) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="grid2">
          <button type="button" className="btn primary" onClick={() => applyBulk(true)}>
            Add tag
          </button>
          <button type="button" className="btn" onClick={() => applyBulk(false)}>
            Remove tag
          </button>
        </div>
      </Sheet>

      <Sheet
        open={saveDirOpen}
        title="Save directory"
        onClose={() => setSaveDirOpen(false)}
        right={
          <button type="button" className="link strong" onClick={saveAsDirectory}>
            Save
          </button>
        }
      >
        <p className="muted">
          Save {selected.size} selected contact{selected.size === 1 ? '' : 's'} as a named list you can reopen later.
        </p>
        <label>
          Name
          <input value={dirName} placeholder="e.g. Family 2026" onChange={(e) => setDirName(e.target.value)} />
        </label>
      </Sheet>
    </>
  );
}
