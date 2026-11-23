import { useMemo, useState } from 'react';
import type { Directory } from '../types';
import { Store, displayName } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { PdfSheet } from '../components/PdfSheet';
import { Sheet } from '../components/Sheet';
import { toast } from '../lib/util';

function newId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DirectoriesScreen() {
  const db = useDb();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [smartTags, setSmartTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [match, setMatch] = useState<'any' | 'all'>('any');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = activeId ? Store.getDirectory(activeId) : null;
  const members = useMemo(() => (active ? Store.membersOf(active) : []), [active, db]);
  const tagOptions = Store.tagCounts().map(([t]) => t);

  function openCreate() {
    setEditingId(null);
    setName('');
    setSmartTags([]);
    setTagInput('');
    setMatch('any');
    setCreateOpen(true);
  }

  function openEdit(dir: Directory) {
    setEditingId(dir.id);
    setName(dir.name);
    setSmartTags([...dir.tags]);
    setTagInput('');
    setMatch(dir.match);
    setEditOpen(true);
  }

  function addSmartTag(raw: string) {
    let t = raw.trim();
    if (!t) return;
    const existing = tagOptions.find((x) => x.toLowerCase() === t.toLowerCase());
    if (existing) t = existing;
    if (!smartTags.includes(t)) setSmartTags([...smartTags, t]);
    setTagInput('');
  }

  function create() {
    const n = name.trim();
    if (!n) return;
    if (!smartTags.length) {
      toast('Add at least one tag');
      return;
    }
    const dir: Directory = {
      id: newId(),
      name: n,
      notes: '',
      mode: 'smart',
      contactIds: [],
      tags: smartTags,
      match,
      created: Date.now(),
      updated: Date.now(),
    };
    Store.upsertDirectory(dir);
    setCreateOpen(false);
    setActiveId(dir.id);
    toast(`Created “${n}”`);
  }

  function saveEdit() {
    if (!editingId) return;
    const existing = Store.getDirectory(editingId);
    if (!existing) return;
    const n = name.trim();
    if (!n) return;
    if (existing.mode === 'smart' && !smartTags.length) {
      toast('Add at least one tag');
      return;
    }
    Store.upsertDirectory({
      ...existing,
      name: n,
      tags: existing.mode === 'smart' ? smartTags : existing.tags,
      match: existing.mode === 'smart' ? match : existing.match,
    });
    setEditOpen(false);
    toast('Directory updated');
  }

  function removeMember(contactId: string) {
    if (!active || active.mode !== 'manual') return;
    Store.upsertDirectory({
      ...active,
      contactIds: active.contactIds.filter((id) => id !== contactId),
    });
  }

  function removeDir(dir: Directory) {
    if (!confirm(`Delete directory “${dir.name}”? Contacts stay in your master list.`)) return;
    Store.removeDirectory(dir.id);
    if (activeId === dir.id) setActiveId(null);
    toast('Directory deleted');
  }

  const tagEditor = (
    <>
      <fieldset>
        <legend>Tags</legend>
        <div className="pills">
          {smartTags.map((t) => (
            <button key={t} type="button" className="pill x" onClick={() => setSmartTags(smartTags.filter((x) => x !== t))}>
              {t}
            </button>
          ))}
        </div>
        <input
          value={tagInput}
          placeholder="Add tag and press Enter"
          list="dir-tags"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSmartTag(tagInput);
            }
          }}
        />
        <datalist id="dir-tags">
          {tagOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="suggest">
          {tagOptions
            .filter((t) => !smartTags.includes(t))
            .slice(0, 8)
            .map((t) => (
              <button key={t} type="button" onClick={() => addSmartTag(t)}>
                + {t}
              </button>
            ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Match</legend>
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" className={match === 'any' ? 'on' : ''} onClick={() => setMatch('any')}>
            Any tag
          </button>
          <button type="button" className={match === 'all' ? 'on' : ''} onClick={() => setMatch('all')}>
            All tags
          </button>
        </div>
      </fieldset>
    </>
  );

  if (active) {
    return (
      <>
        <header className="topbar">
          <div className="topbar-row">
            <button className="icon-btn" aria-label="Back" onClick={() => setActiveId(null)}>
              <svg viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <h1 className="brand">
              {active.name}
              <span>{members.length}</span>
            </h1>
            <button className="icon-btn" aria-label="Edit directory" onClick={() => openEdit(active)}>
              <svg viewBox="0 0 24 24">
                <path d="M4 20h4l10-10-4-4L4 16v4z" />
                <path d="M13 7l4 4" />
              </svg>
            </button>
          </div>
          <p className="muted" style={{ margin: '10px 4px 0', fontSize: '0.92rem' }}>
            {active.mode === 'smart' ? (
              <>
                Smart list · tags {active.match === 'all' ? 'all of' : 'any of'}{' '}
                <strong>{active.tags.join(', ') || '—'}</strong>
              </>
            ) : (
              <>Saved selection · {members.length} people</>
            )}
          </p>
        </header>

        {!members.length ? (
          <div className="empty">
            <h2>No contacts yet</h2>
            <p>
              {active.mode === 'smart'
                ? 'No one matches these tags right now. Tag contacts on the Contacts tab.'
                : 'This list is empty. On Contacts, select people and tap Save list → Add to existing.'}
            </p>
          </div>
        ) : (
          <main className="list">
            {members
              .slice()
              .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }))
              .map((c) => (
                <div
                  key={c.id}
                  className="row"
                  style={{ gridTemplateColumns: active.mode === 'manual' ? '1fr auto' : '1fr' }}
                >
                  <div className="row-main">
                    <div className="row-name">{displayName(c)}</div>
                    <div className="row-meta">
                      {[c.title, c.company].filter(Boolean).join(' · ') || c.phones[0]?.value || ''}
                    </div>
                    {!!c.tags.length && (
                      <div className="pills">
                        {c.tags.map((t) => (
                          <span key={t} className="pill">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {active.mode === 'manual' && (
                    <button type="button" className="link" onClick={() => removeMember(c.id)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
          </main>
        )}

        <footer className="selbar">
          <div className="selbar-info">
            <button type="button" className="link" onClick={() => openEdit(active)}>
              Edit
            </button>
            <button type="button" className="link danger" onClick={() => removeDir(active)}>
              Delete
            </button>
          </div>
          <div className="selbar-actions">
            <button type="button" className="btn primary" disabled={!members.length} onClick={() => setPdfOpen(true)}>
              Make PDF
            </button>
          </div>
        </footer>

        <PdfSheet open={pdfOpen} contacts={members} defaultTitle={active.name} onClose={() => setPdfOpen(false)} />

        <Sheet
          open={editOpen}
          title="Edit directory"
          onClose={() => setEditOpen(false)}
          right={
            <button type="button" className="link strong" onClick={saveEdit}>
              Save
            </button>
          }
        >
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {active.mode === 'smart' && tagEditor}
          {active.mode === 'manual' && (
            <p className="muted">
              To add people, select them on Contacts and use Save list → Add to existing. Remove members with Remove on
              each row.
            </p>
          )}
        </Sheet>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <span className="logo-tile" aria-hidden="true" />
          <h1 className="brand">
            Directories
            <span>{db.directories.length || ''}</span>
          </h1>
          <button className="icon-btn accent" aria-label="New directory" onClick={openCreate}>
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <p className="muted" style={{ margin: '10px 4px 0', fontSize: '0.92rem' }}>
          Named lists you can reopen and turn into a PDF anytime.
        </p>
      </header>

      {!db.directories.length ? (
        <div className="empty">
          <p className="mark">Directories</p>
          <h2>Save the lists you reuse</h2>
          <p>
            Make a smart directory from tags (always up to date), or on Contacts select people and tap Save list.
          </p>
          <div className="actions">
            <button className="btn primary" onClick={openCreate}>
              New smart directory
            </button>
          </div>
        </div>
      ) : (
        <div className="dirs">
          {db.directories
            .slice()
            .sort((a, b) => b.updated - a.updated)
            .map((d) => {
              const n = Store.membersOf(d).length;
              return (
                <button key={d.id} type="button" className="dir-card" onClick={() => setActiveId(d.id)}>
                  <span className="badge">{d.mode === 'smart' ? 'Smart' : 'Saved'}</span>
                  <h3>{d.name}</h3>
                  <div className="meta">
                    {n} contact{n === 1 ? '' : 's'}
                    {d.mode === 'smart' && d.tags.length ? ` · ${d.tags.join(', ')}` : ''}
                  </div>
                </button>
              );
            })}
        </div>
      )}

      <Sheet
        open={createOpen}
        title="New directory"
        onClose={() => setCreateOpen(false)}
        right={
          <button type="button" className="link strong" onClick={create}>
            Create
          </button>
        }
      >
        <p className="muted">
          Smart directories stay current as you tag contacts. For a fixed list, select people on Contacts and tap Save
          list.
        </p>
        <label>
          Name
          <input value={name} placeholder="e.g. School board" onChange={(e) => setName(e.target.value)} />
        </label>
        {tagEditor}
      </Sheet>
    </>
  );
}
