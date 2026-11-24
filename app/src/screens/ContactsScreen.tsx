import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../types';
import { Store, displayName, loadSelection, saveSelection } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { ContactEditor } from '../components/ContactEditor';
import { PdfSheet } from '../components/PdfSheet';
import { Sheet } from '../components/Sheet';
import { downloadBlob, toast } from '../lib/util';
import { toVCard } from '../lib/importers';
import { ColorPill, Dot } from '../components/Color';

const UNTAGGED = '__untagged__';
const UNCAT = '__uncategorized__';

function sortKey(c: Contact) {
  return `${c.last || c.first || c.company} ${c.first}`.toLowerCase();
}

function matches(c: Contact, q: string, categoryName: (id: string) => string) {
  if (!q) return true;
  const hay = [
    c.first,
    c.last,
    c.company,
    c.title,
    c.address,
    c.notes,
    c.birthday,
    categoryName(c.category),
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

export function ContactsScreen({
  onOpenMenu,
  syncDot = null,
}: {
  onOpenMenu: () => void;
  syncDot?: string | null;
}) {
  const db = useDb();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection());
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined); // undefined=closed, null=new
  const [pdfOpen, setPdfOpen] = useState(false);
  /** When true, PDF uses the current selection only — never falls back to the filtered list. */
  const [pdfFromSelection, setPdfFromSelection] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('');
  const [bulkCatOpen, setBulkCatOpen] = useState(false);
  const [bulkCat, setBulkCat] = useState('');
  const [saveDirOpen, setSaveDirOpen] = useState(false);
  const [dirName, setDirName] = useState('');
  const [targetDirId, setTargetDirId] = useState<string>('');
  const [sameNameMode, setSameNameMode] = useState<'merge' | 'replace'>('merge');

  const counts = useMemo(() => Store.tagCounts(), [db]);
  const catCounts = useMemo(() => Store.categoryCounts(), [db]);
  const untaggedCount = useMemo(() => db.contacts.filter((c) => !c.tags.length).length, [db]);
  const uncatCount = useMemo(() => db.contacts.filter((c) => !c.category).length, [db]);
  const manualDirectories = useMemo(
    () => db.directories.filter((d) => d.mode === 'manual').sort((a, b) => a.name.localeCompare(b.name)),
    [db],
  );

  // Drop selection IDs that no longer exist (delete, restore, wipe).
  useEffect(() => {
    const alive = new Set(db.contacts.map((c) => c.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      if (!changed) return prev;
      saveSelection(next);
      return next;
    });
  }, [db.contacts]);

  const visible = useMemo(() => {
    return db.contacts
      .filter((c) => {
        if (categoryFilter === UNCAT) {
          if (c.category) return false;
        } else if (categoryFilter && c.category !== categoryFilter) {
          return false;
        }
        if (tag === null) return true;
        if (tag === UNTAGGED) return !c.tags.length;
        return c.tags.includes(tag);
      })
      .filter((c) => matches(c, query, Store.categoryName))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: 'base' }));
  }, [db, tag, categoryFilter, query]);

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

  const pdfContacts = pdfFromSelection ? selectedContacts : visible;

  function applyBulk(add: boolean) {
    let t = bulkTag.trim();
    if (!t) return;
    const existing = counts.find(([x]) => x.toLowerCase() === t.toLowerCase());
    if (existing) t = existing[0];
    Store.bulkTag([...selected], t, add);
    toast(add ? `Tagged ${selectedContacts.length}` : `Removed tag from ${selectedContacts.length}`);
    setBulkTagOpen(false);
    setBulkTag('');
  }

  function applyBulkCategory() {
    Store.bulkCategory([...selected], bulkCat);
    toast(bulkCat ? `Set category on ${selectedContacts.length}` : `Cleared category on ${selectedContacts.length}`);
    setBulkCatOpen(false);
  }

  function saveAsDirectory() {
    if (!selectedContacts.length) return;
    const ids = selectedContacts.map((c) => c.id);

    if (targetDirId) {
      const existing = Store.getDirectory(targetDirId);
      if (!existing || existing.mode !== 'manual') return;
      const merged = [...new Set([...existing.contactIds, ...ids])];
      Store.upsertDirectory({ ...existing, contactIds: merged });
      toast(`Added to “${existing.name}”`);
      setSaveDirOpen(false);
      setDirName('');
      setTargetDirId('');
      return;
    }

    const name = dirName.trim();
    if (!name) return;
    const sameName = db.directories.find(
      (d) => d.mode === 'manual' && d.name.toLowerCase() === name.toLowerCase(),
    );
    if (sameName) {
      const contactIds =
        sameNameMode === 'merge' ? [...new Set([...sameName.contactIds, ...ids])] : ids;
      if (
        sameNameMode === 'replace' &&
        !confirm(
          `Replace all ${sameName.contactIds.length} members of “${sameName.name}” with the ${ids.length} selected?`,
        )
      )
        return;
      Store.upsertDirectory({ ...sameName, contactIds });
      toast(sameNameMode === 'merge' ? `Merged into “${sameName.name}”` : `Replaced “${sameName.name}”`);
    } else {
      Store.upsertDirectory({
        id: crypto.randomUUID?.() || String(Date.now()),
        name,
        notes: '',
        mode: 'manual',
        contactIds: ids,
        tags: [],
        match: 'any',
        created: Date.now(),
        updated: Date.now(),
      });
      toast(`Saved “${name}”`);
    }
    setSaveDirOpen(false);
    setDirName('');
    setTargetDirId('');
    setSameNameMode('merge');
  }

  const collidingDir =
    !targetDirId && dirName.trim()
      ? db.directories.find(
          (d) => d.mode === 'manual' && d.name.toLowerCase() === dirName.trim().toLowerCase(),
        )
      : undefined;

  function bulkDelete() {
    const n = selectedContacts.length;
    if (!n) return;
    if (!confirm(`Delete ${n} selected contact${n === 1 ? '' : 's'}? This cannot be undone.`)) return;
    Store.removeMany(selectedContacts.map((c) => c.id));
    clearSel();
    toast(`Deleted ${n}`);
  }

  function exportSelected() {
    const list = selectedContacts.length ? selectedContacts : visible;
    if (!list.length) return;
    const blob = new Blob([toVCard(list)], { type: 'text/vcard' });
    downloadBlob(blob, `contacts-${list.length}.vcf`);
    toast(`Exported ${list.length}`);
  }

  const presetTag = tag && tag !== UNTAGGED ? tag : null;
  const presetCategory =
    categoryFilter && categoryFilter !== UNCAT ? categoryFilter : null;

  const pdfTitle =
    (categoryFilter && categoryFilter !== UNCAT && Store.categoryName(categoryFilter)) ||
    (tag && tag !== UNTAGGED ? tag : 'Contact Sheet');

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <button className="icon-btn" aria-label="Menu" onClick={onOpenMenu} style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            {syncDot && <span className={`sync-dot ${syncDot === 'ok' ? '' : syncDot}`} />}
          </button>
          <span className="logo-tile" aria-hidden="true" />
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
            placeholder="Search name, company, phone, tag, category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        {db.contacts.length > 0 && (
          <>
            <div className="filter-row">
              <div className="filter-label">Categories</div>
              <div className="chips">
                <button
                  className={`chip${categoryFilter === null ? ' on' : ''}`}
                  onClick={() => setCategoryFilter(null)}
                >
                  All
                </button>
                {db.categories.map((cat) => {
                  const n = catCounts.find(([id]) => id === cat.id)?.[1] || 0;
                  return (
                    <button
                      key={cat.id}
                      className={`chip${categoryFilter === cat.id ? ' on' : ''}`}
                      data-color={cat.color}
                      onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                    >
                      {cat.name}
                      <span className="n">{n}</span>
                    </button>
                  );
                })}
                {!!uncatCount && (
                  <button
                    className={`chip${categoryFilter === UNCAT ? ' on' : ''}`}
                    onClick={() => setCategoryFilter(categoryFilter === UNCAT ? null : UNCAT)}
                  >
                    Uncategorized
                    <span className="n">{uncatCount}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="filter-row">
              <div className="filter-label">Tags</div>
              <div className="chips">
                <button className={`chip${tag === null ? ' on' : ''}`} onClick={() => setTag(null)}>
                  All
                </button>
                {counts.map(([t, n]) => (
                  <button
                    key={t}
                    className={`chip${tag === t ? ' on' : ''}`}
                    data-color={Store.tagColor(t)}
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
            </div>
          </>
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
        <main className="list tablet-grid">
          {grouped.map(([letter, people]) => (
            <section key={letter}>
              <div className="letter">{letter}</div>
              {people.map((c) => {
                const sel = selected.has(c.id);
                const catName = c.category ? Store.categoryName(c.category) : '';
                const catColor = c.category ? Store.categoryColor(c.category) : undefined;
                const meta =
                  [c.title, c.company].filter(Boolean).join(' · ') ||
                  (catName ? '' : c.phones[0]?.value || c.emails[0]?.value || '');
                return (
                  <div
                    key={c.id}
                    className={`row${sel ? ' sel' : ''}`}
                    data-color={catColor}
                  >
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
                      {(catName || meta) && (
                        <div className="row-meta">
                          {catName && (
                            <span className="cat-line">
                              <Dot color={catColor!} />
                              {catName}
                            </span>
                          )}
                          {catName && meta ? ' · ' : ''}
                          {meta}
                        </div>
                      )}
                      {!!c.tags.length && (
                        <div className="pills">
                          {c.tags.map((t) => (
                            <ColorPill key={t} color={Store.tagColor(t)}>
                              {t}
                            </ColorPill>
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

      {selectedContacts.length > 0 && (
        <footer className="selbar">
          <div className="selbar-info">
            <b>{selectedContacts.length}</b> selected
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
            <button type="button" className="btn" onClick={() => { setBulkCat(selectedContacts[0]?.category || ''); setBulkCatOpen(true); }}>
              Category…
            </button>
            <button type="button" className="btn" onClick={exportSelected}>
              Export
            </button>
            <button type="button" className="btn" onClick={bulkDelete}>
              Delete
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDirName(tag && tag !== UNTAGGED ? tag : '');
                setTargetDirId('');
                setSameNameMode('merge');
                setSaveDirOpen(true);
              }}
            >
              Save list
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setPdfFromSelection(true);
                setPdfOpen(true);
              }}
            >
              Make PDF
            </button>
          </div>
        </footer>
      )}

      {/* Quick PDF of current filter without selecting */}
      {db.contacts.length > 0 && selectedContacts.length === 0 && visible.length > 0 && (
        <footer className="selbar" style={{ opacity: 0.97 }}>
          <div className="selbar-info">
            <span className="muted">{visible.length} shown</span>
            <button type="button" className="link" onClick={selectAllShown}>
              Select all
            </button>
            <button type="button" className="link" onClick={exportSelected}>
              Export shown
            </button>
          </div>
          <div className="selbar-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setPdfFromSelection(false);
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
        presetCategory={presetCategory}
        onClose={() => setEditing(undefined)}
      />
      <PdfSheet
        open={pdfOpen}
        contacts={pdfContacts}
        defaultTitle={pdfTitle}
        onClose={() => {
          setPdfOpen(false);
          setPdfFromSelection(false);
        }}
      />

      <Sheet open={bulkCatOpen} title="Set category" onClose={() => setBulkCatOpen(false)}>
        <p className="muted">
          Assign a primary category to {selectedContacts.length} selected contact
          {selectedContacts.length === 1 ? '' : 's'}.
        </p>
        <label>
          Category
          <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
            <option value="">— None —</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn primary wide" onClick={applyBulkCategory}>
          Apply category
        </button>
      </Sheet>

      <Sheet open={bulkTagOpen} title="Tag selected" onClose={() => setBulkTagOpen(false)}>
        <p className="muted">
          Add or remove a tag on {selectedContacts.length} selected contact
          {selectedContacts.length === 1 ? '' : 's'}.
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
        onClose={() => {
          setSaveDirOpen(false);
          setTargetDirId('');
        }}
        right={
          <button
            type="button"
            className="link strong"
            onClick={saveAsDirectory}
            disabled={!(targetDirId || dirName.trim()) || !selectedContacts.length}
          >
            Save
          </button>
        }
      >
        <p className="muted">
          Save {selectedContacts.length} selected contact{selectedContacts.length === 1 ? '' : 's'} into a directory.
        </p>
        {!!manualDirectories.length && (
          <label>
            Add to existing
            <select
              value={targetDirId}
              onChange={(e) => {
                setTargetDirId(e.target.value);
                if (e.target.value) setDirName('');
              }}
            >
              <option value="">— New directory —</option>
              {manualDirectories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.contactIds.length})
                </option>
              ))}
            </select>
          </label>
        )}
        {!targetDirId && (
          <label>
            Name
            <input
              value={dirName}
              placeholder="e.g. Family 2026"
              onChange={(e) => setDirName(e.target.value)}
            />
          </label>
        )}
        {collidingDir && (
          <fieldset>
            <legend>“{collidingDir.name}” already exists ({collidingDir.contactIds.length})</legend>
            <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={sameNameMode === 'merge' ? 'on' : ''}
                onClick={() => setSameNameMode('merge')}
              >
                Merge
              </button>
              <button
                type="button"
                className={sameNameMode === 'replace' ? 'on' : ''}
                onClick={() => setSameNameMode('replace')}
              >
                Replace
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {sameNameMode === 'merge'
                ? 'Add the selection to the existing members.'
                : 'Discard current members and keep only the selection.'}
            </p>
          </fieldset>
        )}
      </Sheet>
    </>
  );
}
