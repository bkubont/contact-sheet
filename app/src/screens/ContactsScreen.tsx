import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Contact } from '../types';
import { Store, displayName, loadSelection, saveSelection } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { ContactEditor } from '../components/ContactEditor';
import { PdfSheet } from '../components/PdfSheet';
import { Sheet } from '../components/Sheet';
import { FilterSheet } from '../components/FilterSheet';
import { BulkTagSheet } from '../components/BulkTagSheet';
import { SaveListSheet } from '../components/SaveListSheet';
import { ColorPill, Dot } from '../components/Color';
import { downloadBlob, toast, uid } from '../lib/util';
import { toVCard } from '../lib/importers';
import { askConfirm } from '../lib/dialogs';
import { NO_FILTERS, UNCAT, UNTAGGED, hasFilters, passesFilters, type Filters } from '../lib/filters';

function sortKey(c: Contact) {
  return `${c.last || c.first || c.company} ${c.first}`.toLowerCase();
}

function matches(c: Contact, q: string) {
  if (!q) return true;
  const hay = [c.first, c.last, c.company, c.title, c.address, c.notes, c.birthday, Store.categoryName(c.category), ...c.tags, ...c.phones.map((p) => p.value), ...c.emails.map((e) => e.value)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

const Icon = {
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  pdf: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  folder: <path d="M3 7h6l2 2h10v10H3z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};
const Svg = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24">{children}</svg>;

export function ContactsScreen({ focusTag, onOpenSettings }: { focusTag?: { tag: string; at: number } | null; onOpenSettings: () => void }) {
  const db = useDb();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection());
  const [selecting, setSelecting] = useState(() => loadSelection().size > 0);
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined); // undefined=closed, null=new
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFromSelection, setPdfFromSelection] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [bulkCat, setBulkCat] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Coming from Tags → "n contacts": show just that tag.
  useEffect(() => {
    if (focusTag) {
      setFilters({ cats: [], tags: [focusTag.tag], match: 'any' });
      setQuery('');
    }
  }, [focusTag]);

  // Drop selected ids that no longer exist (delete, restore, wipe), and filters for tags/categories that are gone.
  useEffect(() => {
    const alive = new Set(db.contacts.map((c) => c.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => alive.has(id)));
      if (next.size === prev.size) return prev;
      saveSelection(next);
      return next;
    });
    const tagsNow = new Set(Store.tagCounts().map(([t]) => t));
    const catsNow = new Set(db.categories.map((c) => c.id));
    setFilters((f) => {
      const tags = f.tags.filter((t) => t === UNTAGGED || tagsNow.has(t));
      const cats = f.cats.filter((c) => c === UNCAT || catsNow.has(c));
      return tags.length === f.tags.length && cats.length === f.cats.length ? f : { ...f, tags, cats };
    });
  }, [db]);

  const countFor = (f: Filters) => db.contacts.filter((c) => passesFilters(c, f) && matches(c, query)).length;

  const visible = useMemo(
    () =>
      db.contacts
        .filter((c) => passesFilters(c, filters) && matches(c, query))
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: 'base' })),
    [db, filters, query],
  );

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

  const selectedContacts = useMemo(() => db.contacts.filter((c) => selected.has(c.id)), [db, selected]);
  const n = selectedContacts.length;

  function setSel(next: Set<string>) {
    setSelected(next);
    saveSelection(next);
  }
  function toggleSel(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  }
  function endSelect() {
    setSelecting(false);
    setSel(new Set());
  }
  const allShownSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  function selectAllShown() {
    const next = new Set(selected);
    if (allShownSelected) visible.forEach((c) => next.delete(c.id));
    else visible.forEach((c) => next.add(c.id));
    setSel(next);
  }

  const filtering = hasFilters(filters) || !!query.trim();

  // Filter chips under the search box
  const realTags = filters.tags.filter((t) => t !== UNTAGGED);
  const activeChips = [
    ...filters.cats.map((id) => ({
      key: `c:${id}`,
      label: id === UNCAT ? 'No category' : Store.categoryName(id),
      color: id === UNCAT ? undefined : Store.categoryColor(id),
      remove: () => setFilters({ ...filters, cats: filters.cats.filter((x) => x !== id) }),
    })),
    ...filters.tags.map((t) => ({
      key: `t:${t}`,
      label: t === UNTAGGED ? 'No tags' : t,
      color: t === UNTAGGED ? undefined : Store.tagColor(t),
      remove: () => setFilters({ ...filters, tags: filters.tags.filter((x) => x !== t) }),
    })),
  ];
  const canSaveSmart = realTags.length > 0 && !filters.cats.length && !filters.tags.includes(UNTAGGED);

  function saveFilterAsList() {
    const name = realTags.join(filters.match === 'all' ? ' + ' : ' / ');
    Store.upsertDirectory({ id: uid(), name, notes: '', mode: 'smart', contactIds: [], tags: realTags, match: filters.match, created: Date.now(), updated: Date.now() });
    toast(`Made the smart list “${name}” (see Lists)`);
  }

  const pdfTitle =
    (filters.cats.length === 1 && filters.cats[0] !== UNCAT && Store.categoryName(filters.cats[0])) ||
    (realTags.length === 1 && !filters.cats.length ? realTags[0] : '') ||
    'Contact Sheet';

  async function bulkDelete() {
    setMoreOpen(false);
    if (!n) return;
    const ok = await askConfirm({
      title: `Delete ${n} contact${n === 1 ? '' : 's'}?`,
      message: 'They’re removed from every list. This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    Store.removeMany(selectedContacts.map((c) => c.id));
    endSelect();
    toast(`Deleted ${n}`);
  }

  function exportSelected() {
    setMoreOpen(false);
    const list = n ? selectedContacts : visible;
    if (!list.length) return;
    downloadBlob(new Blob([toVCard(list)], { type: 'text/vcard' }), `contacts-${list.length}.vcf`);
    toast(`Exported ${list.length}`);
  }

  const presetTag = realTags.length === 1 ? realTags[0] : null;
  const presetCategory = filters.cats.length === 1 && filters.cats[0] !== UNCAT ? filters.cats[0] : null;

  return (
    <>
      <header className="topbar">
        {selecting ? (
          <div className="topbar-row">
            <button type="button" className="link" onClick={endSelect}>
              Done
            </button>
            <h1 className="brand center">{n ? `${n} selected` : 'Select people'}</h1>
            <button type="button" className="link" onClick={selectAllShown} disabled={!visible.length}>
              {allShownSelected ? 'Select none' : 'Select all'}
            </button>
          </div>
        ) : (
          <div className="topbar-row">
            <span className="logo-tile" aria-hidden="true" />
            <h1 className="brand">
              Contacts
              <span>{db.contacts.length || ''}</span>
            </h1>
            {filtering && visible.length > 0 && (
              <button
                className="icon-btn"
                aria-label={`Make a PDF of these ${visible.length}`}
                title={`PDF of these ${visible.length}`}
                onClick={() => {
                  setPdfFromSelection(false);
                  setPdfOpen(true);
                }}
              >
                <Svg>{Icon.pdf}</Svg>
              </button>
            )}
            {db.contacts.length > 0 && (
              <button type="button" className="link" onClick={() => setSelecting(true)}>
                Select
              </button>
            )}
            <button className="icon-btn accent" aria-label="Add contact" onClick={() => setEditing(null)}>
              <Svg>{Icon.plus}</Svg>
            </button>
          </div>
        )}
        {db.contacts.length > 0 && (
          <div className="search-row">
            <div className="search">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="6" />
                <path d="M20 20l-4.5-4.5" />
              </svg>
              <input type="search" placeholder="Search" aria-label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            </div>
            <button
              type="button"
              className={`filter-btn${hasFilters(filters) ? ' on' : ''}`}
              aria-label={hasFilters(filters) ? `Filter (${activeChips.length} on)` : 'Filter'}
              onClick={() => setFilterOpen(true)}
            >
              <Svg>{Icon.filter}</Svg>
              Filter
              {hasFilters(filters) && <b className="badge-n">{activeChips.length}</b>}
            </button>
          </div>
        )}
        {activeChips.length > 0 && (
          <div className="active-filters">
            {activeChips.map((c) => (
              <button key={c.key} type="button" className="chip on" data-color={c.color} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                {c.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {realTags.length > 1 && <span className="muted match-note">{filters.match === 'all' ? 'all of these' : 'any of these'}</span>}
            <button type="button" className="link small" onClick={() => setFilters(NO_FILTERS)}>
              Clear
            </button>
            {canSaveSmart && (
              <button type="button" className="link small" onClick={saveFilterAsList}>
                Save as list
              </button>
            )}
          </div>
        )}
      </header>

      {!db.contacts.length ? (
        <div className="empty">
          <p className="mark">Contact Sheet</p>
          <h2>Your personal directory</h2>
          <p>Import contacts, tag them, save lists, and print a PDF of whoever you pick.</p>
          <div className="actions">
            <button className="btn primary" onClick={onOpenSettings}>
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
          <p>Try another search, or change the filter.</p>
          {filtering && (
            <div className="actions">
              <button
                className="btn"
                onClick={() => {
                  setFilters(NO_FILTERS);
                  setQuery('');
                }}
              >
                Show everyone
              </button>
            </div>
          )}
        </div>
      ) : (
        <main className={`list tablet-grid${selecting ? ' selecting' : ''}`}>
          {grouped.map(([letter, people]) => (
            <section key={letter}>
              <div className="letter">{letter}</div>
              {people.map((c) => {
                const sel = selected.has(c.id);
                const catName = c.category ? Store.categoryName(c.category) : '';
                const catColor = c.category ? Store.categoryColor(c.category) : undefined;
                const meta = [c.title, c.company].filter(Boolean).join(' · ') || (catName ? '' : c.phones[0]?.value || c.emails[0]?.value || '');
                const open = () => (selecting ? toggleSel(c.id) : setEditing(c));
                return (
                  <div key={c.id} className={`row${sel ? ' sel' : ''}`} data-color={catColor}>
                    {selecting && (
                      <button type="button" className="pick" aria-label={`Select ${displayName(c)}`} aria-pressed={sel} onClick={() => toggleSel(c.id)}>
                        {sel && (
                          <svg viewBox="0 0 24 24">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </button>
                    )}
                    <button type="button" className="row-main" onClick={open}>
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
                    {!selecting && (
                      <button type="button" className="row-open" aria-label={`Open ${displayName(c)}`} onClick={open}>
                        <svg viewBox="0 0 24 24">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </main>
      )}

      {selecting && (
        <footer className="actionbar" aria-label="Actions for selected people">
          <button type="button" disabled={!n} onClick={() => setTagOpen(true)}>
            <Svg>{Icon.tag}</Svg>
            Tag
          </button>
          <button
            type="button"
            disabled={!n}
            onClick={() => {
              const cats = new Set(selectedContacts.map((c) => c.category));
              setBulkCat(cats.size === 1 ? [...cats][0] : '');
              setCatOpen(true);
            }}
          >
            <Svg>{Icon.folder}</Svg>
            Category
          </button>
          <button type="button" disabled={!n} onClick={() => setListOpen(true)}>
            <Svg>{Icon.list}</Svg>
            List
          </button>
          <button
            type="button"
            disabled={!n}
            onClick={() => {
              setPdfFromSelection(true);
              setPdfOpen(true);
            }}
          >
            <Svg>{Icon.pdf}</Svg>
            PDF
          </button>
          <button type="button" disabled={!n} onClick={() => setMoreOpen(true)}>
            <Svg>{Icon.more}</Svg>
            More
          </button>
        </footer>
      )}

      <ContactEditor open={editing !== undefined} contact={editing ?? null} presetTag={presetTag} presetCategory={presetCategory} onClose={() => setEditing(undefined)} />
      <PdfSheet
        open={pdfOpen}
        contacts={pdfFromSelection ? selectedContacts : visible}
        defaultTitle={pdfTitle}
        onClose={() => {
          setPdfOpen(false);
          setPdfFromSelection(false);
        }}
      />
      <FilterSheet open={filterOpen} value={filters} onApply={setFilters} onClose={() => setFilterOpen(false)} countFor={countFor} />
      <BulkTagSheet open={tagOpen} people={selectedContacts} onClose={() => setTagOpen(false)} />
      <SaveListSheet open={listOpen} people={selectedContacts} defaultName={pdfTitle === 'Contact Sheet' ? '' : pdfTitle} onClose={() => setListOpen(false)} />

      <Sheet
        open={catOpen}
        title={`Category for ${n}`}
        onClose={() => setCatOpen(false)}
        right={
          <button
            type="button"
            className="link strong"
            onClick={() => {
              Store.bulkCategory([...selected], bulkCat);
              toast(bulkCat ? `${Store.categoryName(bulkCat)} for ${n}` : `Cleared the category for ${n}`);
              setCatOpen(false);
            }}
          >
            Apply
          </button>
        }
      >
        <div className="choice-chips" role="radiogroup" aria-label="Category">
          {db.categories.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={bulkCat === c.id} data-color={c.color} className={bulkCat === c.id ? 'on' : undefined} onClick={() => setBulkCat(c.id)}>
              {c.name}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={bulkCat === ''} className={bulkCat === '' ? 'on' : undefined} onClick={() => setBulkCat('')}>
            No category
          </button>
        </div>
      </Sheet>

      <Sheet open={moreOpen} title={`${n} selected`} onClose={() => setMoreOpen(false)}>
        <div className="settings-group">
          <button type="button" className="settings-row" onClick={exportSelected}>
            <span>
              Export as .vcf
              <small>To add them to another app</small>
            </span>
          </button>
          <button type="button" className="settings-row danger" onClick={bulkDelete}>
            <span>
              Delete {n} contact{n === 1 ? '' : 's'}
            </span>
          </button>
        </div>
      </Sheet>
    </>
  );
}
